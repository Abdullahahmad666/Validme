"""Signal generators: fixed rules over data we already store. No AI, no network, nothing estimated.

Each generator returns drafts; services.generate() saves the ones that are new for the project. Definitions:
- a *source* is a distinct author on a site (or the page itself when the author isn't known), so one busy thread
  with many comments from one person is one source, and a whole thread on one site is still one *site*;
- relevance (0..1): mean classifier relevance of the records that have one (records without one don't count);
  monitoring signals use a fixed value by kind, shown as such;
- impact (0..1): how much is behind it (sources and records, or what changed);
- confidence (low/medium/high): diversity and recency of the sources, with the basis stored in the facts.
Thresholds are deliberately conservative: a missed signal is better than a fabricated one.
"""

from __future__ import annotations

import re
import statistics
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, timedelta
from urllib.parse import urlsplit

from django.utils import timezone

from evidence.models import Category, Evidence, EvidenceCluster

COMPLAINT_CATEGORIES = (
    Category.PAIN_POINT,
    Category.PRICING_OBJECTION,
    Category.WORKAROUND,
    Category.ALTERNATIVE_SEEKING,
)
MIN_SOURCES = 3  # distinct authors/pages
MIN_SITES = 2  # distinct hosts: one thread or one forum alone is never enough
MIN_MEAN_RELEVANCE = 0.5
THEME_MIN_RECORDS = 5
THEME_OVERLAP = 0.5  # a renamed theme sharing this much evidence with an earlier signal isn't new
TREND_WINDOW_DAYS = 30
TREND_BASELINE_WINDOWS = 3  # the 90 days before the recent window
TREND_MIN_RECENT = 6
TREND_MIN_BASELINE = 3  # without some earlier discussion we can't call anything a rise
TREND_MIN_RATIO = 2.0
RECENT_DAYS = 180
CHANGE_LOOKBACK_DAYS = 30
MAX_EVIDENCE_PER_SIGNAL = 20


@dataclass
class Draft:
    kind: str
    type: str
    key: str
    title: str
    facts: dict
    relevance: float
    impact: float
    confidence: str
    evidence_ids: list[int] = field(default_factory=list)
    change_id: int | None = None
    candidate_id: int | None = None

    @property
    def rank(self) -> float:
        return round(self.relevance * self.impact, 4)


def _r(x: float) -> float:
    return round(max(0.0, min(1.0, x)), 3)


