"""Hacker News via the public Algolia HN Search API (https://hn.algolia.com/api)."""

from __future__ import annotations

import hashlib
import html
import re
from datetime import UTC, datetime

import httpx

from research.providers.base import Availability, Budget, EvidenceIn, ProviderError, QueryIn, RawResult, clip

API = "https://hn.algolia.com/api/v1/search"
_TAG = re.compile(r"<[^>]+>")


class HackerNewsProvider:
    key = "hackernews"
    label = "Hacker News"
    contributes = "Founder and developer discussions, complaints and tool recommendations."
    stage = "community_research"
    uses_queries = True

    def availability(self) -> Availability:
        return Availability.AVAILABLE

    def search(self, query: QueryIn, budget: Budget) -> list[RawResult]:
        params = {"query": query.text, "tags": "(story,comment)", "hitsPerPage": min(budget.max_results, 50)}
        try:
            resp = httpx.get(API, params=params, timeout=10)
            if resp.status_code >= 500:
                resp = httpx.get(API, params=params, timeout=10)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise ProviderError(f"hackernews: {exc}") from exc
        return [RawResult(self.key, hit) for hit in resp.json().get("hits", [])]

    def normalize(self, raw: RawResult) -> EvidenceIn:
        hit = raw.data
        object_id = hit.get("objectID", "")
        text = hit.get("comment_text") or hit.get("story_text") or hit.get("title") or ""
        text = html.unescape(_TAG.sub(" ", text))
        created = hit.get("created_at")
        author = hit.get("author") or ""
        return EvidenceIn(
            provider=self.key,
            source_url=f"https://news.ycombinator.com/item?id={object_id}",
            title=hit.get("title") or hit.get("story_title") or "Hacker News comment",
            excerpt=clip(text),
            published_at=datetime.fromisoformat(created.replace("Z", "+00:00")).date() if created else None,
            retrieved_at=datetime.now(UTC),
            author_hash=hashlib.sha256(author.encode()).hexdigest() if author else "",
        )
