"""YouTube Data API v3 (API key, public data only).

What we store follows the YouTube API Services Developer Policies:
- every row expires 29 days after we read it (the daily purge then removes it, so nothing is kept past 30 days,
  III.E.4), and a refresh replaces it;
- statistics are shown exactly as YouTube returns them: no derived metrics, no scores, no aggregation (III.E.2, III.E.4.h);
- our own facts (which of the project's searches found a channel) are kept apart and labelled as ours.
Quota: search.list costs 100 units, channels.list 1. A global daily budget keeps us under the project quota, a per-user
daily budget stops one account from using it all, and the day follows YouTube's (midnight Pacific time).
"""

from __future__ import annotations

import html
import logging
from datetime import timedelta
from zoneinfo import ZoneInfo

import httpx
from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from distribution.models import ProviderCall, YouTubeChannel
from research.providers.base import describe_http_error

logger = logging.getLogger(__name__)

API = "https://www.googleapis.com/youtube/v3"
SEARCH_UNITS = 100
CHANNELS_UNITS = 1
MAX_SEARCHES = 3  # per refresh: 300 units
RESULTS_PER_SEARCH = 25
LOOKBACK_DAYS = 365
RETENTION = timedelta(days=29)  # + up to a day until the daily purge = never more than 30 days
COOLDOWN = timedelta(hours=6)  # per project, after any look-up that spent quota
QUERY_INTENTS = ("customer_acquisition", "problem_discovery")
QUOTA_DAY = ZoneInfo("America/Los_Angeles")  # YouTube quotas reset at midnight Pacific time


class QuotaExceeded(Exception):
    pass


def available() -> bool:
    return bool(settings.YOUTUBE_API_KEY)


def _day_start():
    now = timezone.now().astimezone(QUOTA_DAY)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def units_used_today(user=None) -> int:
    qs = ProviderCall.objects.filter(provider="youtube", created_at__gte=_day_start())
    if user is not None:
        qs = qs.filter(user=user)
    return qs.aggregate(n=Sum("units"))["n"] or 0


def queries_for(project) -> list[str]:
    rows = list(project.queries.filter(enabled=True, intent__in=QUERY_INTENTS).values_list("text", flat=True)[:20])
    rows += list(project.queries.filter(enabled=True).exclude(intent__in=QUERY_INTENTS).values_list("text", flat=True)[:20])
    seen, out = set(), []
    for t in rows:
        t = " ".join(t.split())[:100]
        if t and t.lower() not in seen:
            seen.add(t.lower())
            out.append(t)
    if not out and hasattr(project, "idea"):
        out = [" ".join(project.idea.original_description.split())[:100]]
    return out[:MAX_SEARCHES]


def _get(path: str, params: dict) -> dict:
    """GET + JSON. Any failure is an httpx.HTTPError (or QuotaExceeded); the API key never appears in messages."""
    params = {**params, "key": settings.YOUTUBE_API_KEY}
    resp = httpx.get(f"{API}/{path}", params=params, timeout=10, trust_env=False)
    if resp.status_code >= 500:
        resp = httpx.get(f"{API}/{path}", params=params, timeout=10, trust_env=False)
    try:
        body = resp.json()
    except ValueError:
        body = None
    if resp.status_code == 403 and isinstance(body, dict):
        errors = (body.get("error") or {}).get("errors") or []
        if {e.get("reason") for e in errors if isinstance(e, dict)} & {"quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded"}:
            raise QuotaExceeded()
    resp.raise_for_status()
    if not isinstance(body, dict):
        raise httpx.DecodingError("not JSON", request=resp.request)
    return body


def _int(v) -> int | None:
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _text(v, limit: int) -> str:
    """YouTube returns titles HTML-escaped (&#39;); store the plain text."""
    return html.unescape(str(v or ""))[:limit]


