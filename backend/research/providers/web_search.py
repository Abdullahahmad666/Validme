"""General web search via the Brave Search API. Needs BRAVE_SEARCH_API_KEY."""

from __future__ import annotations

from datetime import UTC, datetime

import httpx
from django.conf import settings

from research.providers.base import Availability, Budget, EvidenceIn, ProviderError, QueryIn, RawResult, clip

API = "https://api.search.brave.com/res/v1/web/search"
COST_PER_QUERY_USD = 0.005  # list price; verify on Brave's pricing page and update


class WebSearchProvider:
    key = "web_search"
    label = "Web search"
    contributes = "Market demand, relevant articles, forums and competitor pages."
    stage = "web_research"
    uses_queries = True

    def availability(self) -> Availability:
        return Availability.AVAILABLE if settings.BRAVE_SEARCH_API_KEY else Availability.REQUIRES_CONNECTION

    def search(self, query: QueryIn, budget: Budget) -> list[RawResult]:
        if self.availability() != Availability.AVAILABLE:
            raise ProviderError("web_search: BRAVE_SEARCH_API_KEY not configured")
        headers = {"X-Subscription-Token": settings.BRAVE_SEARCH_API_KEY, "Accept": "application/json"}
        params = {"q": query.text, "count": min(budget.max_results, 20)}
        try:
            resp = httpx.get(API, params=params, headers=headers, timeout=10)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise ProviderError(f"web_search: {exc}") from exc
        budget.charge(COST_PER_QUERY_USD)
        return [RawResult(self.key, r) for r in resp.json().get("web", {}).get("results", [])]

    def normalize(self, raw: RawResult) -> EvidenceIn:
        r = raw.data
        return EvidenceIn(
            provider=self.key,
            source_url=r["url"],
            title=r.get("title", ""),
            excerpt=clip(r.get("description", "")),
            retrieved_at=datetime.now(UTC),
        )
