"""Audience segments, channels and the first-10-customers plan, built from stored evidence.

Deterministic on purpose: a channel is "researched" only when classified evidence from that place
shows people discussing the problem. Everything else is labelled a hypothesis with no evidence
count. Nothing here contacts anyone (CLAUDE.md rule 8: no automated outreach).
"""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from urllib.parse import urlsplit

from evidence.models import Category, Evidence, EvidenceCluster

# Categories that say something about the problem; positive feedback and irrelevant don't place an audience.
SIGNAL = {
    Category.PAIN_POINT,
    Category.FEATURE_REQUEST,
    Category.ALTERNATIVE_SEEKING,
    Category.PRICING_OBJECTION,
    Category.BUYING_INTENT,
    Category.WORKAROUND,
}
# Competitors' own pages tell us about competitors, not where customers talk.
NOT_A_CHANNEL = {"competitor_pages"}
STOPWORDS = {"and", "the", "for", "with", "who", "that", "from", "their", "small", "large", "teams", "team", "people", "users"}


def signal_items(items: list[Evidence]) -> list[Evidence]:
    """Classified evidence that describes the problem. Unclassified hits never place an audience."""
    return [e for e in items if e.classifier_version and e.category in SIGNAL and e.provider not in NOT_A_CHANNEL]


def _host(url: str) -> str:
    host = (urlsplit(url).hostname or "").lower()
    return host[4:] if host.startswith("www.") else host


def channel_of(e: Evidence) -> tuple[str, str]:
    """(key, display name) for where a record was published."""
    if e.provider == "hackernews":
        return "news.ycombinator.com", "Hacker News"
    host = _host(e.source_url)
    if e.provider == "stackexchange" and host.endswith(".stackexchange.com"):
        return host, f"Stack Exchange: {host.removesuffix('.stackexchange.com')}"
    return host, host


def _level(n: int) -> str:
    return "high" if n >= 5 else "medium" if n >= 2 else "low"


def researched_channels(items: list[Evidence]) -> list[dict]:
    groups: dict[str, list[Evidence]] = defaultdict(list)
    names: dict[str, str] = {}
    for e in signal_items(items):
        key, name = channel_of(e)
        if key:
            groups[key].append(e)
            names[key] = name
    out = []
    for key, members in groups.items():
        cats = Counter(e.category for e in members)
        dated = [e.published_at for e in members if e.published_at]
        threads = len({e.source_url for e in members})
        top = cats.most_common(1)[0][0]
        out.append(
            {
                "key": key,
                "name": names[key],
                "is_hypothesis": False,
                "evidence_count": len(members),
                "threads": threads,
                "latest": max(dated).isoformat() if dated else None,
                "categories": dict(cats),
                "relevance": _level(threads),
                "recommendation": (
                    f"{threads} thread{'s' if threads != 1 else ''} here discuss the problem, mostly as "
                    f"{Category(top).label.lower()}. Read them, reply where the discussion is still open, and ask "
                    "follow-up questions in public. Don't post promotional links."
                ),
                "evidence_ids": [e.id for e in sorted(members, key=lambda e: -(e.relevance or 0))[:10]],
            }
        )
    out.sort(key=lambda c: (-c["threads"], -c["evidence_count"], c["name"]))
    return out


def hypothesis_channels(project, competitor_names: list[str]) -> list[dict]:
    market = getattr(project, "market", None) if hasattr(project, "market") else None
    audience = ", ".join(market.audiences[:2]) if market and market.audiences else "your target customers"
    b2b = bool(market and market.customer_type in ("B2B", "B2B2C"))
    out = [
        (
            "Your own network",
            f"People you already know who are {audience}. The fastest first conversations, but they're "
            "biased towards being polite: ask about past behaviour, not opinions.",
        ),
        (
            "Industry associations and trade groups" if b2b else "Communities your audience already belongs to",
            f"Groups where {audience} meet, online or in person. Not searched by this report: confirm they're active "
            "before spending time there.",
        ),
    ]
    if competitor_names:
        names = ", ".join(competitor_names[:3])
        out.append(
            (
                f"People already using {names}",
                "Customers of existing tools have the problem and a budget. Look for public threads where they compare "
                "options or complain, and talk to people who are switching.",
            )
        )
    return [
        {
            "key": f"hypothesis-{i}",
            "name": name,
            "is_hypothesis": True,
            "evidence_count": 0,
            "threads": 0,
            "latest": None,
            "categories": {},
            "relevance": "",
            "recommendation": text,
            "evidence_ids": [],
        }
        for i, (name, text) in enumerate(out)
    ]


def _tokens(segment: str) -> list[str]:
    words = re.findall(r"[a-z][a-z-]{3,}", segment.lower())
    return [w.removesuffix("s") if len(w) > 4 else w for w in words if w not in STOPWORDS]


