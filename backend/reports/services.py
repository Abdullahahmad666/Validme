"""Builds the report snapshot for a finished job: overview, demand, pain points, competitors, market gaps,
audience and distribution.

All numbers are counts over stored evidence; every finding carries the evidence ids behind it.
Text written by AI (theme summaries, competitor gaps) is labelled as such in the payload.
"""

from __future__ import annotations

from collections import Counter
from decimal import Decimal

from django.db import transaction

from evidence.models import Category, Evidence, EvidenceCluster
from reports import distribution as dist
from reports.competitors import build_competitors
from reports.models import ChannelRecommendation, Competitor, Opportunity, Report
from reports.scoring import SCORING_VERSION, score_project
from research.models import ResearchJob

NEXT_STEP = {
    "build": "Evidence looks promising. Before building, interview 5 people from the cited threads to confirm they'd pay.",
    "research_more": "Not enough evidence to decide yet. Follow “What would change the score”, then run a deeper report.",
    "pivot": "The evidence points to weak demand for this framing. Look at the strongest theme below for a sharper angle.",
}


def _evidence_card(e: Evidence) -> dict:
    return {
        "id": e.id,
        "title": e.title,
        "excerpt": e.excerpt,
        "source_url": e.source_url,
        "provider": e.provider,
        "published_at": e.published_at.isoformat() if e.published_at else None,
        "category": e.category,
    }


def _competitor(c: Competitor) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "kind": c.kind,
        "website": c.website,
        "positioning": c.positioning,
        "audience": c.audience,
        "features": c.features,
        "pricing": c.pricing,
        "complaint_ids": c.complaints,
        "identified_gap": c.identified_gap,
        "evidence_ids": sorted(c.evidence.values_list("id", flat=True)),
        "ai_extracted": bool(c.extraction_version),
    }


def _assumptions(job: ResearchJob) -> list[dict]:
    out = []
    market = getattr(job.project, "market", None)
    if market and market.price_hypothesis:
        out.append({"text": f"Customers will pay about {market.price_hypothesis}.", "source": "founder"})
    idea = getattr(job.project, "idea", None) if hasattr(job.project, "idea") else None
    interp = (idea.ai_interpretation if idea else None) or {}
    out += [{"text": a, "source": "ai"} for a in interp.get("assumptions", [])]
    return out


def _risks(items: list[Evidence], competitors: list[Competitor], scoring: dict) -> list[str]:
    risks = []
    providers = Counter(e.provider for e in items)
    if items and providers.most_common(1)[0][1] / len(items) >= 0.8:
        risks.append("Most evidence comes from a single source, so it may reflect one community's view.")
    dims = {d["key"]: d for d in scoring["dimensions"]}
    if (dims["willingness_to_pay"]["score"] or 0) < 40:
        risks.append("Little evidence that people pay for a solution today.")
    verified = [c for c in competitors if c.pricing.get("status") == "verified"]
    if len(verified) >= 3:
        risks.append(f"{len(verified)} competitors already sell paid plans: differentiation has to be clear.")
    dated = [e.published_at for e in items if e.published_at]
    if dated and max(dated).year < 2024:
        risks.append("The most recent evidence is over two years old; the market may have moved.")
    return risks


