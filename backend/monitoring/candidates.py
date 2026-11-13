"""New-competitor detection (Week 10): re-run the project's searches against recent product launches.

Source: Hacker News "Show HN" posts from the last 60 days (public Algolia API, no key, no AI). A result becomes a
candidate only if its product domain isn't already known for the project (competitors, watched pages, earlier
candidates, dismissed ones). The founder confirms (→ watch) or dismisses; nothing is watched automatically.
"""

from __future__ import annotations

import logging
import re
import time
from urllib.parse import urlsplit

import httpx
from django.db import IntegrityError, transaction
from django.utils import timezone

from monitoring.models import CompetitorCandidate, Watch
from research.providers.base import describe_http_error

logger = logging.getLogger(__name__)

API = "https://hn.algolia.com/api/v1/search"
LOOKBACK_DAYS = 60
MAX_QUERIES = 3
MAX_NEW_PER_RUN = 5
# Hosting, code, media and social sites: a link there is rarely the competitor's own product page.
GENERIC = {
    "github.com",
    "gitlab.com",
    "bitbucket.org",
    "youtube.com",
    "youtu.be",
    "medium.com",
    "substack.com",
    "twitter.com",
    "x.com",
    "linkedin.com",
    "reddit.com",
    "news.ycombinator.com",
    "producthunt.com",
    "apps.apple.com",
    "play.google.com",
    "chrome.google.com",
    "chromewebstore.google.com",
    "docs.google.com",
    "drive.google.com",
    "notion.site",
    "vercel.app",
    "netlify.app",
    "herokuapp.com",
    "pages.dev",
    "github.io",
    "wikipedia.org",
    "arxiv.org",
    "npmjs.com",
    "pypi.org",
}
_SHOW = re.compile(r"^\s*show hn\s*[:\-–]\s*", re.IGNORECASE)


def domain_of(url: str) -> str:
    host = (urlsplit(url).hostname or "").lower()
    return host[4:] if host.startswith("www.") else host


def _generic(domain: str) -> bool:
    return any(domain == g or domain.endswith("." + g) for g in GENERIC)


def known_domains(project) -> set[str]:
    from reports.models import Competitor

    known = {domain_of(u) for u in Competitor.objects.filter(project=project).exclude(website="").values_list("website", flat=True)}
    known |= {domain_of(u) for u in Watch.objects.filter(project=project).values_list("url", flat=True)}
    known |= set(CompetitorCandidate.objects.filter(project=project).values_list("domain", flat=True))
    return {d for d in known if d}


def _queries(project) -> list[str]:
    rows = list(project.queries.filter(enabled=True).values_list("text", "intent")[:20])
    # Competitor-gap queries first: they describe the product category best.
    rows.sort(key=lambda r: 0 if r[1] == "competitor_gaps" else 1)
    texts = [t for t, _ in rows if t]
    if not texts and hasattr(project, "idea"):
        texts = [project.idea.original_description[:120]]
    return texts[:MAX_QUERIES]


def _search(query: str) -> list[dict]:
    since = int(time.time()) - LOOKBACK_DAYS * 86400
    params = {"query": query, "tags": "show_hn", "numericFilters": f"created_at_i>{since}", "hitsPerPage": 20}
    try:
        resp = httpx.get(API, params=params, timeout=10, trust_env=False)
        resp.raise_for_status()
        body = resp.json()
    except httpx.HTTPError as exc:
        logger.info("candidate search failed: %s", describe_http_error(exc))
        return []
    except ValueError:
        logger.info("candidate search returned a non-JSON body")
        return []
    hits = body.get("hits") if isinstance(body, dict) else None
    return [h for h in hits if isinstance(h, dict)] if isinstance(hits, list) else []


def detect(project, search=_search) -> int:
    """Find new candidates for one project. Returns how many were added."""
    known = known_domains(project)
    added = 0
    for query in _queries(project):
        for hit in search(query):
            url = hit.get("url") or ""
            if urlsplit(url).scheme not in ("http", "https"):
                continue
            domain = domain_of(url)
            if not domain or domain in known or _generic(domain):
                continue
            name = _SHOW.sub("", hit.get("title") or "")[:200] or domain
            try:
                with transaction.atomic():
                    CompetitorCandidate.objects.create(
                        project=project,
                        domain=domain[:200],
                        name=name,
                        url=url[:500],
                        source_url=f"https://news.ycombinator.com/item?id={hit.get('objectID', '')}",
                        source="hackernews",
                        found_at=timezone.now(),
                    )
            except IntegrityError:
                known.add(domain)  # found concurrently: not counted as new
                continue
            known.add(domain)
            added += 1
            if added >= MAX_NEW_PER_RUN:
                return added
    return added