def audience_segments(project, items: list[Evidence], clusters: list[EvidenceCluster], channels: list[dict]) -> list[dict]:
    market = getattr(project, "market", None) if hasattr(project, "market") else None
    if not market or not market.audiences:
        return []
    ai_suggested = "audiences" in (market.ai_suggested_fields or [])
    signals = signal_items(items)
    channel_names = {c["key"]: c["name"] for c in channels}
    out = []
    for segment in market.audiences:
        toks = _tokens(segment)
        pattern = re.compile(r"\b(" + "|".join(re.escape(t) for t in toks) + r")s?\b", re.I) if toks else None
        matched = [e for e in signals if pattern and pattern.search(f"{e.title} {e.excerpt}")]
        ids = {e.id for e in matched}
        needs = []
        for c in clusters:
            shared = sorted(ids & {e.id for e in c.evidence.all()})
            if shared:
                needs.append({"text": c.name, "evidence_ids": shared, "ai": True})
        needs.sort(key=lambda n: -len(n["evidence_ids"]))
        where = Counter(channel_of(e)[0] for e in matched)
        out.append(
            {
                "name": segment,
                "source": "ai" if ai_suggested else "founder",
                "evidence_count": len(matched),
                "evidence_ids": [e.id for e in sorted(matched, key=lambda e: -(e.relevance or 0))[:10]],
                "signals": dict(Counter(e.category for e in matched)),
                "needs": needs[:4],
                "channels": [channel_names.get(k, k) for k, _ in where.most_common(4)],
                "accessibility": (
                    f"Named in {len(matched)} record{'s' if len(matched) != 1 else ''} across {len(where)} "
                    f"place{'s' if len(where) != 1 else ''} we searched."
                    if matched
                    else "Not named in the evidence: whether this segment is reachable is unknown."
                ),
            }
        )
    return out


def first_ten_plan(project, channels: list[dict], themes: list[dict], competitors) -> list[dict]:
    market = getattr(project, "market", None) if hasattr(project, "market") else None
    audience = market.audiences[0] if market and market.audiences else "your target customer"
    researched = [c for c in channels if not c["is_hypothesis"]]
    steps = []
    if researched:
        places = ", ".join(c["name"] for c in researched[:3])
        steps.append(
            {
                "title": f"List 30 people who match “{audience}”",
                "detail": f"Start with people who described the problem in the cited threads on {places}, then your own "
                "network. Write the list yourself; ValidMe doesn't contact anyone for you.",
                "evidence_ids": [i for c in researched[:3] for i in c["evidence_ids"][:3]],
                "ai": False,
            }
        )
    else:
        steps.append(
            {
                "title": f"List 30 people who match “{audience}”",
                "detail": "None of the searched sources showed your audience discussing this yet, so start with your own "
                "network and the hypothesis channels, and note where people actually are.",
                "evidence_ids": [],
                "ai": False,
            }
        )
    questions = [f"“Tell me about the last time you dealt with {t['name'][0].lower() + t['name'][1:]}.”" for t in themes[:3]]
    questions += ["“What do you use for this today, and what does it cost you?”", "“What would have to be true for you to switch?”"]
    steps.append(
        {
            "title": "Interview 10 of them about the problem, not your idea",
            "detail": "Ask: " + " ".join(questions),
            "evidence_ids": [i for t in themes[:3] for i in t["evidence_ids"][:2]],
            "ai": bool(themes),  # questions reuse AI theme names
        }
    )
    verified = [c for c in competitors if c.pricing.get("status") == "verified" and c.pricing.get("plans")]
    anchors = [
        f"{c.name} lists {c.pricing['plans'][0]['price']}{(' ' + c.pricing['plans'][0].get('period', '')).rstrip()}"
        for c in verified[:2]
    ]
    price = market.price_hypothesis if market and market.price_hypothesis else ""
    detail = (f"Your hypothesis is {price}. " if price else "You haven't set a price hypothesis. ") + (
        "For reference: " + "; ".join(anchors) + " (verified on their pages)."
        if anchors
        else "No competitor prices were verified, so ask what they pay today."
    )
    steps.append({"title": "Test a price in the conversation", "detail": detail, "evidence_ids": [], "ai": False})
    steps.append(
        {
            "title": "Offer a pilot to the people with the strongest pain",
            "detail": "Aim for 10 people using it, free or paid. Record who said yes, who said no, and why.",
            "evidence_ids": [],
            "ai": False,
        }
    )
    steps.append(
        {
            "title": "Add what you learn and re-run the research",
            "detail": "Add the threads and competitors your interviews mention, then run a deeper report to update the score.",
            "evidence_ids": [],
            "ai": False,
        }
    )
    return steps
