"""Pricing & feature gap matrix, derived from a report snapshot (no new data, no AI).

- Prices: verified plans only (the price appeared verbatim on the competitor's page), with the read date.
- Features: from each competitor's own page (AI-extracted, labelled), merged by normalized name.
- Gap candidates: pain / feature-request themes whose key words appear in no competitor's listed features.
  That's a lead to investigate, not proof: the method is returned with the result.
"""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation

STOP = {"and", "the", "for", "with", "too", "not", "are", "that", "this", "from", "your", "their", "into"}
GAP_CATEGORIES = {"pain_point", "feature_request", "workaround", "alternative_seeking", "pricing_objection"}


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", text.lower())).strip()


def _words(text: str) -> set[str]:
    return {w.removesuffix("s") if len(w) > 4 else w for w in _norm(text).split() if len(w) > 3 and w not in STOP}


def _amount(price: str) -> Decimal | None:
    """First number in a verified price string ("$49", "€1,200.50") for sorting; None when there isn't one."""
    m = re.search(r"\d[\d,]*(?:\.\d+)?", price or "")
    if not m:
        return None
    try:
        return Decimal(m.group(0).replace(",", ""))
    except InvalidOperation:
        return None


def _period(text: str) -> str:
    t = _norm(text)
    if any(w in t for w in ("year", "yr", "annual")):
        return "year"
    if any(w in t for w in ("month", "mo")):
        return "month"
    return t


def build_matrix(content: dict) -> dict:
    competitors = content.get("competitors") or []

    pricing = []
    for c in competitors:
        p = c.get("pricing") or {}
        plans = (p.get("plans") or []) if p.get("status") == "verified" else []  # verified prices only
        priced = [(a, pl) for pl in plans if (a := _amount(pl.get("price", ""))) is not None]
        amounts = [a for a, _ in priced]
        periods = {_period(pl.get("period", "")) for _, pl in priced}
        # A "lowest" price only means something when plans are billed the same way (per month vs per year/seat).
        cheapest = min(priced, key=lambda x: x[0])[1] if priced and len(periods) == 1 else None
        pricing.append(
            {
                "competitor_id": c["id"],
                "name": c["name"],
                "status": "verified" if plans else "unavailable",
                "plans": plans,
                # The cheapest plan's own price text (as read on the page), never a re-formatted number.
                "lowest": {"price": cheapest.get("price", ""), "period": cheapest.get("period", "")} if cheapest else None,
                "mixed_periods": len(periods) > 1,
                # Free means a price of 0 or literally "Free": never a plan name like "Free trial".
                "has_free": any(a == 0 for a in amounts)
                or any(re.fullmatch(r"\s*free\s*", pl.get("price", ""), re.I) for pl in plans),
                "source_url": p.get("source_url", "") if plans else "",
                "retrieved_at": p.get("retrieved_at") if plans else None,
            }
        )

    # Feature grid: rows = distinct features (normalized), columns = competitors that list them.
    rows: dict[str, dict] = {}
    for c in competitors:
        for f in c.get("features") or []:
            key = _norm(f)
            if not key:
                continue
            row = rows.setdefault(key, {"feature": f.strip(), "competitor_ids": []})
            if c["id"] not in row["competitor_ids"]:
                row["competitor_ids"].append(c["id"])
    features = sorted(rows.values(), key=lambda r: (-len(r["competitor_ids"]), r["feature"].lower()))

    complaints = [
        {
            "competitor_id": c["id"],
            "name": c["name"],
            "complaints": len(c.get("complaint_ids") or []),
            "gap": c.get("identified_gap", ""),
            "evidence_ids": c.get("complaint_ids") or [],
        }
        for c in competitors
    ]

    offered = set().union(*(_words(r["feature"]) for r in features)) if features else set()
    gaps = []
    if competitors:
        for t in content.get("pain_points") or []:
            if t.get("category") not in GAP_CATEGORIES:
                continue
            words = _words(t.get("name", ""))
            if words and not (words & offered):
                gaps.append(
                    {
                        "theme": t["name"],
                        "category": t["category"],
                        "records": t.get("records", 0),
                        "distinct_sources": t.get("distinct_sources", 0),
                        "confidence": t.get("confidence", ""),
                        "evidence_ids": (t.get("evidence_ids") or [])[:10],
                    }
                )
        gaps.sort(key=lambda g: (-g["distinct_sources"], -g["records"]))

    return {
        "competitor_count": len(competitors),
        "pricing": pricing,
        "features": features,
        "features_ai_extracted": any(c.get("ai_extracted") for c in competitors),
        "complaints": complaints,
        "gap_candidates": gaps,
        "method": (
            "Gap candidates are complaint or feature-request themes whose key words don't appear in any competitor's "
            "listed features. Competitors' feature lists come from their own pages and may be incomplete: treat these as "
            "leads to check, not proof that nobody offers it."
        ),
    }