def _norm(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", name.lower()).strip()[:120]


def host_of(url: str) -> str:
    host = (urlsplit(url).hostname or "").lower()
    return host[4:] if host.startswith("www.") else host


def sources_of(items: list[Evidence]) -> set[tuple[str, str]]:
    """Distinct (site, author) pairs; the page stands in for an unknown author."""
    return {(host_of(e.source_url), e.author_hash or e.source_url) for e in items}


def sites_of(items: list[Evidence]) -> set[str]:
    return {h for h in (host_of(e.source_url) for e in items) if h}


def mean_relevance(items: list[Evidence]) -> float | None:
    vals = [e.relevance for e in items if e.relevance is not None]
    return statistics.fmean(vals) if vals else None


def confidence_basis(items: list[Evidence], today: date) -> dict:
    dated = [e.published_at for e in items if e.published_at]
    recent = sum(1 for d in dated if d >= today - timedelta(days=RECENT_DAYS))
    return {
        "sources": len(sources_of(items)),
        "sites": len(sites_of(items)),
        "platforms": len({e.provider for e in items}),
        "recent_share": round(recent / len(items), 2) if items else 0,  # undated records count as not recent
        "undated": len(items) - len(dated),
    }


def evidence_confidence(basis: dict) -> str:
    """high: ≥3 sources on ≥2 sites from ≥2 platforms, with at least 60% of records from the last 6 months;
    medium: ≥3 sources on ≥2 sites; low otherwise."""
    diverse = basis["sources"] >= MIN_SOURCES and basis["sites"] >= MIN_SITES
    if diverse and basis["platforms"] >= 2 and basis["recent_share"] >= 0.6:
        return "high"
    return "medium" if diverse else "low"


def _top(items: list[Evidence]) -> list[int]:
    return [e.id for e in sorted(items, key=lambda e: (-(e.relevance or 0), -e.id))[:MAX_EVIDENCE_PER_SIGNAL]]


def _strong_enough(items: list[Evidence]) -> float | None:
    """The shared floor for evidence-based signals; returns the relevance to use, or None to skip."""
    rel = mean_relevance(items)
    if rel is None or rel < MIN_MEAN_RELEVANCE:
        return None
    if len(sources_of(items)) < MIN_SOURCES or len(sites_of(items)) < MIN_SITES:
        return None
    return rel


def complaint_themes(project, today: date | None = None) -> list[Draft]:
    """A complaint theme (from the latest analysis) backed by enough independent sources on more than one site."""
    from radar.models import Signal

    today = today or date.today()
    earlier = [
        set(s.evidence.values_list("id", flat=True))
        for s in Signal.objects.filter(project=project, kind=Signal.Kind.COMPLAINT_THEME).prefetch_related("evidence")
    ]
    drafts = []
    clusters = EvidenceCluster.objects.filter(project=project, category__in=COMPLAINT_CATEGORIES).prefetch_related("evidence")
    for c in clusters:
        members = [e for e in c.evidence.all() if e.duplicate_of_id is None]
        if len(members) < THEME_MIN_RECORDS:
            continue
        rel = _strong_enough(members)
        if rel is None:
            continue
        ids = {e.id for e in members}
        if any(len(ids & seen) >= THEME_OVERLAP * len(ids) for seen in earlier):
            continue  # the same complaints under a new AI-written name
        basis = confidence_basis(members, today)
        hosts = Counter(host_of(e.source_url) for e in members)
        drafts.append(
            Draft(
                kind="complaint_theme",
                type="opportunity",
                key=f"theme:{_norm(c.name)}",
                title=f"Recurring complaint: {c.name}"[:200],
                facts={
                    "theme": c.name,
                    "theme_named_by": "ai",  # cluster names come from the analysis step; counts below don't
                    "category": c.category,
                    "records": len(members),
                    "distinct_sources": basis["sources"],
                    "sites": basis["sites"],
                    "top_sites": [h for h, _ in hosts.most_common(3) if h],
                    "confidence_basis": basis,
                },
                relevance=_r(rel),
                impact=_r(0.5 * min(1, basis["sources"] / 6) + 0.5 * min(1, len(members) / 20)),
                confidence=evidence_confidence(basis),
                evidence_ids=_top(members),
            )
        )
    return drafts


def _collected_until(project) -> date:
    """End of the trend window: when evidence was last collected, not today. A weekly re-check of a frozen sample
    must not count days we never searched as quiet ones."""
    from research.models import ResearchJob

    last = (
        ResearchJob.objects.filter(project=project, completed_at__isnull=False)
        .order_by("-completed_at")
        .values_list("completed_at", flat=True)
        .first()
    )
    return min(timezone.localdate(last) if last else date.today(), date.today())


def discussion_trends(project, today: date | None = None) -> list[Draft]:
    """More dated discussion in the 30 days before the last collection than in the 90 before that.
    Uses the publish dates of our own stored evidence: a rise in what we collected, not a market measurement."""
    end = today or _collected_until(project)
    start = end - timedelta(days=TREND_WINDOW_DAYS)  # recent window: (start, end]
    base_start = start - timedelta(days=TREND_WINDOW_DAYS * TREND_BASELINE_WINDOWS)  # baseline: (base_start, start]
    qs = Evidence.objects.filter(project=project, duplicate_of__isnull=True).exclude(
        category__in=(Category.IRRELEVANT, Category.UNCLASSIFIED)
    )
    if not qs.filter(published_at__lte=base_start).exists():
        return []  # nothing older than the baseline was collected: no history to compare against
    rows = list(qs.filter(published_at__gt=base_start, published_at__lte=end))
    groups = {
        Category.PAIN_POINT: [e for e in rows if e.category == Category.PAIN_POINT],
        Category.BUYING_INTENT: [e for e in rows if e.category == Category.BUYING_INTENT],
        "all": rows,
    }
    labels = {"all": "Discussion", Category.PAIN_POINT: "Pain-point discussion", Category.BUYING_INTENT: "Buying-intent discussion"}
    drafts = []
    for cat, items in groups.items():
        if cat == "all" and drafts:
            continue  # the same records already produced a more specific trend
        recent = [e for e in items if e.published_at > start]
        baseline = len(items) - len(recent)
        if len(recent) < TREND_MIN_RECENT or baseline < TREND_MIN_BASELINE:
            continue
        per_window = baseline / TREND_BASELINE_WINDOWS
        ratio = round(len(recent) / per_window, 1)
        if ratio < TREND_MIN_RATIO:
            continue
        rel = _strong_enough(recent)
        if rel is None:
            continue
        basis = confidence_basis(recent, end)
        drafts.append(
            Draft(
                kind="discussion_trend",
                type="trend",
                key=f"trend:{cat}:{end:%Y-%m}",  # at most one per group per month
                title=f"{labels[cat]} up {ratio}× in the records we collected",
                facts={
                    "category": cat,
                    "recent": len(recent),
                    "recent_window": [(start + timedelta(days=1)).isoformat(), end.isoformat()],
                    "baseline": baseline,
                    "baseline_per_30_days": round(per_window, 1),
                    "baseline_window": [(base_start + timedelta(days=1)).isoformat(), start.isoformat()],
                    "ratio": ratio,
                    "distinct_sources": basis["sources"],
                    "sites": basis["sites"],
                    "basis": "publish dates of the evidence collected for this project",
                    "confidence_basis": basis,
                },
                relevance=_r(rel),
                impact=_r(0.5 * min(1, len(recent) / 20) + 0.5 * min(1, ratio / (TREND_MIN_RATIO * 2))),
                confidence=evidence_confidence(basis),
                evidence_ids=_top(recent),
            )
        )
    return drafts


def competitor_change_draft(change) -> Draft | None:
    """A significant change we detected on a watched competitor page (the diff itself is the source)."""
    if change.significance != "high":
        return None
    watch = change.watch
    d = change.details or {}
    name = watch.label or host_of(watch.url) or "A watched page"
    return Draft(
        kind="competitor_change",
        type="risk",
        key=f"change:{change.pk}",
        title=f"{name}: {change.summary}"[:200],
        facts={
            "competitor": name,
            "page": watch.url,
            "change_kind": change.kind,
            "summary": change.summary,
            "prices_added": d.get("prices_added", [])[:5],
            "prices_removed": d.get("prices_removed", [])[:5],
            "detected_at": change.detected_at.isoformat(),
            "scores_by_kind": True,  # relevance/impact are fixed per kind of change, not measured
        },
        relevance=_r(0.9 if watch.competitor_id else 0.7),  # a competitor from the report vs. a page you added
        impact=_r(0.8 if change.kind == "pricing" else 0.5),
        confidence="high",  # we read both versions of the page ourselves; the diff is exact
        change_id=change.pk,
    )


def competitor_changes(project) -> list[Draft]:
    from monitoring.models import Change

    since = timezone.now() - timedelta(days=CHANGE_LOOKBACK_DAYS)
    changes = Change.objects.filter(project=project, significance="high", detected_at__gte=since).select_related("watch")
    return [d for c in changes if (d := competitor_change_draft(c))]


def new_competitor_draft(candidate) -> Draft | None:
    """A new competitor the founder confirmed by watching it (a match alone isn't proof)."""
    if candidate.status != "accepted":
        return None
    return Draft(
        kind="new_competitor",
        type="risk",
        key=f"candidate:{candidate.pk}",
        title=f"New competitor: {candidate.name}"[:200],
        facts={
            "name": candidate.name,
            "domain": candidate.domain,
            "launch_post": candidate.source_url,
            "found_at": candidate.found_at.isoformat(),
            "confirmed_by": "you",
            "scores_by_kind": True,
        },
        relevance=_r(0.6),
        impact=_r(0.5),
        confidence="medium",
        candidate_id=candidate.pk,
    )


def new_competitors(project) -> list[Draft]:
    from monitoring.models import CompetitorCandidate

    return [d for c in CompetitorCandidate.objects.filter(project=project, status="accepted") if (d := new_competitor_draft(c))]


GENERATORS = (complaint_themes, discussion_trends, competitor_changes, new_competitors)