def build_report(job: ResearchJob) -> tuple[Report, Decimal, list[str]]:
    competitors, cost, notes = build_competitors(job)
    project = job.project
    items = list(Evidence.objects.filter(project=project, duplicate_of__isnull=True))
    clusters = list(EvidenceCluster.objects.filter(project=project).prefetch_related("evidence"))
    scoring = score_project(items, clusters, competitors)
    relevant = [e for e in items if e.category not in (Category.IRRELEVANT,)]

    # Demand tab
    by_category = Counter(e.category for e in items)
    by_source = Counter(e.provider for e in items)
    dated = sorted(e.published_at for e in items if e.published_at)
    intent = sorted((e for e in items if e.category == Category.BUYING_INTENT), key=lambda e: -(e.relevance or 0))[:5]

    # Pain points tab
    themes = []
    for c in clusters:
        members = [e for e in c.evidence.all() if e.duplicate_of_id is None]
        authors = {e.author_hash or e.author_name for e in members if e.author_hash or e.author_name}
        themes.append(
            {
                "id": c.id,
                "name": c.name,
                "category": c.category,
                "severity": c.severity,
                "confidence": c.confidence,
                "ai_summary": c.ai_summary,
                "records": len(members),
                "distinct_sources": len({e.source_url for e in members}),
                "distinct_authors": len(authors) or None,  # None = not legitimately available
                "samples": [_evidence_card(e) for e in sorted(members, key=lambda e: -(e.relevance or 0))[:3]],
                "evidence_ids": [e.id for e in members],
            }
        )
    themes.sort(key=lambda t: (-t["distinct_sources"], t["name"]))

    # Overview: key findings = strongest themes (each linked to evidence), or top evidence if none.
    findings = [
        {
            "text": t["name"],
            "detail": f"{t['distinct_sources']} sources · {t['confidence']} confidence",
            "evidence_ids": t["evidence_ids"][:10],
            "ai": True,
        }
        for t in themes[:3]
    ]
    if not findings:
        findings = [
            {"text": e.title or e.excerpt[:80], "detail": e.excerpt[:200], "evidence_ids": [e.id], "ai": False}
            # Only classified, relevant records: unclassified search hits aren't findings.
            for e in sorted((e for e in relevant if e.classifier_version), key=lambda e: -(e.relevance or 0))[:3]
        ]

    # Audience + distribution tabs
    researched = dist.researched_channels(items)
    channels = researched + dist.hypothesis_channels(project, [c.name for c in competitors])
    segments = dist.audience_segments(project, items, clusters, researched)
    plan = dist.first_ten_plan(project, channels, themes, competitors)
    by_id = {e.id: e for e in items}
    threads = sorted(
        {e.source_url: e for c in researched for i in c["evidence_ids"] if (e := by_id.get(i))}.values(),
        key=lambda e: -(e.relevance or 0),
    )[:15]

    providers = sorted(by_source)
    summary = (
        f"{len(items)} evidence records from {len({e.source_url for e in items})} distinct sources across "
        f"{len(providers)} source type{'s' if len(providers) != 1 else ''}"
        + (f", grouped into {len(themes)} theme{'s' if len(themes) != 1 else ''}" if themes else "")
        + (f"; {len(competitors)} competitor{'s' if len(competitors) != 1 else ''} profiled" if competitors else "")
        + "."
    )

    content = {
        "generated_at": job.completed_at.isoformat() if job.completed_at else None,
        "job_id": str(job.id),
        "depth": job.depth,
        "coverage": job.coverage,
        "overview": {
            "score": scoring["score"],
            "confidence": scoring["confidence"],
            "recommendation": scoring["recommendation"],
            "next_step": NEXT_STEP[scoring["recommendation"]],
            "evidence_count": len(items),
            "competitor_count": len(competitors),
            "summary": summary,
            "key_findings": findings,
        },
        "demand": {
            "by_category": dict(by_category),
            "by_source": dict(by_source),
            "date_range": [dated[0].isoformat(), dated[-1].isoformat()] if dated else None,
            "buying_intent": [_evidence_card(e) for e in intent],
            "classified": any(e.classifier_version for e in items),
        },
        "pain_points": themes,
        "competitors": [_competitor(c) for c in competitors],
        "opportunity": {
            "dimensions": scoring["dimensions"],
            "scored_weight": scoring["scored_weight"],
            "assumptions": _assumptions(job),
            "risks": _risks(items, competitors, scoring),
            "market_size": {
                "status": "unavailable",
                "reason": (
                    "No sourced market counts were found, so TAM, SAM and SOM aren't estimated. "
                    "They'll appear only with a calculation and its sources."
                ),
            },
            "what_would_change": scoring["what_would_change"],
        },
        "audience": {"segments": segments},
        "distribution": {
            "channels": channels,
            "threads": [_evidence_card(e) for e in threads],
            "first_ten_plan": plan,
        },
        "evidence_index": {
            str(e.id): _evidence_card(e)
            for e in items
            if e.id in _cited_ids(themes, findings, competitors, scoring, intent) | _dist_ids(channels, segments, plan)
        },
        "notes": notes,
        "scoring_version": SCORING_VERSION,
    }

    with transaction.atomic():
        Opportunity.objects.update_or_create(
            project=project,
            defaults={
                "score": scoring["score"],
                "confidence": scoring["confidence"],
                "dimensions": scoring["dimensions"],
                "assumptions": content["opportunity"]["assumptions"],
                "risks": content["opportunity"]["risks"],
                "market_size": content["opportunity"]["market_size"],
                "recommendation": scoring["recommendation"],
                "what_would_change": scoring["what_would_change"],
                "scoring_version": SCORING_VERSION,
            },
        )
        report, _ = Report.objects.update_or_create(job=job, defaults={"project": project, "content": content})
        ChannelRecommendation.objects.filter(project=project).delete()
        for c in channels:
            rec = ChannelRecommendation.objects.create(
                project=project,
                channel=c["name"][:160],
                audience=", ".join(s["name"] for s in segments if c["name"] in s["channels"])[:160],
                recommendation=c["recommendation"],
                relevance=c["relevance"],
                is_hypothesis=c["is_hypothesis"],
            )
            rec.evidence.set(c["evidence_ids"])
    return report, cost, notes


def _dist_ids(channels, segments, plan) -> set[int]:
    ids: set[int] = set()
    for group in (channels, segments, plan):
        for x in group:
            ids.update(x["evidence_ids"])
    for seg in segments:
        for n in seg["needs"]:
            ids.update(n["evidence_ids"])
    return ids


def _cited_ids(themes, findings, competitors, scoring, intent) -> set[int]:
    ids: set[int] = set()
    for t in themes:
        ids.update(s["id"] for s in t["samples"])
    for f in findings:
        ids.update(f["evidence_ids"])
    for c in competitors:
        ids.update(c.complaints)
    for d in scoring["dimensions"]:
        ids.update(d["evidence_ids"])
    ids.update(e.id for e in intent)
    return ids
