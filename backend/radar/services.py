"""Radar services: save new signals, store score snapshots, revalidate a project. All deterministic and offline;
AI rationales are added afterwards (radar/rationale.py) and are optional."""

from __future__ import annotations

import logging
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from radar import generators
from radar.generators import Draft
from radar.models import ScoreSnapshot, Signal

logger = logging.getLogger(__name__)

SNAPSHOT_EVERY = timedelta(days=6)  # a revalidation stores a point at least weekly, even if nothing moved


def save_drafts(project, drafts: list[Draft]) -> list[Signal]:
    """Create signals for keys this project hasn't seen (dismissed ones included). Returns the new ones."""
    if not drafts:
        return []
    known = set(Signal.objects.filter(project=project, key__in=[d.key for d in drafts]).values_list("key", flat=True))
    created = []
    for d in drafts:
        if d.key in known:
            continue
        known.add(d.key)
        try:
            with transaction.atomic():
                s = Signal.objects.create(
                    project=project,
                    kind=d.kind,
                    type=d.type,
                    key=d.key[:160],
                    title=d.title[:200],
                    facts=d.facts,
                    relevance=d.relevance,
                    impact=d.impact,
                    confidence=d.confidence,
                    rank=d.rank,
                    change_id=d.change_id,
                    candidate_id=d.candidate_id,
                )
                if d.evidence_ids:
                    s.evidence.set(d.evidence_ids)
        except IntegrityError:
            continue  # created concurrently
        created.append(s)
    return created


def generate(project) -> list[Signal]:
    drafts: list[Draft] = []
    for gen in generators.GENERATORS:
        try:
            drafts += gen(project)
        except Exception:  # noqa: BLE001 - one generator failing must not hide the others
            logger.exception("radar generator %s failed for project %s", gen.__name__, project.pk)
    new = save_drafts(project, drafts)
    if new:
        _notify(project, new)
    return new


def _notify(project, new: list[Signal]) -> None:
    from notifications.services import notify

    try:
        top = max(new, key=lambda s: s.rank)
        notify(
            project.owner,
            kind="radar",
            title=f"{project.name}: {len(new)} new Radar signal{'s' if len(new) != 1 else ''}",
            body=top.title + (" (theme named by AI)" if top.kind == Signal.Kind.COMPLAINT_THEME else ""),
            link=f"/projects/{project.pk}/radar",
            project=project,
            source=f"radar:{project.pk}:{timezone.now():%Y-%m-%d}",
        )
    except Exception:  # noqa: BLE001
        logger.exception("radar notification failed for project %s", project.pk)


def signal_for_change(change) -> Signal | None:
    """Called right after monitoring detects a change, so a significant one shows up without waiting a week.
    No separate notice: the change already sent one."""
    draft = generators.competitor_change_draft(change)
    new = save_drafts(change.project, [draft]) if draft else []
    return new[0] if new else None


def signal_for_candidate(candidate) -> Signal | None:
    draft = generators.new_competitor_draft(candidate)
    new = save_drafts(candidate.project, [draft]) if draft else []
    return new[0] if new else None


# --- score snapshots ---------------------------------------------------------------------------------


def _dims(dimensions: list[dict]) -> dict:
    return {d["key"]: d.get("score") for d in dimensions}


def snapshot_from_report(report) -> ScoreSnapshot:
    o = report.content.get("overview", {})
    opp = report.content.get("opportunity", {})
    return ScoreSnapshot.objects.create(
        project_id=report.project_id,
        report=report,
        source=ScoreSnapshot.Source.REPORT,
        score=o.get("score"),
        confidence=o.get("confidence") or "",
        recommendation=o.get("recommendation") or "",
        dimensions=_dims(opp.get("dimensions", [])),
        evidence_count=int(o.get("evidence_count") or 0),
        scoring_version=report.content.get("scoring_version", ""),
        created_at=report.created_at,
    )


def rescore(project, now=None) -> ScoreSnapshot | None:
    """Re-score from stored evidence (no network, no AI). Stores a snapshot when the result moved, or weekly."""
    from evidence.models import Evidence, EvidenceCluster
    from reports.models import Competitor, Report
    from reports.scoring import SCORING_VERSION, score_project
    from research.models import ResearchJob

    if not Report.objects.filter(project=project).exists():
        return None  # never researched: nothing to revalidate
    if ResearchJob.objects.filter(project=project, status__in=("PENDING", "RUNNING")).exists():
        return None  # mid-run, themes and competitors are being rebuilt: a score now would be a false dip
    now = now or timezone.now()
    items = list(Evidence.objects.filter(project=project, duplicate_of__isnull=True))
    clusters = list(EvidenceCluster.objects.filter(project=project).prefetch_related("evidence"))
    competitors = list(Competitor.objects.filter(project=project))
    from lab.experiments import project_experiments

    result = score_project(items, clusters, competitors, project_experiments(project))
    last = ScoreSnapshot.objects.filter(project=project).first()
    same = last and (last.score, last.confidence, last.recommendation) == (
        result["score"],
        result["confidence"],
        result["recommendation"],
    )
    if same and now - last.created_at < SNAPSHOT_EVERY:
        return None
    return ScoreSnapshot.objects.create(
        project=project,
        source=ScoreSnapshot.Source.REVALIDATION,
        score=result["score"],
        confidence=result["confidence"],
        recommendation=result["recommendation"],
        dimensions=_dims(result["dimensions"]),
        evidence_count=len(items),
        scoring_version=SCORING_VERSION,
        created_at=now,
    )


def revalidate(project) -> dict:
    """Re-score and look for new signals. Safe to run any time; returns what happened."""
    from lab.verdicts import evaluate_assumptions

    evaluate_assumptions(project)  # answers can expire (retention), which can change a verdict
    snapshot = rescore(project)
    new = generate(project)
    return {"snapshot": snapshot.pk if snapshot else None, "new_signals": len(new)}


def after_report(job) -> None:
    """Hook at the end of a research run: record the report's score and look for signals. Never fails the job."""
    from reports.models import Report

    try:
        report = Report.objects.filter(project=job.project).order_by("-created_at").first()
        if report and not ScoreSnapshot.objects.filter(report=report).exists():
            snapshot_from_report(report)
        generate(job.project)
    except Exception:  # noqa: BLE001
        logger.exception("radar update after job %s failed", job.pk)


def basis(signal) -> str:
    """One factual line on what a signal rests on (shown next to it in the digest; no AI)."""
    f = signal.facts or {}
    if signal.kind == "complaint_theme":
        return (
            f"{f.get('records', '?')} records from {f.get('distinct_sources', '?')} distinct sources on "
            f"{f.get('sites', '?')} sites (theme named by AI)"
        )
    if signal.kind == "discussion_trend":
        return (
            f"{f.get('recent', '?')} dated records in the 30 days to {(f.get('recent_window') or ['', '?'])[1]}, "
            f"vs {f.get('baseline', '?')} in the 90 days before"
        )
    if signal.kind == "competitor_change":
        return f"a change we detected on {f.get('competitor', 'a watched page')}"
    if signal.kind == "new_competitor":
        return f"{f.get('domain', 'a new product')}, which you chose to watch"
    return ""
