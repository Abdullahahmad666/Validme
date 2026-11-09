"""Providers that read specific public pages instead of running search queries.

- user_urls: threads, reviews or articles the founder found and pasted in.
- competitor_pages: competitor websites the founder listed (pricing/feature pages).

Both store a verbatim excerpt of the page with its URL and retrieval date. They never crawl:
only the exact URLs given, fetched once each through the SSRF-safe fetcher.
"""

from __future__ import annotations

from datetime import UTC, datetime

from research.providers.base import Availability, Budget, EvidenceIn, ProviderError, QueryIn, RawResult, clip
from research.providers.fetch import BlockedURL, FetchError, extract_text, fetch_public_page


class _UrlPageProvider:
    key = ""
    label = ""
    contributes = ""
    stage = "web_research"
    config_key = ""  # which list in the job snapshot holds this provider's URLs
    uses_queries = False
    prefer_description = True  # competitor pages: the meta description is their own positioning

    def availability(self) -> Availability:
        return Availability.AVAILABLE

    def search(self, query: QueryIn, budget: Budget) -> list[RawResult]:  # pragma: no cover - not query-based
        return []

    def fetch_urls(self, urls: list[str], budget: Budget) -> tuple[list[RawResult], list[str]]:
        """Fetch each URL once. Returns (pages, problems). Raises ProviderError only if every URL failed."""
        pages: list[RawResult] = []
        problems: list[str] = []
        for url in urls[: budget.max_results]:
            try:
                page = fetch_public_page(url)
            except BlockedURL as exc:
                problems.append(f"{url}: skipped ({exc})")
                continue
            except FetchError as exc:
                problems.append(f"{url}: {exc}")
                continue
            title, description, text = extract_text(page.text)
            pages.append(RawResult(self.key, {"url": page.url, "title": title, "description": description, "text": text}))
        if urls and not pages:
            raise ProviderError(f"{self.key}: no page could be read ({'; '.join(problems)[:300]})")
        return pages, problems

    def normalize(self, raw: RawResult) -> EvidenceIn:
        d = raw.data
        # Excerpt is the page's own words. Threads/reviews: the visible text (the meta description is
        # often site boilerplate). Competitor pages: their meta description, then the visible text.
        excerpt = (d["description"] or d["text"]) if self.prefer_description else (d["text"] or d["description"])
        return EvidenceIn(
            provider=self.key,
            source_url=d["url"],
            title=d["title"] or d["url"],
            excerpt=clip(excerpt),
            retrieved_at=datetime.now(UTC),
        )


class UserUrlsProvider(_UrlPageProvider):
    key = "user_urls"
    label = "Links you add"
    contributes = "Threads, reviews or articles you found yourself."
    stage = "web_research"
    config_key = "evidence_urls"
    prefer_description = False


class CompetitorPagesProvider(_UrlPageProvider):
    key = "competitor_pages"
    label = "Competitor websites"
    contributes = "Public pricing and feature pages, with the date we read them."
    stage = "competitor_analysis"
    config_key = "competitor_urls"
