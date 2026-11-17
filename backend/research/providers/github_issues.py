"""GitHub issues via the public REST search API (https://docs.github.com/en/rest/search/search#search-issues-and-pull-requests).

Public issues only (no pull requests), from the last two years: where developers describe bugs, missing features and
workarounds in tools they use. Works without a token at GitHub's low unauthenticated search limit (LIMITED);
GITHUB_TOKEN (a fine-grained token with no permissions is enough for public data) raises it. Each record links to
the issue itself; the author is kept only as a hash.
"""

from __future__ import annotations

import hashlib
import re
from datetime import UTC, date, datetime, timedelta

import httpx
from django.conf import settings
from django.core.cache import cache

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

API = "https://api.github.com/search/issues"
LOOKBACK_DAYS = 730
MAX_QUERY_CHARS = 180  # GitHub rejects search queries longer than 256 characters, qualifiers included
RATE_LIMIT_PAUSE = 60  # seconds: after a 403/429, skip GitHub instead of hitting the limit again for every query
_QUALIFIER = re.compile(r"\S+:\S*")  # repo:x/y, is:pr, user:… — query text must not change the search scope
_OPERATOR = re.compile(r"\b(AND|OR|NOT)\b|[()\"]")
_MD = [
    (re.compile(r"<!--.*?-->", re.S), " "),  # issue-template comments
    (re.compile(r"```.*?```", re.S), " "),  # code blocks
    (re.compile(r"!\[[^\]]*\]\([^)]*\)"), " "),  # images
    (re.compile(r"\[([^\]]*)\]\([^)]*\)"), r"\1"),  # links → their text
    (re.compile(r"(?m)^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+"), ""),  # headings, quotes, list markers
    (re.compile(r"[*_`~]{1,3}"), ""),  # emphasis and inline code marks
]


def clean_query(text: str) -> str:
    """Plain search words only: qualifiers and boolean operators from the founder's query text are dropped."""
    text = _OPERATOR.sub(" ", _QUALIFIER.sub(" ", text))
    return " ".join(text.split())[:MAX_QUERY_CHARS]


def strip_markdown(text: str) -> str:
    for pattern, repl in _MD:
        text = pattern.sub(repl, text)
    return text


def _headers() -> dict[str, str]:
    h = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": f"{settings.VALIDME_BRAND}-research",
    }
    if settings.GITHUB_TOKEN:
        h["Authorization"] = f"Bearer {settings.GITHUB_TOKEN}"
    return h


def _repo(url: str) -> str:
    """'owner/name' from https://api.github.com/repos/owner/name."""
    return url.split("/repos/", 1)[-1] if "/repos/" in url else ""


class GitHubIssuesProvider:
    key = "github_issues"
    label = "GitHub issues"
    contributes = "Public issues where developers report bugs, missing features and workarounds in the tools they use."
    stage = "community_research"
    uses_queries = True

    def availability(self) -> Availability:
        return Availability.AVAILABLE if settings.GITHUB_TOKEN else Availability.LIMITED

    def search(self, query: QueryIn, budget: Budget) -> list[RawResult]:
        if cache.get("github_issues:paused"):
            raise ProviderError("github_issues: rate limited by the source (paused for a minute)")
        text = clean_query(query.text)
        if not text:
            return []
        since = (date.today() - timedelta(days=LOOKBACK_DAYS)).isoformat()
        # interactions:>0 = someone else commented or reacted: a one-off note nobody engaged with isn't a signal.
        params = {"q": f"{text} is:issue is:public interactions:>0 created:>{since}", "per_page": min(budget.max_results, 50)}
        try:
            resp = httpx.get(API, params=params, headers=_headers(), timeout=10, trust_env=False)
            if resp.status_code >= 500:
                resp = httpx.get(API, params=params, headers=_headers(), timeout=10, trust_env=False)
            resp.raise_for_status()
            body = resp.json()
        except httpx.HTTPError as exc:
            # 403/429 here is GitHub's rate limit for search (much lower without a token): pause the provider.
            if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code in (403, 429):
                cache.set("github_issues:paused", 1, RATE_LIMIT_PAUSE)
            raise ProviderError(f"github_issues: {describe_http_error(exc)}") from exc
        except ValueError as exc:
            raise ProviderError("github_issues: the source returned an unreadable response") from exc
        items = body.get("items", []) if isinstance(body, dict) else []
        # Pull requests share this endpoint; is:issue excludes them, but check anyway.
        return [RawResult(self.key, it) for it in items if isinstance(it, dict) and "pull_request" not in it][: budget.max_results]

    def normalize(self, raw: RawResult) -> EvidenceIn:
        it = raw.data
        repo = _repo(it.get("repository_url", ""))
        login = (it.get("user") or {}).get("login") or ""
        created = it.get("created_at")
        body = strip_html(strip_markdown(it.get("body") or ""))
        title = it.get("title") or "GitHub issue"
        return EvidenceIn(
            provider=self.key,
            source_url=it.get("html_url") or "",
            title=f"{repo}: {title}" if repo else title,
            excerpt=clip(f"{title}. {body}" if body else title),
            published_at=datetime.fromisoformat(created.replace("Z", "+00:00")).date() if created else None,
            retrieved_at=datetime.now(UTC),
            author_hash=hashlib.sha256(login.encode()).hexdigest() if login else "",
            extra={"repository": repo, "comments": it.get("comments"), "state": it.get("state")},
        )