def refresh(project, user) -> ProviderCall:
    """Search YouTube for the project's queries and store the channels behind the results (replacing older rows).

    The quota this run may spend is recorded on the ProviderCall *before* calling out, so parallel or interrupted
    runs are still counted; it's corrected to what was actually spent at the end."""
    call = ProviderCall.objects.create(user=user, project=project, provider="youtube", status=ProviderCall.Status.SKIPPED)

    def finish(status, note="", units=0, details=None):
        call.status, call.note, call.units, call.details = status, note[:200], units, details or {}
        call.save(update_fields=["status", "note", "units", "details"])
        return call

    if not available():
        return finish(ProviderCall.Status.REQUIRES_CONNECTION, "YouTube isn't connected (no API key).")
    last = (
        ProviderCall.objects.filter(project=project, provider="youtube", units__gt=0)
        .exclude(pk=call.pk)
        .order_by("-created_at")
        .first()
    )
    if last and timezone.now() - last.created_at < COOLDOWN:
        return finish(ProviderCall.Status.SKIPPED, "Checked in the last 6 hours.")
    queries = queries_for(project)
    if not queries:
        return finish(ProviderCall.Status.SKIPPED, "No search queries to look up.")
    needed = len(queries) * SEARCH_UNITS + 2 * CHANNELS_UNITS
    if units_used_today(user) + needed > settings.YOUTUBE_USER_DAILY_UNITS:
        return finish(ProviderCall.Status.LIMITED, "You've reached today's YouTube look-ups. Try again tomorrow.")
    if units_used_today() + needed > settings.YOUTUBE_DAILY_UNITS:
        return finish(ProviderCall.Status.LIMITED, "Today's YouTube look-ups are used up. Try again tomorrow.")
    call.units = needed  # reserve before calling out
    call.save(update_fields=["units"])

    since = (timezone.now() - timedelta(days=LOOKBACK_DAYS)).strftime("%Y-%m-%dT%H:%M:%SZ")
    found: dict[str, dict] = {}
    searched: list[str] = []
    units, failed, note = 0, 0, ""
    for q in queries:
        try:
            units += SEARCH_UNITS
            body = _get(
                "search",
                {
                    "part": "snippet",
                    "type": "video",
                    "q": q,
                    "maxResults": RESULTS_PER_SEARCH,
                    "order": "relevance",
                    "publishedAfter": since,
                    "safeSearch": "moderate",
                },
            )
        except QuotaExceeded:
            failed += 1
            note = "YouTube's daily quota is used up."
            break
        except httpx.HTTPError as exc:
            failed += 1
            note = f"YouTube: {describe_http_error(exc)}"
            continue
        searched.append(q)
        for item in body.get("items") or []:
            snip = (item or {}).get("snippet") or {}
            cid = snip.get("channelId")
            vid = ((item or {}).get("id") or {}).get("videoId")
            if not cid or not vid:
                continue
            row = found.setdefault(cid, {"queries": [], "latest": None})
            if q not in row["queries"]:
                row["queries"].append(q)
            at = parse_datetime(snip.get("publishedAt") or "")
            if at and (row["latest"] is None or at > row["latest"]["at"]):
                row["latest"] = {"at": at, "id": vid, "title": snip.get("title") or ""}

    if not searched:
        return finish(ProviderCall.Status.FAILED, note or "YouTube couldn't be searched.", units)

    stats: dict[str, dict] = {}
    ids = list(found)  # at most 3 searches × 25 results
    channel_failures = 0
    for i in range(0, len(ids), 50):
        try:
            units += CHANNELS_UNITS
            body = _get("channels", {"part": "snippet,statistics", "id": ",".join(ids[i : i + 50]), "maxResults": 50})
        except (QuotaExceeded, httpx.HTTPError) as exc:
            note = "YouTube's daily quota is used up." if isinstance(exc, QuotaExceeded) else f"YouTube: {describe_http_error(exc)}"
            channel_failures += 1
            continue
        for ch in body.get("items") or []:
            if isinstance(ch, dict) and ch.get("id"):
                stats[ch["id"]] = ch
    if ids and not stats:
        # Couldn't describe any channel: keep what we stored before rather than replacing it with nothing.
        return finish(ProviderCall.Status.FAILED, note or "YouTube channel details couldn't be read.", units, {"searches": searched})

    now = timezone.now()
    rows = []
    for cid, f in found.items():
        ch = stats.get(cid)
        if ch is None:
            continue  # no channel details: don't show a channel we can't describe
        s = ch.get("statistics") or {}
        latest = f["latest"] or {}
        hidden = bool(s.get("hiddenSubscriberCount"))
        rows.append(
            YouTubeChannel(
                project=project,
                channel_id=cid[:64],
                title=_text((ch.get("snippet") or {}).get("title"), 200),
                subscriber_count=None if hidden else _int(s.get("subscriberCount")),
                subscribers_hidden=hidden,
                video_count=_int(s.get("videoCount")),
                latest_video_id=(latest.get("id") or "")[:32],
                latest_video_title=_text(latest.get("title"), 300),
                latest_video_at=latest.get("at"),
                matched_queries=f["queries"],
                fetched_at=now,
                expires_at=now + RETENTION,
            )
        )
    with transaction.atomic():
        YouTubeChannel.objects.filter(project=project).delete()  # a refresh replaces what we stored before
        YouTubeChannel.objects.bulk_create(rows)
    partial = failed or channel_failures
    status = ProviderCall.Status.LIMITED if partial else ProviderCall.Status.OK
    summary = f"{len(rows)} channels from {len(searched)} search{'es' if len(searched) != 1 else ''}."
    return finish(status, f"{summary} {note}".strip() if partial else summary, units, {"searches": searched})


def purge_expired() -> int:
    """Delete YouTube data past its expiry (policy III.E.4: never kept more than 30 days). Runs daily."""
    n, _ = YouTubeChannel.objects.filter(expires_at__lte=timezone.now()).delete()
    return n
