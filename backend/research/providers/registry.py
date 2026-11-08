from research.providers.base import ResearchProvider
from research.providers.hackernews import HackerNewsProvider
from research.providers.web_search import WebSearchProvider

# Only providers marked ✅ in docs/data-sources.md belong here.
PROVIDERS: dict[str, ResearchProvider] = {p.key: p for p in [WebSearchProvider(), HackerNewsProvider()]}

# Shown in the UI as unavailable so users see what is NOT searched.
UNAVAILABLE_SOURCES = {
    "reddit": "Requires a commercial data agreement with Reddit. Not included.",
    "review_sites": "G2 / Capterra / Trustpilot need licensed data. Not included.",
}


def get(key: str) -> ResearchProvider:
    return PROVIDERS[key]
