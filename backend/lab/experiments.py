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
SPIKE_FACTOR = 5  # a day with more than 5× the median daily views is left out (bought or scripted traffic)
SPIKE_MIN_DAYS = 7  # only judged once there are enough days to have a median
RULES_NOTE = (
    "Your experiments count for 60% of Demand and of Willingness to pay once a result has 30 views. Each is scored from the "
    "low end of its 95% range, so small samples score low. The 10% targets are our rule of thumb for a page shared with "
    "likely customers, not a market benchmark; results depend on who you shared it with. Both results come from the same "
    "page visitors, so they aren't independent. Only the current version of a price test counts (presses on free options "
    "don't), and days with unusually many views are left out. The report's overall confidence still reflects research coverage only."
)


def wilson(successes: int, n: int, z: float = 1.96) -> tuple[float, float] | None:
    """95% Wilson score interval for a proportion. None without trials. Successes are clamped to 0..n."""
    if n <= 0:
        return None
    successes = max(0, min(successes, n))
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
    excluded_days: list[str] = field(default_factory=list)  # spike days left out (ISO dates)
    excluded_views: int = 0

    def as_dict(self) -> dict:
        return asdict(self)


def without_spikes(days: dict) -> tuple[int, int, list[str], int]:
    """Totals over {day: (views, successes)}, leaving out days with more than SPIKE_FACTOR × the median daily views.
    Visitors can't be told apart without cookies, so a sudden flood (bots, bought traffic, one person with many networks)
    would otherwise move the founder's score. Returns (views, successes, excluded days, excluded views)."""
    import statistics

    views = [v for v, _ in days.values() if v > 0]
    limit = None
    if len(views) >= SPIKE_MIN_DAYS:
        limit = SPIKE_FACTOR * max(1, statistics.median(views))
    kept_v = kept_s = dropped_v = 0
    dropped: list[str] = []
    for day, (v, s) in sorted(days.items()):
        if limit is not None and v > limit:
            dropped.append(day.isoformat())
            dropped_v += v
            continue
        kept_v += v
        kept_s += s
    return kept_v, kept_s, dropped, dropped_v


def _result(
    dimension: str, successes: int, trials: int, target: float, what: str, sources: list[dict], dropped=(), dropped_views=0
) -> ExperimentResult:
    # Views are counted once per network per day and skip bots, but sign-ups and presses aren't tied to a counted view
    # (shared office networks, a founder testing their own page, a price edit mid-day). Never more successes than views.
    clamped = successes > trials
    successes = min(successes, trials)
    r = ExperimentResult(dimension=dimension, trials=trials, successes=successes, label=what, sources=sources)
    r.excluded_days, r.excluded_views = list(dropped), dropped_views
    clamp_note = (
        f" There were more {what} than counted views (views are counted once per network a day), so the rate is capped at 100%."
        if clamped
        else ""
    )
    spike_note = (
        f" {len(r.excluded_days)} day{'s' if len(r.excluded_days) != 1 else ''} with unusually many views "
        f"({dropped_views} views) left out."
        if r.excluded_days
        else ""
    )
    interval = wilson(successes, trials)
    if interval:
        r.rate = round(successes / trials, 4)
        r.low, r.high = round(interval[0], 4), round(interval[1], 4)
    if trials < MIN_VIEWS:
        r.explanation = (
            (
                f"Your test pages: {successes} {what} from {trials} view{'s' if trials != 1 else ''}. "
                f"Too few views to count yet (needs {MIN_VIEWS})."
            )
            + spike_note
            + clamp_note
        )
        return r
    r.counted = True
    r.score = min(100, round(r.low / target * 100))
    r.confidence = _confidence(trials)
    r.explanation = (
        (
            f"Your test pages: {successes} {what} from {trials} views ({r.rate * 100:.1f}%; likely at least {r.low * 100:.1f}%, the "
            f"low end of the 95% range) → {r.score}/100 against a {round(target * 100)}% target. Counted when they happened, "
            f"including people since removed from the list."
        )
        + spike_note
        + clamp_note
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
    per_day = {
        r["day"]: (r["views"] or 0, r["signups"] or 0)
        for r in LabDailyStat.objects.filter(page__in=pages).values("day").annotate(views=Sum("views"), signups=Sum("signups"))
    }
    views, signups, dropped, dropped_views = without_spikes(per_day)
    if views or dropped:
        sources = [{"kind": "waitlist", "id": p.pk, "title": p.title} for p in pages]
        out["demand_evidence"] = _result(
            "demand_evidence", signups, views, DEMAND_TARGET, "waitlist sign-ups", sources, dropped, dropped_views
        )
    pay_days: dict = {}
    pay_sources = []
    for p in pages:
        test = price_test(p.blocks)
        if test is None:
            continue
        rows = (
            LabVariantStat.objects.filter(page=p, test_key=test["key"])
            .values("day")
            .annotate(views=Sum("views"), clicks=Sum("clicks"))
        )
        if any(r["views"] for r in rows):
            pay_sources.append({"kind": "price_test", "id": p.pk, "title": p.title})
        for r in rows:
            v, c = pay_days.get(r["day"], (0, 0))
            pay_days[r["day"]] = (v + (r["views"] or 0), c + (r["clicks"] or 0))
    pay_views, pay_clicks, pay_dropped, pay_dropped_views = without_spikes(pay_days)
    if pay_views or pay_dropped:
        out["willingness_to_pay"] = _result(
            "willingness_to_pay",
            pay_clicks,
            pay_views,
            PAY_TARGET,
            "“Choose” presses on a tested price",
            pay_sources,
            pay_dropped,
            pay_dropped_views,
        )
    return out
