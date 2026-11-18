"""Radar API: /projects/{id}/signals (list, update status/feedback, mark seen, refresh) and /score-history."""

from __future__ import annotations

from django.db.models import Prefetch
from rest_framework import mixins, permissions, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from evidence.models import Evidence
from monitoring.views import ApiKeysReadOnly, _owned_project
from radar.models import ScoreSnapshot, Signal

MAX_EVIDENCE_SHOWN = 6


def _safe(url) -> str:
    return url if isinstance(url, str) and url.startswith(("https://", "http://")) else ""


URL_FACTS = ("page", "launch_post")  # facts that hold a URL: only http(s) ever leaves the API
REFRESH_LOCK_SECONDS = 120


class SignalSerializer(serializers.ModelSerializer):
    evidence = serializers.SerializerMethodField()
    evidence_count = serializers.SerializerMethodField()
    change = serializers.SerializerMethodField()
    candidate = serializers.SerializerMethodField()

    class Meta:
        model = Signal
        fields = [
            "id",
            "kind",
            "type",
            "title",
            "facts",
            "relevance",
            "impact",
            "confidence",
            "rank",
            "ai_rationale",
            "ai_action",
            "status",
            "feedback",
            "discovered_at",
            "evidence",
            "evidence_count",
            "change",
            "candidate",
        ]
        read_only_fields = [f for f in fields if f not in ("status", "feedback")]

    def to_representation(self, obj):
        data = super().to_representation(obj)
        facts = dict(data.get("facts") or {})
        for k in URL_FACTS:
            if k in facts:
                facts[k] = _safe(facts[k])
        data["facts"] = facts
        return data

    def get_evidence(self, obj):
        rows = getattr(obj, "shown_evidence", None)
        if rows is None:
            rows = obj.evidence.order_by("-relevance", "-id")[:MAX_EVIDENCE_SHOWN]
        return [
            {
                "id": e.id,
                "title": e.title,
                "excerpt": e.excerpt[:220],
                "source_url": _safe(e.source_url),
                "provider": e.provider,
                "published_at": e.published_at,
            }
            for e in rows
        ]

    def get_evidence_count(self, obj):
        n = getattr(obj, "evidence_total", None)
        return n if n is not None else obj.evidence.count()

    def get_change(self, obj):
        c = obj.change
        if c is None:
            return None
        return {"id": c.pk, "summary": c.summary, "detected_at": c.detected_at, "page": _safe(c.watch.url)}

    def get_candidate(self, obj):
        k = obj.candidate
        if k is None:
            return None
        return {"id": k.pk, "name": k.name, "domain": k.domain, "launch_post": _safe(k.source_url)}

    def validate_status(self, value):
        if value == Signal.Status.NEW:
            raise serializers.ValidationError("A signal can't be marked new again.")
        return value


class SignalViewSet(mixins.ListModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """/projects/{id}/signals[?status=open|new|seen|dismissed|acted|all&type=] — strongest first.
    PATCH {status: seen|dismissed|acted, feedback: useful|not_useful|""}. MCP keys are read-only."""

    serializer_class = SignalSerializer
    permission_classes = [permissions.IsAuthenticated, ApiKeysReadOnly]
    http_method_names = ["get", "post", "patch", "head", "options"]
    # Keys with monitoring:write may PATCH a signal's status (seen / acted / dismissed + feedback); nothing else.
    api_key_write_scope = "monitoring:write"
    api_key_write_methods = ("PATCH",)
    throttle_scope = "radar_refresh"

    def get_throttles(self):
        if self.action == "refresh":
            return [*super().get_throttles(), ScopedRateThrottle()]
        return super().get_throttles()

    def _project(self):
        if not hasattr(self, "_project_cache"):
            self._project_cache = _owned_project(self.request, self.kwargs["project_pk"])
        return self._project_cache

    def get_queryset(self):
        from django.db.models import Count

        qs = Signal.objects.filter(project=self._project())
        if self.action != "list":
            return qs  # PATCH works on any of this project's signals (feedback on acted/dismissed ones too)
        p = self.request.query_params
        status = p.get("status", "open")
        if status == "open":
            qs = qs.filter(status__in=(Signal.Status.NEW, Signal.Status.SEEN))
        elif status in Signal.Status.values:
            qs = qs.filter(status=status)
        elif status != "all":
            qs = qs.filter(status__in=(Signal.Status.NEW, Signal.Status.SEEN))
        if p.get("type") in Signal.Type.values:
            qs = qs.filter(type=p["type"])
        shown = Evidence.objects.only("id", "title", "excerpt", "source_url", "provider", "published_at", "relevance")
        shown = shown.order_by("-relevance", "-id")[:MAX_EVIDENCE_SHOWN]  # sliced prefetch (Django ≥ 4.2)
        qs = (
            qs.select_related("change__watch", "candidate")
            .annotate(evidence_total=Count("evidence"))
            .order_by("-rank", "-discovered_at", "-id")
        )
        return qs.prefetch_related(Prefetch("evidence", queryset=shown, to_attr="shown_evidence"))

    @action(detail=False, methods=["post"])
    def seen(self, request, project_pk=None):
        """POST {ids: [...]} — mark these new signals as seen (only this project's)."""
        raw = request.data.get("ids") if isinstance(request.data, dict) else None
        ids = [i for i in raw if type(i) is int][:200] if isinstance(raw, list) else []
        n = Signal.objects.filter(project=self._project(), pk__in=ids, status=Signal.Status.NEW).update(status=Signal.Status.SEEN)
        return Response({"updated": n})

    @action(detail=False, methods=["post"])
    def refresh(self, request, project_pk=None):
        """Re-score from stored evidence and look for new signals now (no new research, no credits)."""
        from django.core.cache import cache

        from radar import services
        from radar.tasks import enqueue_rationales

        project = self._project()
        lock = f"radar:refresh:{project.pk}"
        if not cache.add(lock, 1, REFRESH_LOCK_SECONDS):  # one check per project at a time
            return Response({"error": {"code": "busy", "message": "A check is already running for this project."}}, status=429)
        try:
            result = services.revalidate(project)
        finally:
            cache.delete(lock)
        enqueue_rationales(project.pk)
        return Response(result)


class ScoreHistoryView(APIView):
    """GET /projects/{id}/score-history — score snapshots, newest first (max 104: two years of weeks)."""

    def get(self, request, project_pk: str):
        project = _owned_project(request, project_pk)
        rows = ScoreSnapshot.objects.filter(project=project).values(
            "id", "created_at", "source", "score", "confidence", "recommendation", "evidence_count", "report_id", "scoring_version"
        )[:104]
        return Response({"count": len(rows), "results": list(rows)})
