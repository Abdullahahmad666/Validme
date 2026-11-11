from django.db import IntegrityError, transaction
from django.db.models import F, Window
from django.db.models.functions import RowNumber
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from projects.models import Assumption, Project, UnitEconomics
from projects.serializers import AssumptionSerializer, ProjectSerializer, ResearchQuerySerializer, UnitEconomicsSerializer
from projects.services import dashboard_summary
from research.ai import client as llm
from research.ai.tasks import generate_queries, interpret_idea
from research.models import ResearchQuery
from research.views import parse_uuid


class AIUnavailable(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_code = "ai_unavailable"
    default_detail = "AI assistance is unavailable right now. You can continue by filling in the fields yourself."


class AIFailed(APIException):
    status_code = status.HTTP_502_BAD_GATEWAY
    default_code = "ai_failed"
    default_detail = "The AI step didn't return a usable answer. Please try again."


def _run_ai(fn, *args, **kwargs):
    """Map LLM failures to clear API errors; nothing is saved when the call fails."""
    if not llm.is_configured():
        raise AIUnavailable()
    try:
        return fn(*args, **kwargs)
    except llm.LLMNotConfigured as exc:
        raise AIUnavailable() from exc
    except llm.LLMError as exc:
        raise AIFailed() from exc


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer

    def get_queryset(self):
        # Owner isolation: never remove this filter.
        qs = Project.objects.filter(owner=self.request.user).select_related("idea", "market", "config")
        status_filter = self.request.query_params.get("status")
        if status_filter in Project.Status.values:
            qs = qs.filter(status=status_filter)
        return qs

    def get_throttles(self):
        if self.action in ("interpret", "generate_queries"):
            self.throttle_scope = "ai"
            return [*super().get_throttles(), ScopedRateThrottle()]
        return super().get_throttles()

    def _draft(self) -> Project:
        project = self.get_object()
        if project.status != Project.Status.DRAFT:
            raise ValidationError({"status": "Only draft projects can be changed."})
        return project

    @action(detail=True, methods=["post"])
    def interpret(self, request, pk=None):
        """AI restatement of the idea (problem, customers, assumptions). Stored apart from the founder's text."""
        project = self._draft()
        data = _run_ai(interpret_idea, project)
        return Response({"ai_interpretation": data})

    @action(detail=True, methods=["get", "put"], url_path="unit-economics")
    def unit_economics(self, request, pk=None):
        """GET/PUT /projects/{id}/unit-economics — the founder's own simulator inputs (labelled as theirs)."""
        project = self.get_object()  # owner-filtered queryset
        if request.method == "GET":
            row = UnitEconomics.objects.filter(project=project).first()
            return Response({"inputs": row.inputs if row else None, "updated_at": row.updated_at if row else None})
        body = UnitEconomicsSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        row, _ = UnitEconomics.objects.update_or_create(project=project, defaults={"inputs": body.validated_data})
        return Response({"inputs": row.inputs, "updated_at": row.updated_at})

    @action(detail=False, methods=["get"])
    def compare(self, request):
        """GET /projects/compare?ids=a,b[,c,d] — latest report summary for 2–4 of your own projects."""
        from reports.models import Report

        raw = [x.strip() for x in (request.query_params.get("ids") or "").split(",") if x.strip()]
        if len(raw) > 4:
            raise ValidationError({"ids": "Pick 2 to 4 projects."})
        ids = [parse_uuid(x) for x in raw]
        if any(i is None for i in ids):
            raise ValidationError({"ids": "Not a valid project id."})
        ids = list(dict.fromkeys(ids))
        if not 2 <= len(ids) <= 4:
            raise ValidationError({"ids": "Pick 2 to 4 projects."})
        projects = {p.pk: p for p in Project.objects.filter(owner=request.user, pk__in=ids)}  # owner isolation
        if len(projects) != len(ids):
            raise Http404
        # Newest report id per project first (window over ids only), then load just those snapshots.
        newest = (
            Report.objects.filter(project_id__in=ids)
            .annotate(rn=Window(RowNumber(), partition_by=[F("project_id")], order_by=F("created_at").desc()))
            .filter(rn=1)
            .values_list("id", flat=True)
        )
        latest = {
            r.project_id: r for r in Report.objects.filter(pk__in=list(newest)).only("id", "project_id", "created_at", "content")
        }
        results = []
        for pid in ids:
            p, r = projects[pid], latest.get(pid)
            c = r.content if r else {}
            o = c.get("overview", {})
            results.append(
                {
                    "id": str(p.pk),
                    "name": p.name,
                    "status": p.status,
                    "report_id": r.id if r else None,
                    "generated_at": c.get("generated_at") or (r.created_at.isoformat() if r else None),
                    "score": o.get("score"),
                    "confidence": o.get("confidence"),
                    "recommendation": o.get("recommendation"),
                    "evidence_count": o.get("evidence_count", 0),
                    "competitor_count": o.get("competitor_count", 0),
                    "scored_weight": c.get("opportunity", {}).get("scored_weight"),
                    "dimensions": [
                        {k: d.get(k) for k in ("key", "label", "weight", "score", "available", "confidence")}
                        for d in c.get("opportunity", {}).get("dimensions", [])
                    ],
                }
            )
        return Response({"results": results})

    @action(detail=True, methods=["post"], url_path="keywords/generate")
    def generate_queries(self, request, pk=None):
        """Generate search queries for all intents, or regenerate one group with {"intent": "..."}."""
        project = self._draft()
        intent = (request.data.get("intent") if isinstance(request.data, dict) else None) or None
        if intent is not None and intent not in ResearchQuery.Intent.values:
            raise ValidationError({"intent": f"Must be one of {', '.join(ResearchQuery.Intent.values)}."})
        _run_ai(generate_queries, project, intent=intent)
        queries = ResearchQuery.objects.filter(project=project)
        return Response({"results": ResearchQuerySerializer(queries, many=True).data})


class ProjectQueryViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """/projects/{project_id}/queries — the founder can add, edit, disable and remove queries."""

    serializer_class = ResearchQuerySerializer
    pagination_class = None  # bounded (≤ ~40 per project) and shown grouped by intent
    MAX_QUERIES = 40

    def _project(self) -> Project:
        # Owner isolation: a project that isn't yours (or a malformed id) is a 404.
        project_id = parse_uuid(self.kwargs["project_pk"])
        if project_id is None:
            raise Http404
        return get_object_or_404(Project, pk=project_id, owner=self.request.user)

    def get_queryset(self):
        return ResearchQuery.objects.filter(project=self._project())

    def _ensure_draft(self, project: Project) -> None:
        if project.status != Project.Status.DRAFT:
            raise ValidationError({"status": "Only draft projects can be changed."})

    @transaction.atomic
    def perform_create(self, serializer):
        project = self._project()
        Project.objects.select_for_update().filter(pk=project.pk).first()  # serialize the cap check
        self._ensure_draft(project)
        if ResearchQuery.objects.filter(project=project).count() >= self.MAX_QUERIES:
            raise ValidationError({"queries": f"A project can have at most {self.MAX_QUERIES} queries."})
        serializer.save(project=project, ai_generated=False)

    def perform_update(self, serializer):
        self._ensure_draft(serializer.instance.project)
        serializer.save()

    def perform_destroy(self, instance):
        self._ensure_draft(instance.project)
        instance.delete()


class DashboardSummaryView(APIView):
    def get(self, request):
        return Response(dashboard_summary(request.user))


class AssumptionViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """/projects/{project_id}/assumptions — the founder's assumptions to test, each with its own status and evidence."""

    serializer_class = AssumptionSerializer
    pagination_class = None  # bounded by MAX_ASSUMPTIONS
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    MAX_ASSUMPTIONS = 30

    def _project(self) -> Project:
        # Owner isolation: a project that isn't yours (or a malformed id) is a 404.
        project_id = parse_uuid(self.kwargs["project_pk"])
        if project_id is None:
            raise Http404
        return get_object_or_404(Project, pk=project_id, owner=self.request.user)

    def get_queryset(self):
        if not hasattr(self, "_project_cache"):
            self._project_cache = self._project()
        return Assumption.objects.filter(project=self._project_cache, dismissed=False).prefetch_related("evidence")

    def _evidence(self, project: Project, ids: list[int], already: set[int] | None = None):
        """Linked evidence must be this project's. Newly added links must also be visible to the user: inside the
        free-plan preview, or cited by the latest report (which always shows its sources). Links that already
        exist are kept even if the preview has since moved, so unlinking never gets stuck."""
        from evidence.models import Evidence
        from evidence.views import preview_ids
        from reports.models import Report

        ids = list(dict.fromkeys(ids))
        found = {e.pk: e for e in Evidence.objects.filter(project=project, pk__in=ids)}
        if len(found) != len(ids):
            raise ValidationError({"evidence_ids": "Some evidence isn't in this project."})
        new = set(ids) - (already or set())
        allowed = preview_ids(self.request.user, project.pk)
        if new and allowed is not None:
            visible = set(allowed)
            latest = Report.objects.filter(project=project).order_by("-created_at").values_list("content", flat=True).first()
            visible |= {int(k) for k in ((latest or {}).get("evidence_index") or {})}
            if any(found[i].pk not in visible and found[i].duplicate_of_id not in visible for i in new):
                raise ValidationError({"evidence_ids": "Some evidence isn't available on your plan."})
        return [found[i] for i in ids]

    @transaction.atomic
    def perform_create(self, serializer):
        project = self._project()
        Project.objects.select_for_update().filter(pk=project.pk).first()  # serialize the cap check
        if Assumption.objects.filter(project=project).count() >= self.MAX_ASSUMPTIONS:
            raise ValidationError({"assumptions": f"A project can have at most {self.MAX_ASSUMPTIONS} assumptions."})
        text = serializer.validated_data["text"]
        existing = Assumption.objects.filter(project=project, text=text).first()
        if existing and not existing.dismissed:
            raise ValidationError({"text": "You already have this assumption."})
        ids = serializer.validated_data.pop("evidence_ids", [])
        linked = self._evidence(project, ids)
        if existing:  # re-adding a dismissed one brings it back as the founder's
            existing.dismissed = False
            existing.source = Assumption.Source.FOUNDER
            existing.status = Assumption.Status.UNTESTED
            existing.save(update_fields=["dismissed", "source", "status"])
            serializer.instance = existing
            obj = existing
        else:
            try:
                with transaction.atomic():
                    obj = serializer.save(project=project, source=Assumption.Source.FOUNDER)
            except IntegrityError as exc:  # a report rebuild seeded the same text a moment ago
                raise ValidationError({"text": "You already have this assumption."}) from exc
        obj.evidence.set(linked)

    @transaction.atomic
    def perform_update(self, serializer):
        obj = serializer.instance
        ids = serializer.validated_data.pop("evidence_ids", None)
        text = serializer.validated_data.get("text")
        if text and text != obj.text and Assumption.objects.filter(project=obj.project, text=text).exclude(pk=obj.pk).exists():
            raise ValidationError({"text": "You already have this assumption."})
        # Validate links before saving anything, so a rejected request changes nothing.
        linked = self._evidence(obj.project, ids, set(obj.evidence.values_list("id", flat=True))) if ids is not None else None
        try:
            with transaction.atomic():
                obj = serializer.save()
        except IntegrityError as exc:
            raise ValidationError({"text": "You already have this assumption."}) from exc
        if linked is not None:
            obj.evidence.set(linked)

    def perform_destroy(self, instance):
        if instance.source == Assumption.Source.AI:
            # Kept as dismissed so a report rebuild doesn't bring the suggestion back.
            instance.dismissed = True
            instance.save(update_fields=["dismissed"])
        else:
            instance.delete()
