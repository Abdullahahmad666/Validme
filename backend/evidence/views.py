from django.conf import settings
from django.db.models import Count, F, Q, Window
from django.db.models.functions import RowNumber
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from billing.plans import plan_for
from evidence.models import Category, Evidence, EvidenceCluster
from evidence.serializers import EvidenceClusterSerializer, EvidenceSerializer
from research.views import parse_uuid

CATEGORIES = set(Category.values)


def _project_filter(request):
    raw = request.query_params.get("project")
    if raw is None:
        return None
    project_id = parse_uuid(raw)
    if project_id is None:
        raise ValidationError({"project": "Not a valid project id."})
    return project_id


# Same order the explorer lists in, so the preview is the most relevant records.
RANKING = [F("relevance").desc(nulls_last=True), F("published_at").desc(nulls_last=True), F("id").desc()]


def preview_ids(user, project_id=None) -> list[int] | None:
    """Free plan: the ids a user may browse (top N originals per project). None = no limit.

    The report itself is never limited: every finding keeps its cited evidence (CLAUDE.md rule 1).
    """
    if plan_for(user) != "free":
        return None
    base = Evidence.objects.filter(project__owner=user, duplicate_of__isnull=True)
    if project_id:
        base = base.filter(project_id=project_id)
    ranked = base.annotate(rn=Window(RowNumber(), partition_by=[F("project_id")], order_by=RANKING)).filter(
        rn__lte=settings.EVIDENCE_PREVIEW_LIMIT
    )
    return list(ranked.values_list("id", flat=True))


class EvidenceViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """GET /evidence?project=&category=a,b&provider=&cluster=&q=&saved=1&duplicates=1

    Owner-isolated. Near-duplicates are hidden by default and counted on their original.
    Only `saved_by_user` can be changed; source text is never editable.
    """

    serializer_class = EvidenceSerializer
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        # Owner isolation: never remove this filter.
        qs = Evidence.objects.filter(project__owner=self.request.user).annotate(duplicates_count=Count("evidence", distinct=True))
        p = self.request.query_params
        project_id = _project_filter(self.request)
        if project_id:
            qs = qs.filter(project_id=project_id)
        if p.get("duplicates") != "1":
            qs = qs.filter(duplicate_of__isnull=True)
        if p.get("category"):
            cats = [c for c in p["category"].split(",") if c in CATEGORIES]
            qs = qs.filter(category__in=cats)
        if p.get("provider"):
            qs = qs.filter(provider=p["provider"])
        if p.get("cluster", "").isdigit() and len(p["cluster"]) <= 12:
            qs = qs.filter(clusters__id=int(p["cluster"]), clusters__project__owner=self.request.user)
        if p.get("saved") == "1":
            qs = qs.filter(saved_by_user=True)
        q = (p.get("q") or "").strip()[:100]
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(excerpt__icontains=q))
        # Free plan: filters and search work inside the preview, never beyond it (list, detail and save).
        scope = project_id
        if scope is None and self.kwargs.get("pk"):
            # Detail/save: rank only that record's project, not all of the user's evidence.
            scope = (
                Evidence.objects.filter(
                    pk=self.kwargs["pk"] if str(self.kwargs["pk"]).isdigit() else None, project__owner=self.request.user
                )
                .values_list("project_id", flat=True)
                .first()
            )
        self._preview = preview_ids(self.request.user, scope)
        if self._preview is not None:
            qs = qs.filter(Q(id__in=self._preview) | Q(duplicate_of_id__in=self._preview))
        return qs.order_by(*RANKING)

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        if getattr(self, "_preview", None) is not None:
            total = Evidence.objects.filter(project__owner=request.user, duplicate_of__isnull=True)
            project_id = _project_filter(request)
            if project_id:
                total = total.filter(project_id=project_id)
            response.data["preview"] = {
                "limited": True,
                "limit_per_project": settings.EVIDENCE_PREVIEW_LIMIT,
                "available": len(self._preview),
                "total": total.count(),
            }
        return response

    def update(self, request, *args, **kwargs):
        allowed = {"saved_by_user"}
        if not isinstance(request.data, dict) or set(request.data) - allowed:
            raise ValidationError({"detail": "Only saved_by_user can be changed."})
        kwargs["partial"] = True
        return super().update(request, *args, **kwargs)

    @action(detail=False)
    def facets(self, request):
        """Counts for the filter chips: by category and by provider (originals only)."""
        qs = Evidence.objects.filter(project__owner=request.user, duplicate_of__isnull=True)
        project_id = _project_filter(request)
        if project_id:
            qs = qs.filter(project_id=project_id)
        by_cat = dict(qs.values_list("category").annotate(n=Count("id")).values_list("category", "n"))
        by_provider = dict(qs.values_list("provider").annotate(n=Count("id")).values_list("provider", "n"))
        return Response(
            {
                "total": sum(by_cat.values()),
                "categories": by_cat,
                "providers": by_provider,
                "saved": qs.filter(saved_by_user=True).count(),
                "duplicates": Evidence.objects.filter(
                    project__owner=request.user, duplicate_of__isnull=False, **({"project_id": project_id} if project_id else {})
                ).count(),
            }
        )


class EvidenceClusterViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """GET /evidence/clusters?project= — themes with the evidence that supports them."""

    serializer_class = EvidenceClusterSerializer
    pagination_class = None  # ≤ 10 per project

    def get_queryset(self):
        qs = EvidenceCluster.objects.filter(project__owner=self.request.user).prefetch_related("evidence")
        project_id = _project_filter(self.request)
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs.order_by("-created_at", "id")
