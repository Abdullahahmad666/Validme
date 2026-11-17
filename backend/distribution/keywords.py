"""Keyword demand from DataForSEO (licensed; Google Ads search volume + DataForSEO Labs keyword difficulty).

Paid per request, so: a per-plan monthly allowance of keywords per account, a global monthly budget, and a 30-day
cache per project (a keyword looked up in the last 30 days isn't fetched again). Figures are stored exactly as the
provider returns them; a keyword without a figure stays "unavailable", never 0.
"""

from __future__ import annotations

import logging
import re
from datetime import timedelta
from decimal import Decimal

import httpx
from django.conf import settings
from django.db.models import Sum
from django.utils import timezone

from billing.models import UsageTransaction
from distribution.models import KeywordMetric, ProviderCall
from research.providers.base import describe_http_error

logger = logging.getLogger(__name__)

API = "https://api.dataforseo.com/v3"
VOLUME = f"{API}/keywords_data/google_ads/search_volume/live"
DIFFICULTY = f"{API}/dataforseo_labs/google/bulk_keyword_difficulty/live"
CACHE_DAYS = 30
MAX_PER_REFRESH = 20
MAX_WORDS = 10  # Google Ads limits keywords to 10 words / 80 characters
MAX_CHARS = 80

# Market (as the founder wrote it) → DataForSEO location. Searches are looked up in English everywhere because the
# queries are written in English. Anything else uses the default location, and the page says so.
LOCATIONS = {
    "us": (2840, "en", "the United States"),
    "usa": (2840, "en", "the United States"),
    "united states": (2840, "en", "the United States"),
    "uk": (2826, "en", "the United Kingdom"),
    "united kingdom": (2826, "en", "the United Kingdom"),
    "gb": (2826, "en", "the United Kingdom"),
    "england": (2826, "en", "the United Kingdom"),
    "canada": (2124, "en", "Canada"),
    "australia": (2036, "en", "Australia"),
    "ireland": (2372, "en", "Ireland"),
    "new zealand": (2554, "en", "New Zealand"),
    "india": (2356, "en", "India"),
    "germany": (2276, "en", "Germany"),
    "france": (2250, "en", "France"),
    "spain": (2724, "en", "Spain"),
}
DEFAULT_LOCATION = (2840, "en", "the United States")
_CLEAN = re.compile(r"[^\w\s'-]+", re.UNICODE)


def available() -> bool:
    return bool(settings.DATAFORSEO_LOGIN and settings.DATAFORSEO_PASSWORD)


def location_for(project) -> dict:
    market = getattr(project, "market", None) if hasattr(project, "market") else None
    for g in (market.geographies if market else []) or []:
        hit = LOCATIONS.get(str(g).strip().lower())
        if hit:
            return {"code": hit[0], "language": hit[1], "label": hit[2], "default": False}
    code, lang, label = DEFAULT_LOCATION
    return {"code": code, "language": lang, "label": label, "default": True}


def clean(text: str) -> str:
    words = _CLEAN.sub(" ", text.lower()).split()
    if not words or len(words) > MAX_WORDS:
        return ""
    k = " ".join(words)
    return k if len(k) <= MAX_CHARS else ""


def keywords_for(project) -> list[str]:
    """Short search phrases from the project's queries (long sentences have no keyword data)."""
    seen, out = set(), []
    for text in project.queries.filter(enabled=True).order_by("intent", "created_at").values_list("text", flat=True)[:60]:
        k = clean(text)
        if k and k not in seen:
            seen.add(k)
            out.append(k)
    return out


def monthly_allowance(user) -> int:
    from billing.plans import plan_for

    return int(settings.KEYWORD_LOOKUPS_MONTHLY.get(plan_for(user), 0))


def _month_start():
    return timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def used_this_month(user) -> int:
    return (
        ProviderCall.objects.filter(user=user, provider="dataforseo", created_at__gte=_month_start()).aggregate(n=Sum("units"))["n"]
        or 0
    )


def spent_this_month() -> Decimal:
    return ProviderCall.objects.filter(provider="dataforseo", created_at__gte=_month_start()).aggregate(c=Sum("cost_usd"))[
        "c"
    ] or Decimal("0")


def _post(url: str, keywords: list[str], loc: dict) -> dict:
    payload = [{"keywords": keywords, "location_code": loc["code"], "language_code": loc["language"]}]
    auth = (settings.DATAFORSEO_LOGIN, settings.DATAFORSEO_PASSWORD)
    resp = httpx.post(url, json=payload, auth=auth, timeout=30, trust_env=False)
    if resp.status_code >= 500:
        resp = httpx.post(url, json=payload, auth=auth, timeout=30, trust_env=False)
    resp.raise_for_status()
    body = resp.json()
    task = (body.get("tasks") or [{}])[0]
    if body.get("status_code") != 20000 or task.get("status_code") != 20000:
        raise ValueError(f"DataForSEO status {task.get('status_code') or body.get('status_code')}")
    return body


