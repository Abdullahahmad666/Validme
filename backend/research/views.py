import uuid

from django.db import transaction
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from analytics.services import track
from billing.plans import PlanLimit, check_launch, limits_for
from billing.services import InsufficientCredits, credits_for, spend_credits
from projects.models import Project
from research.budgets import DEPTH_BUDGETS
from research.models import ResearchJob
from research.providers import registry
from research.serializers import ResearchJobCreateSerializer, ResearchJobSerializer
from research.services import can_run, create_stages
from research.tasks import run_research_job


def parse_uuid(value: str) -> uuid.UUID | None:
    """Malformed ids are 'not found', not a 500."""
    try:
        return uuid.UUID(str(value))
    except ValueError:
        return None


class SourcesView(APIView):
    def get(self, request):
        data = [
            {
                "key": p.key,
                "label": p.label,
                "contributes": p.contributes,
                "availability": p.availability().value,
                "stage": getattr(p, "stage", "web_research"),
                "uses_queries": getattr(p, "uses_queries", True),
            }
            for p in registry.PROVIDERS.values()
        ]
        data += [
            {
                "key": k,
                "label": k.replace("_", " ").title(),
                "contributes": reason,
                "availability": "UNAVAILABLE",
                "stage": None,
                "uses_queries": False,
            }
            for k, reason in registry.UNAVAILABLE_SOURCES.items()
        ]
        return Response({"results": data})


class ResearchJobViewSet(mixins.CreateModelMixin, mixins.RetrieveModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = ResearchJobSerializer

    def get_queryset(self):
        # Owner isolation: only jobs on your own projects.
        qs = ResearchJob.objects.filter(project__owner=self.request.user).prefetch_related("stages")
        project = self.request.query_params.get("project")
        if project is None:
            return qs
        project_id = parse_uuid(project)
        return qs.filter(project_id=project_id) if project_id else qs.none()

    def create(self, request, *args, **kwargs):
        key = request.headers.get("Idempotency-Key")
        if not key:
            raise ValidationError({"Idempotency-Key": "Header is required."})
        body = ResearchJobCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        try:
            project = Project.objects.get(pk=body.validated_data["project"], owner=request.user)
        except Project.DoesNotExist as exc:
            raise NotFound("Project not found.") from exc

        existing = ResearchJob.objects.filter(project=project, idempotency_key=key).first()
        if existing:
            return Response(ResearchJobSerializer(existing).data, status=status.HTTP_200_OK)

        config = getattr(project, "config", None)
        depth = body.validated_data.get("depth") or (config.depth if config else "standard")
        sources = body.validated_data.get("sources") or (config.sources if config and config.sources else None)
        sources = sources or list(registry.PROVIDERS)
        unknown = [s for s in sources if s not in registry.PROVIDERS and s not in registry.UNAVAILABLE_SOURCES]
        if unknown:
            raise ValidationError({"sources": f"Unknown sources: {', '.join(unknown)}."})
        queries = [{"text": q.text, "intent": q.intent} for q in project.queries.filter(enabled=True)]
        if not queries and hasattr(project, "idea"):
            queries = [{"text": project.idea.original_description[:200], "intent": "problem_discovery"}]
        snapshot = {
            "sources": sources,
            # What could actually run at launch time (docs/data-sources.md: availability per job).
            "availability": {
                k: (registry.PROVIDERS[k].availability().value if k in registry.PROVIDERS else "UNAVAILABLE") for k in sources
            },
            "queries": queries,
            "exclude_terms": config.exclude_terms if config else [],
            "evidence_urls": config.evidence_urls if config else [],
            "competitor_urls": config.competitor_urls if config else [],
            "competitor_discovery": config.competitor_discovery if config else True,
        }
        if not can_run(snapshot):
            # Don't charge credits for a job that can't search anything.
            raise ValidationError(
                {"sources": "None of the selected sources can run. Add links for the link-based sources or pick a search source."}
            )
        cost = credits_for(depth)
        try:
            with transaction.atomic():
                # Lock the project so two launches with different keys can't both pass the draft check.
                locked = Project.objects.select_for_update().get(pk=project.pk)
                # Draft = first run; completed = re-run (new report in the history). Never two at once.
                if locked.status not in (Project.Status.DRAFT, Project.Status.COMPLETED):
                    return Response(
                        {"error": {"code": "not_draft", "message": "This project already has research running."}},
                        status=status.HTTP_409_CONFLICT,
                    )
                # Plan limits are checked under a lock on the user, so two launches can't both slip past the caps.
                User.objects.select_for_update().get(pk=request.user.pk)
                check_launch(request.user, depth)
                first = not ResearchJob.objects.filter(project__owner=request.user).exists()
                job = ResearchJob.objects.create(
                    project=locked,
                    depth=depth,
                    idempotency_key=key,
                    credits_charged=cost,
                    config_snapshot=snapshot,
                )
                spend_credits(request.user, cost, "research_job", job=job)
                create_stages(job)
                locked.status = Project.Status.RESEARCHING
                locked.save(update_fields=["status"])
        except InsufficientCredits as exc:
            return Response(
                {"error": {"code": "insufficient_credits", "message": str(exc)}},
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )
        except PlanLimit as exc:
            return Response(
                {"error": {"code": exc.code, "message": exc.message}},
                status=status.HTTP_403_FORBIDDEN if exc.code == "plan_depth" else status.HTTP_429_TOO_MANY_REQUESTS,
            )
        track("first_research_started" if first else "research_started", user=request.user, props={"depth": depth})
        transaction.on_commit(lambda: run_research_job.delay(str(job.id)))
        return Response(ResearchJobSerializer(job).data, status=status.HTTP_201_CREATED)


class EstimateView(APIView):
    """GET /research/estimate?project=<id>&depth=<quick|standard|deep> — credits before you launch."""

    def get(self, request):
        depth = request.query_params.get("depth") or "standard"
        if depth not in ResearchJob.Depth.values:
            raise ValidationError({"depth": f"Must be one of {', '.join(ResearchJob.Depth.values)}."})
        raw_project = request.query_params.get("project")
        if raw_project:
            # Owner isolation: estimates only for your own projects.
            project_id = parse_uuid(raw_project)
            if project_id is None or not Project.objects.filter(pk=project_id, owner=request.user).exists():
                raise NotFound("Project not found.")
        cost = credits_for(depth)
        balance = request.user.credits
        limits = limits_for(request.user)
        return Response(
            {
                "depth": depth,
                "credits": cost,
                "balance": balance,
                "balance_after": balance - cost,
                "sufficient": balance >= cost,
                # Depth allowed on this account's plan (enforced again at launch).
                "allowed": depth in limits["depths"],
                "plan": limits["plan"],
                # Search budget only: the internal spend cap (max_usd) is never sent to clients.
                "budget": {k: v for k, v in DEPTH_BUDGETS[depth].items() if k != "max_usd"},
            }
        )
