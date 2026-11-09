"""Stack Exchange via the public API (https://api.stackexchange.com/docs).

Works without a key at a low shared quota (LIMITED); STACKEXCHANGE_API_KEY raises the quota.
Content is CC BY-SA 4.0: every record keeps the question link, the author's name and profile
link, and the licence, so it can be shown with proper attribution.
"""

from __future__ import annotations

from datetime import UTC, datetime

import httpx
from django.conf import settings

from research.providers.base import (
    Availability,
    Budget,
    EvidenceIn,
    ProviderError,
    QueryIn,
    RawResult,
    clip,
    describe_http_error,
    strip_html,
)

# /search/advanced returns full questions with their owner (needed for attribution).
API = "https://api.stackexchange.com/2.3/search/advanced"
LICENSE = "CC BY-SA 4.0"

# Which community fits each intent. Software Recommendations is where people ask "what tool should
# I use for X?"; Web Applications is where non-developers describe day-to-day tool problems.
SITE_BY_INTENT = {
    "problem_discovery": "webapps",
    "buying_intent": "softwarerecs",
    "competitor_gaps": "softwarerecs",
    "customer_acquisition": "webapps",
}


class StackExchangeProvider:
    key = "stackexchange"
    label = "Stack Exchange"
    contributes = "Public Q&A where people describe problems and ask which tools to use."
    stage = "community_research"
    uses_queries = True

    def availability(self) -> Availability:
        return Availability.AVAILABLE if settings.STACKEXCHANGE_API_KEY else Availability.LIMITED

    def search(self, query: QueryIn, budget: Budget) -> list[RawResult]:
        site = SITE_BY_INTENT.get(query.intent, "webapps")
        params = {
            "q": query.text,
            "site": site,
            "order": "desc",
            "sort": "relevance",
            "pagesize": min(budget.max_results, 30),
            "filter": "withbody",
        }
        if settings.STACKEXCHANGE_API_KEY:
            params["key"] = settings.STACKEXCHANGE_API_KEY
        try:
            resp = httpx.get(API, params=params, timeout=10)
            if resp.status_code >= 500:
                resp = httpx.get(API, params=params, timeout=10)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise ProviderError(f"stackexchange: {describe_http_error(exc)}") from exc
        body = resp.json()
        if body.get("error_id"):
            raise ProviderError(f"stackexchange: {body.get('error_name')}: {body.get('error_message')}")
        return [RawResult(self.key, {**item, "_site": site}) for item in body.get("items", [])]

    def normalize(self, raw: RawResult) -> EvidenceIn:
        item = raw.data
        site = item.get("_site", "webapps")
        domain = "stackoverflow.com" if site == "stackoverflow" else f"{site}.stackexchange.com"
        url = item.get("link") or f"https://{domain}/q/{item.get('question_id')}"
        owner = item.get("owner") or {}
        created = item.get("creation_date")
        return EvidenceIn(
            provider=self.key,
            source_url=url,
            title=strip_html(item.get("title", "Stack Exchange question")),
            excerpt=clip(strip_html(item.get("body") or "")),
            published_at=datetime.fromtimestamp(created, tz=UTC).date() if created else None,
            retrieved_at=datetime.now(UTC),
            license=LICENSE,
            author_name=strip_html(owner.get("display_name", "")) or "deleted user",
            author_url=owner.get("link", ""),
            extra={"site": site},
        )
