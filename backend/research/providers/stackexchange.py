"""Stack Exchange via the public API (https://api.stackexchange.com/docs).

Works without a key at a low shared quota (LIMITED); STACKEXCHANGE_API_KEY raises the quota.
Content is CC BY-SA: we keep the question link (attribution) with every excerpt.
"""

from __future__ import annotations

import html
import re
from datetime import UTC, datetime

import httpx
from django.conf import settings

from research.providers.base import Availability, Budget, EvidenceIn, ProviderError, QueryIn, RawResult, clip

API = "https://api.stackexchange.com/2.3/search/excerpts"
_TAG = re.compile(r"<[^>]+>")


class StackExchangeProvider:
    key = "stackexchange"
    label = "Stack Exchange"
    contributes = "Public Q&A where people describe problems and ask which tools to use."
    stage = "community_research"
    uses_queries = True

    def availability(self) -> Availability:
        return Availability.AVAILABLE if settings.STACKEXCHANGE_API_KEY else Availability.LIMITED

    def _site_for(self, query: QueryIn) -> str:
        # Developer-tool ideas fit Stack Overflow; everything else fits the general apps/startups sites.
        return "webapps" if query.intent in ("buying_intent", "customer_acquisition") else "stackoverflow"

    def search(self, query: QueryIn, budget: Budget) -> list[RawResult]:
        params = {
            "q": query.text,
            "site": self._site_for(query),
            "order": "desc",
            "sort": "relevance",
            "pagesize": min(budget.max_results, 30),
            "filter": "default",
        }
        if settings.STACKEXCHANGE_API_KEY:
            params["key"] = settings.STACKEXCHANGE_API_KEY
        try:
            resp = httpx.get(API, params=params, timeout=10)
            if resp.status_code >= 500:
                resp = httpx.get(API, params=params, timeout=10)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise ProviderError(f"stackexchange: {exc}") from exc
        body = resp.json()
        if body.get("error_id"):
            raise ProviderError(f"stackexchange: {body.get('error_name')}: {body.get('error_message')}")
        site = params["site"]
        return [RawResult(self.key, {**item, "_site": site}) for item in body.get("items", [])]

    def normalize(self, raw: RawResult) -> EvidenceIn:
        item = raw.data
        site = item.get("_site", "stackoverflow")
        qid = item.get("question_id")
        aid = item.get("answer_id")
        domain = "stackoverflow.com" if site == "stackoverflow" else f"{site}.stackexchange.com"
        url = f"https://{domain}/a/{aid}" if item.get("item_type") == "answer" and aid else f"https://{domain}/q/{qid}"
        text = html.unescape(_TAG.sub(" ", item.get("excerpt") or item.get("body") or ""))
        created = item.get("creation_date")
        return EvidenceIn(
            provider=self.key,
            source_url=url,
            title=html.unescape(item.get("title", "Stack Exchange question")),
            excerpt=clip(text),
            published_at=datetime.fromtimestamp(created, tz=UTC).date() if created else None,
            retrieved_at=datetime.now(UTC),
            extra={"license": "CC BY-SA", "site": site},
        )
