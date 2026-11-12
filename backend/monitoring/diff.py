"""Deterministic page diffs: price strings and text blocks. No AI, so the same two pages always give the same result."""

from __future__ import annotations

import re
from collections import Counter

# A price as written on a page: currency symbol/code + amount, with an optional billing period.
PRICE = re.compile(
    r"(?:(?:US|CA|AU)?\$|€|£|¥|₹|Rs\.?\s?|USD\s?|EUR\s?|GBP\s?)\s?\d[\d,]*(?:\.\d{1,2})?"
    r"(?:\s?(?:/|per)\s?(?:mo(?:nth)?|month|yr|year|annum|user|seat|week)\b)?",
    re.IGNORECASE,
)
MAX_ITEMS = 20
MAX_BLOCK = 300


def prices(text: str) -> list[str]:
    seen: dict[str, None] = {}
    for m in PRICE.finditer(text):
        seen.setdefault(" ".join(m.group(0).split()), None)
    return list(seen)


def _missing_from(blocks: list[str], other: list[str]) -> list[str]:
    """Blocks of `blocks` (in order, counting repeats) that `other` doesn't have."""
    available = Counter(other)
    out = []
    for b in blocks:
        if available[b]:
            available[b] -= 1
        else:
            out.append(b)
    return out


def diff_pages(before: str, after: str) -> dict:
    """Compare two observations' text (newline-separated blocks)."""
    old_blocks = [b for b in before.split("\n") if b.strip()]
    new_blocks = [b for b in after.split("\n") if b.strip()]
    # Linear, order-preserving multiset difference (not difflib): its cost is O(n) whatever the page holds,
    # so a hostile page with thousands of near-identical blocks can't stall a worker.
    added = _missing_from(new_blocks, old_blocks)
    removed = _missing_from(old_blocks, new_blocks)
    old_prices, new_prices = set(prices(before)), set(prices(after))
    prices_added = sorted(new_prices - old_prices)
    prices_removed = sorted(old_prices - new_prices)
    changed_share = (len(added) + len(removed)) / max(1, len(old_blocks) + len(new_blocks))

    if prices_added or prices_removed:
        kind, significance = "pricing", "high"
        parts = []
        if prices_added:
            parts.append(f"new price{'s' if len(prices_added) > 1 else ''}: {', '.join(prices_added[:4])}")
        if prices_removed:
            parts.append(f"no longer shown: {', '.join(prices_removed[:4])}")
        summary = "Prices changed (" + "; ".join(parts) + ")"
    else:
        kind = "content"
        significance = "medium" if changed_share >= 0.2 or len(added) >= 5 else "low"
        summary = f"Page text changed: {len(added)} block{'s' if len(added) != 1 else ''} added, {len(removed)} removed"

    return {
        "kind": kind,
        "significance": significance,
        "summary": summary[:300],
        "details": {
            "prices_added": prices_added[:MAX_ITEMS],
            "prices_removed": prices_removed[:MAX_ITEMS],
            "blocks_added": [b[:MAX_BLOCK] for b in added[:MAX_ITEMS]],
            "blocks_removed": [b[:MAX_BLOCK] for b in removed[:MAX_ITEMS]],
            "blocks_added_total": len(added),
            "blocks_removed_total": len(removed),
        },
    }