def _dec(v) -> Decimal | None:
    try:
        return Decimal(str(v)).quantize(Decimal("0.01")) if v is not None else None
    except (ArithmeticError, ValueError):
        return None


def refresh(project, user) -> ProviderCall:
    # Created first and counted from the start, so parallel or interrupted look-ups can't exceed allowances.
    call = ProviderCall.objects.create(user=user, project=project, provider="dataforseo", status=ProviderCall.Status.SKIPPED)

    def done(status, note="", units=0, cost=Decimal("0")):
        call.status, call.note, call.units, call.cost_usd = status, note[:200], units, cost
        call.save(update_fields=["status", "note", "units", "cost_usd"])
        return call

    if not available():
        return done(ProviderCall.Status.REQUIRES_CONNECTION, "Keyword data isn't connected.")
    loc = location_for(project)
    fresh_after = timezone.now() - timedelta(days=CACHE_DAYS)
    fresh = set(
        KeywordMetric.objects.filter(
            project=project, location_code=loc["code"], language_code=loc["language"], fetched_at__gte=fresh_after
        ).values_list("keyword", flat=True)
    )
    todo = [k for k in keywords_for(project) if k not in fresh]
    if not todo:
        return done(ProviderCall.Status.SKIPPED, "Every keyword was looked up in the last 30 days.")
    remaining = monthly_allowance(user) - used_this_month(user)
    if remaining <= 0:
        return done(ProviderCall.Status.LIMITED, "This month's keyword look-ups are used up.")
    if spent_this_month() >= Decimal(str(settings.DATAFORSEO_MONTHLY_BUDGET_USD)):
        logger.warning("DataForSEO monthly budget reached")
        return done(ProviderCall.Status.LIMITED, "Keyword look-ups are paused until next month.")
    batch = todo[: min(remaining, MAX_PER_REFRESH)]
    call.units = len(batch)  # reserve the allowance before paying for anything
    call.save(update_fields=["units"])

    try:
        volume = _post(VOLUME, batch, loc)
    except (httpx.HTTPError, ValueError) as exc:
        note = describe_http_error(exc) if isinstance(exc, httpx.HTTPError) else "the provider returned an error"
        return done(ProviderCall.Status.FAILED, f"Keyword data: {note}")
    cost = Decimal(str(volume.get("cost") or 0))
    difficulty: dict[str, int] = {}
    partial = ""
    try:
        diff = _post(DIFFICULTY, batch, loc)
        cost += Decimal(str(diff.get("cost") or 0))
        for res in diff["tasks"][0].get("result") or []:
            for it in (res or {}).get("items") or []:
                if isinstance(it, dict) and isinstance(it.get("keyword_difficulty"), int):
                    difficulty[str(it.get("keyword", "")).lower()] = it["keyword_difficulty"]
    except (httpx.HTTPError, ValueError, KeyError, IndexError) as exc:
        partial = "difficulty unavailable this time"
        logger.info(
            "keyword difficulty failed: %s", describe_http_error(exc) if isinstance(exc, httpx.HTTPError) else type(exc).__name__
        )

    now = timezone.now()
    rows = {str(r.get("keyword", "")).lower(): r for r in (volume["tasks"][0].get("result") or []) if isinstance(r, dict)}
    no_figure = sum(1 for k in batch if not isinstance(rows.get(k, {}).get("search_volume"), int))
    for k in batch:
        r = rows.get(k, {})
        monthly = sorted(
            (
                {"year": m.get("year"), "month": m.get("month"), "volume": m.get("search_volume")}
                for m in (r.get("monthly_searches") or [])
                if isinstance(m, dict) and m.get("year") and m.get("month")
            ),
            key=lambda m: (m["year"], m["month"]),
        )
        KeywordMetric.objects.update_or_create(
            project=project,
            keyword=k,
            location_code=loc["code"],
            language_code=loc["language"],
            defaults={
                "search_volume": r.get("search_volume") if isinstance(r.get("search_volume"), int) else None,
                "cpc": _dec(r.get("cpc")),
                "competition": str(r.get("competition") or "")[:10],
                "difficulty": difficulty.get(k),
                "monthly": monthly[-12:],
                "source": "dataforseo",
                "fetched_at": now,
            },
        )
    # Real provider cost on the ledger (0 credits) for unit economics; never shown to users.
    UsageTransaction.objects.create(user=user, operation="keyword_data", credits=0, cost_usd=cost)
    status = ProviderCall.Status.LIMITED if partial or len(batch) < len(todo) else ProviderCall.Status.OK
    note = (
        f"{len(batch)} keywords looked up"
        + (f"; {no_figure} had no search figure" if no_figure else "")
        + (f"; {partial}" if partial else "")
        + (f"; {len(todo) - len(batch)} left for the next look-up" if len(batch) < len(todo) else "")
    )
    return done(status, note, units=len(batch), cost=cost)
