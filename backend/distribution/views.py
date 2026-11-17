"""GET /projects/{id}/distribution — where to find your customers; POST …/refresh — look up YouTube + keyword demand."""

from __future__ import annotations

from django.core.cache import cache
from django.db.models import F
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from distribution import keywords as kw
from distribution import youtube as yt
from distribution.models import KeywordMetric, ProviderCall, YouTubeChannel
from monitoring.views import ApiKeysReadOnly, _owned_project

LOCK_SECONDS = 300  # above the worst case of every provider call timing out and retrying


def _last(project, provider: str) -> dict | None:
    c = ProviderCall.objects.filter(project=project, provider=provider).order_by("-created_at").first()
    return {"status": c.status, "note": c.note, "at": c.created_at} if c else None


def _searches(project) -> list[str]:
    """The YouTube searches behind the stored channels (from the look-up that stored them)."""
    c = (
        ProviderCall.objects.filter(project=project, provider="youtube", details__has_key="searches")
        .order_by("-created_at")
        .only("details")
        .first()
    )
    return list((c.details or {}).get("searches", [])) if c else []


def _report_part(project) -> dict:
    """Channels and the first-10 plan from the latest report, plus the evidence they cite (from its snapshot)."""
    from reports.models import Report

    r = Report.objects.filter(project=project).order_by("-created_at").only("id", "created_at", "content").first()
    if r is None:
        return {"report": None, "channels": [], "first_ten_plan": [], "evidence": {}}
    dist = r.content.get("distribution") or {}
    channels, plan = dist.get("channels") or [], dist.get("first_ten_plan") or []
    ids = {str(i) for c in channels for i in c.get("evidence_ids", [])[:5]} | {str(i) for s in plan for i in s.get("evidence_ids", [])}
    index = r.content.get("evidence_index") or {}
    return {
        "report": {"id": r.id, "created_at": r.created_at},
        "channels": channels,
        "first_ten_plan": plan,
        "evidence": {k: v for k, v in index.items() if k in ids},
    }


class DistributionView(APIView):
    permission_classes = [permissions.IsAuthenticated, ApiKeysReadOnly]

    def get(self, request, project_pk: str):
        project = _owned_project(request, project_pk)
        now = timezone.now()
        channels = YouTubeChannel.objects.filter(project=project, expires_at__gt=now).order_by(
            F("latest_video_at").desc(nulls_last=True)
        )
        loc = kw.location_for(project)
        metrics = KeywordMetric.objects.filter(project=project, location_code=loc["code"], language_code=loc["language"])
        stale_before = now - timezone.timedelta(days=kw.CACHE_DAYS)
        return Response(
            {
                **_report_part(project),
                "youtube": {
                    "connected": yt.available(),
                    "last_check": _last(project, "youtube"),
                    "searches": _searches(project),
                    "channels": [
                        {
                            "channel_id": c.channel_id,
                            "title": c.title,
                            "url": f"https://www.youtube.com/channel/{c.channel_id}",
                            "subscriber_count": c.subscriber_count,
                            "subscribers_hidden": c.subscribers_hidden,
                            "video_count": c.video_count,
                            "latest_video": (
                                {
                                    "title": c.latest_video_title,
                                    "url": f"https://www.youtube.com/watch?v={c.latest_video_id}",
                                    "published_at": c.latest_video_at,
                                }
                                if c.latest_video_id
                                else None
                            ),
                            "matched_queries": c.matched_queries,
                            "fetched_at": c.fetched_at,
                            "expires_at": c.expires_at,
                        }
                        for c in channels[:30]
                    ],
                },
                "keywords": {
                    "connected": kw.available(),
                    "last_check": _last(project, "dataforseo"),
                    "location": loc,
                    "allowance": {"used": kw.used_this_month(request.user), "limit": kw.monthly_allowance(request.user)},
                    "rows": [
                        {
                            "keyword": m.keyword,
                            "search_volume": m.search_volume,
                            "cpc": str(m.cpc) if m.cpc is not None else None,
                            "competition": m.competition,
                            "difficulty": m.difficulty,
                            "monthly": m.monthly,
                            "source": m.source,
                            "fetched_at": m.fetched_at,
                            "stale": m.fetched_at < stale_before,
                        }
                        for m in metrics.order_by(F("search_volume").desc(nulls_last=True), "keyword")[:60]
                    ],
                },
            }
        )


class DistributionRefreshView(APIView):
    """Look up YouTube channels and keyword demand now. Web sessions only; throttled; one at a time per project."""

    permission_classes = [permissions.IsAuthenticated, ApiKeysReadOnly]
    throttle_scope = "distribution"

    def get_throttles(self):
        return [*super().get_throttles(), ScopedRateThrottle()]

    def post(self, request, project_pk: str):
        from reports.models import Report

        project = _owned_project(request, project_pk)
        if not Report.objects.filter(project=project).exists():
            return Response(
                {"error": {"code": "not_researched", "message": "Run research on this idea first: look-ups use its queries."}},
                status=400,
            )
        wanted = request.data.get("sources") if isinstance(request.data, dict) else None
        sources = [s for s in (wanted if isinstance(wanted, list) else ["youtube", "keywords"]) if s in ("youtube", "keywords")]
        if not sources:
            return Response({"error": {"code": "invalid", "message": "Pick youtube and/or keywords."}}, status=400)
        # One look-up per account at a time: allowances are checked and reserved per account, so parallel requests
        # across several projects can't each see the same remaining allowance.
        lock = f"distribution:refresh:user:{request.user.pk}"
        if not cache.add(lock, 1, LOCK_SECONDS):
            return Response({"error": {"code": "busy", "message": "A look-up is already running. Try again in a minute."}}, status=429)
        try:
            out = {}
            if "youtube" in sources:
                c = yt.refresh(project, request.user)
                out["youtube"] = {"status": c.status, "note": c.note}
            if "keywords" in sources:
                c = kw.refresh(project, request.user)
                out["keywords"] = {"status": c.status, "note": c.note}
        finally:
            cache.delete(lock)
        return Response(out)
