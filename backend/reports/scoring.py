"""Opportunity score (PRD §8). Deterministic: computed from stored evidence, never asked of a model.

Each dimension returns score 0-100 (or None = unavailable), confidence, the evidence ids behind it and
a plain explanation with the actual counts. Unavailable dimensions are left out and the remaining
weights renormalised; the report shows which ones were missing and what would fill them.
Overall confidence = the weakest of evidence volume, source diversity and recency.
High score + low confidence ⇒ "research_more", never "build".
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field
from datetime import date, timedelta

from evidence.models import Category, Evidence, EvidenceCluster
from reports.models import Competitor

SCORING_VERSION = "score_v1"
LEVELS = ["low", "medium", "high"]

WEIGHTS = {
    "demand_evidence": 25,
    "pain_intensity": 20,
    "willingness_to_pay": 20,
    "competitive_gap": 15,
    "audience_accessibility": 10,
    "product_feasibility": 10,
}
LABELS = {
    "demand_evidence": "Demand evidence",
    "pain_intensity": "Pain intensity",
    "willingness_to_pay": "Willingness to pay",
    "competitive_gap": "Competitive gap",
    "audience_accessibility": "Audience accessibility",
    "product_feasibility": "Product feasibility",
}
DEMAND = [Category.PAIN_POINT, Category.WORKAROUND, Category.ALTERNATIVE_SEEKING, Category.FEATURE_REQUEST, Category.BUYING_INTENT]
PAY = [Category.BUYING_INTENT, Category.PRICING_OBJECTION]
SEVERITY = {"high": 100, "medium": 60, "low": 30}


@dataclass
class Dimension:
    key: str
    score: int | None
    confidence: str
    explanation: str
    evidence_ids: list[int] = field(default_factory=list)

    @property
    def label(self) -> str:
        return LABELS[self.key]

    @property
    def weight(self) -> int:
        return WEIGHTS[self.key]

    def as_dict(self) -> dict:
        return {**asdict(self), "label": self.label, "weight": self.weight, "available": self.score is not None}


def _saturating(n: int, half: int) -> int:
    """0 → 0, `half` sources → 50, grows towards 100 with diminishing returns."""
    return round(100 * (1 - math.exp(-math.log(2) * n / half))) if n > 0 else 0


def _volume_conf(n: int, high: int, medium: int) -> str:
    return "high" if n >= high else "medium" if n >= medium else "low"


def _distinct(items: list[Evidence]) -> int:
    return len({e.source_url for e in items})


def _top(items: list[Evidence], k: int = 10) -> list[int]:
    return [e.id for e in sorted(items, key=lambda e: -(e.relevance or 0))[:k]]


def demand(items: list[Evidence]) -> Dimension:
    relevant = [e for e in items if e.category in DEMAND and (e.relevance or 0) >= 0.4]
    n = _distinct(relevant)
    if not items:
        return Dimension("demand_evidence", None, "low", "No evidence was collected.")
    if not any(e.classifier_version for e in items):
        return Dimension(
            "demand_evidence", None, "low", "Evidence wasn't classified (AI unavailable), so demand signals can't be counted."
        )
    return Dimension(
        "demand_evidence",
        _saturating(n, 8),
        _volume_conf(n, 15, 6),
        f"{n} separate source{'s' if n != 1 else ''} describe the problem, look for a solution or ask for one.",
        _top(relevant),
    )


def pain(items: list[Evidence], clusters: list[EvidenceCluster]) -> Dimension:
    pains = [e for e in items if e.category in (Category.PAIN_POINT, Category.WORKAROUND)]
    if clusters:
        weighted = [(SEVERITY.get(c.severity, 30), max(1, len({e.source_url for e in c.evidence.all()}))) for c in clusters]
        score = round(sum(s * w for s, w in weighted) / sum(w for _, w in weighted))
        n = _distinct(pains)
        top = max(clusters, key=lambda c: (SEVERITY.get(c.severity, 0), c.evidence.count()))
        return Dimension(
            "pain_intensity",
            score,
            _volume_conf(n, 10, 4),
            f"{len(clusters)} theme{'s' if len(clusters) != 1 else ''} from {n} pain or workaround sources; "
            f"most severe: “{top.name}” ({top.severity or 'unrated'}).",
            _top(pains),
        )
    if not pains:
        return Dimension("pain_intensity", None, "low", "No pain points or workarounds were found in the evidence.")
    n = _distinct(pains)
    return Dimension(
        "pain_intensity",
        _saturating(n, 6),
        "low",
        f"{n} sources describe pain or workarounds, but they couldn't be grouped into themes to judge severity.",
        _top(pains),
    )


def willingness_to_pay(items: list[Evidence], competitors: list[Competitor]) -> Dimension:
    signals = [e for e in items if e.category in PAY]
    intent = [e for e in signals if e.category == Category.BUYING_INTENT]
    paid = [
        c
        for c in competitors
        if c.pricing.get("status") == "verified" and any(p["price"].strip().lower() != "free" for p in c.pricing.get("plans", []))
    ]
    if not signals and not paid:
        return Dimension("willingness_to_pay", None, "low", "No buying-intent or pricing evidence, and no verified competitor prices.")
    score = min(100, _saturating(_distinct(intent), 4) + (20 if paid else 0) + min(10, 2 * _distinct(signals) - 2 * _distinct(intent)))
    parts = [f"{_distinct(intent)} buying-intent source{'s' if _distinct(intent) != 1 else ''}"]
    if len(signals) > len(intent):
        parts.append(f"{_distinct(signals) - _distinct(intent)} pricing discussions")
    if paid:
        parts.append(f"{len(paid)} competitor{'s' if len(paid) != 1 else ''} with verified paid plans (people already pay for this)")
    return Dimension(
        "willingness_to_pay",
        max(0, score),
        _volume_conf(_distinct(signals) + len(paid), 8, 3),
        "; ".join(parts) + ".",
        _top(signals),
    )


def competitive_gap(competitors: list[Competitor], items_by_id: dict[int, Evidence]) -> Dimension:
    if not competitors:
        return Dimension(
            "competitive_gap",
            None,
            "low",
            "No competitors were found in the searched sources or listed by you, so the gap can't be judged.",
        )
    with_gaps = [c for c in competitors if c.complaints]
    complaint_ids = sorted({i for c in competitors for i in c.complaints if i in items_by_id})
    share = len(with_gaps) / len(competitors)
    score = round(40 + 60 * share) if with_gaps else 30
    return Dimension(
        "competitive_gap",
        score,
        _volume_conf(len(complaint_ids), 8, 3),
        f"{len(with_gaps)} of {len(competitors)} competitor{'s' if len(competitors) != 1 else ''} have complaints in the evidence"
        + (f" ({len(complaint_ids)} records)." if complaint_ids else "; none name a weakness yet."),
        complaint_ids[:10],
    )


def overall_confidence(items: list[Evidence], dims: list[Dimension]) -> str:
    n = _distinct(items)
    providers = {e.provider for e in items}
    dated = [e.published_at for e in items if e.published_at]
    recent = sum(1 for d in dated if d >= date.today() - timedelta(days=730))
    volume = _volume_conf(n, 25, 10)
    diversity = "high" if len(providers) >= 3 else "medium" if len(providers) == 2 else "low"
    recency = "low" if not dated else "high" if recent / len(dated) >= 0.6 else "medium" if recent / len(dated) >= 0.3 else "low"
    level = min((volume, diversity, recency), key=LEVELS.index)
    if sum(1 for d in dims if d.score is None) >= 3 and level == "high":
        level = "medium"
    return level


def what_would_change(dims: list[Dimension], items: list[Evidence]) -> list[str]:
    tips = []
    d = {x.key: x for x in dims}
    if d["demand_evidence"].score is None or d["demand_evidence"].confidence == "low":
        tips.append("More independent sources describing the problem: broaden your queries or add threads you've found.")
    if d["willingness_to_pay"].score is None or (d["willingness_to_pay"].score or 0) < 50:
        tips.append("Evidence of what people pay today: add competitor pricing pages, or ask 5 target customers what they spend now.")
    if d["competitive_gap"].score is None:
        tips.append("Competitor coverage: list the tools your customers use today so their pages and complaints are analysed.")
    if d["pain_intensity"].score is None:
        tips.append("Clear pain descriptions: queries in the customer's own words (“how do I…”, “tired of…”) surface them.")
    if len({e.provider for e in items}) < 2:
        tips.append("A second kind of source, so findings aren't all from one community.")
    tips.append("Audience accessibility and product feasibility aren't scored from research yet; customer interviews fill both.")
    return tips


def score_project(items: list[Evidence], clusters: list[EvidenceCluster], competitors: list[Competitor]) -> dict:
    by_id = {e.id: e for e in items}
    dims = [
        demand(items),
        pain(items, clusters),
        willingness_to_pay(items, competitors),
        competitive_gap(competitors, by_id),
        Dimension("audience_accessibility", None, "low", "Assessed with the distribution analysis (next release)."),
        Dimension("product_feasibility", None, "low", "Your judgement: market research can't measure how hard this is to build."),
    ]
    available = [x for x in dims if x.score is not None]
    score = round(sum(x.score * x.weight for x in available) / sum(x.weight for x in available)) if available else None
    confidence = overall_confidence(items, dims)
    if score is None or confidence == "low":
        recommendation = "research_more"
    elif score >= 65:
        recommendation = "build"
    elif score >= 40:
        recommendation = "research_more"
    else:
        recommendation = "pivot"
    return {
        "score": score,
        "confidence": confidence,
        "recommendation": recommendation,
        "dimensions": [x.as_dict() for x in dims],
        "what_would_change": what_would_change(dims, items),
        "scored_weight": sum(x.weight for x in available),
    }
