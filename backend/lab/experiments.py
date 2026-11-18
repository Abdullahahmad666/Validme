"""Founder experiments as tier-1 evidence (Week 15, ADR-7): what real people did on the founder's own Lab pages.

Deterministic rules, no AI:
- **Demand** = waitlist sign-ups ÷ page views, pooled over the project's pages that have been live.
- **Willingness to pay** = "Choose <price>" presses ÷ views of the current price test, pooled over its variants.

A rate only counts once it rests on at least MIN_VIEWS views. It is scored from the **lower end of its 95% Wilson
interval**, so a small or noisy sample can't produce a high score: 3 sign-ups from 10 views scores far lower than 30
from 100. The target rates (DEMAND_TARGET, PAY_TARGET) are our rules of thumb for a page shared with the right people,
not market benchmarks, and the report says so. Every result carries references to the Lab rows it came from
(rule 1: nothing without a stored source) and stays apart from research evidence (rule 2).
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field

MIN_VIEWS = 30  # below this a rate isn't counted at all
DEMAND_TARGET = 0.10  # a lower bound at or above 10% of visitors joining scores 100
PAY_TARGET = 0.10  # a lower bound at or above 10% of visitors pressing "Choose" on a price scores 100
EXPERIMENT_SHARE = 0.6  # tier 1 outweighs public discussion when both exist
RULES_NOTE = (
    "Scored from the lower end of the 95% range, so small samples score low. The 10% targets are our rule of thumb for "
    "a page shared with likely customers, not a market benchmark; results depend on who you shared it with."
)


def wilson(successes: int, n: int, z: float = 1.96) -> tuple[float, float] | None:
    """95% Wilson score interval for a proportion. None without trials."""
    if n <= 0:
        return None
    p = successes / n
    denom = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return max(0.0, centre - half), min(1.0, centre + half)


def _confidence(n: int) -> str:
    return "high" if n >= 300 else "medium" if n >= 100 else "low"


@dataclass
class ExperimentResult:
    """One tier-1 signal for a score dimension."""

    dimension: str  # "demand_evidence" | "willingness_to_pay"
    trials: int  # views
    successes: int  # sign-ups or "Choose" presses
    label: str  # what was counted, in words
    sources: list[dict] = field(default_factory=list)  # [{kind, id, title}] the Lab rows behind it
    counted: bool = False  # enough views to count
    rate: float | None = None
    low: float | None = None
    high: float | None = None
    score: int | None = None
    confidence: str = "low"
    explanation: str = ""

    def as_dict(self) -> dict:
        return asdict(self)


def _result(dimension: str, successes: int, trials: int, target: float, what: str, sources: list[dict]) -> ExperimentResult:
    r = ExperimentResult(dimension=dimension, trials=trials, successes=successes, label=what, sources=sources)
    interval = wilson(successes, trials)
    if interval:
        r.rate = round(successes / trials, 4)
        r.low, r.high = round(interval[0], 4), round(interval[1], 4)
    if trials < MIN_VIEWS:
        r.explanation = (
            f"Your test pages: {successes} {what} from {trials} view{'s' if trials != 1 else ''}. "
            f"Too few views to count yet (needs {MIN_VIEWS})."
        )
        return r
    r.counted = True
    r.score = min(100, round(r.low / target * 100))
    r.confidence = _confidence(trials)
    r.explanation = (
        f"Your test pages: {successes} {what} from {trials} views ({r.rate * 100:.1f}%; at least {r.low * 100:.1f}% with 95% "
        f"confidence) → {r.score}/100 against a {round(target * 100)}% target."
    )
    return r


def project_experiments(project) -> dict[str, ExperimentResult]:
    """Tier-1 results for a project, keyed by dimension. Only pages that have been live count; nothing is invented when
    there's no data (the key is simply absent)."""
    from django.db.models import Sum

    from lab.blocks import price_test
    from lab.models import LabDailyStat, LabPage, LabVariantStat

    out: dict[str, ExperimentResult] = {}
    pages = list(LabPage.objects.filter(project=project, published_at__isnull=False).order_by("pk"))
    if not pages:
        return out
    totals = LabDailyStat.objects.filter(page__in=pages).aggregate(views=Sum("views"), signups=Sum("signups"))
    views, signups = totals["views"] or 0, totals["signups"] or 0
    if views:
        sources = [{"kind": "waitlist", "id": p.pk, "title": p.title} for p in pages]
        out["demand_evidence"] = _result("demand_evidence", signups, views, DEMAND_TARGET, "waitlist sign-ups", sources)
    pay_views = pay_clicks = 0
    pay_sources = []
    for p in pages:
        test = price_test(p.blocks)
        if test is None:
            continue
        t = LabVariantStat.objects.filter(page=p, test_key=test["key"]).aggregate(views=Sum("views"), clicks=Sum("clicks"))
        if t["views"]:
            pay_views += t["views"]
            pay_clicks += t["clicks"] or 0
            pay_sources.append({"kind": "price_test", "id": p.pk, "title": p.title})
    if pay_views:
        out["willingness_to_pay"] = _result(
            "willingness_to_pay", pay_clicks, pay_views, PAY_TARGET, "“Choose” presses on a tested price", pay_sources
        )
    return out
