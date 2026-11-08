"""Research orchestration: run every enabled provider, record coverage honestly, store deduped evidence."""

from __future__ import annotations

from django.db import IntegrityError, transaction
from django.utils import timezone

from evidence.models import Evidence
from research.budgets import DEPTH_BUDGETS, budget_for
from research.models import JobStage, ResearchJob
from research.providers import registry
from research.providers.base import Availability, ProviderError, QueryIn

STAGES = ["idea_analysis", "web_research", "community_research", "evidence_analysis", "competitor_analysis", "report"]


def create_stages(job: ResearchJob) -> None:
    JobStage.objects.bulk_create([JobStage(job=job, name=n, order=i) for i, n in enumerate(STAGES)])


def _store(job: ResearchJob, item) -> bool:
    try:
        with transaction.atomic():
            Evidence.objects.create(
                project=job.project,
                job=job,
                provider=item.provider,
                source_url=item.source_url,
                title=item.title[:300],
                excerpt=item.excerpt,
                published_at=item.published_at,
                retrieved_at=item.retrieved_at,
                author_hash=item.author_hash,
                content_hash=item.content_hash,
            )
        return True
    except IntegrityError:  # duplicate (same url + same text) — counted once
        return False


def collect_evidence(job: ResearchJob) -> ResearchJob:
    snapshot = job.config_snapshot
    queries = [QueryIn(q["text"], q["intent"]) for q in snapshot.get("queries", [])]
    queries = queries[: DEPTH_BUDGETS[job.depth]["queries"]]
    coverage: dict[str, str] = {}
    spent = 0.0

    for key in snapshot.get("sources", []):
        provider = registry.PROVIDERS.get(key)
        if provider is None:
            coverage[key] = "UNAVAILABLE"
            continue
        if provider.availability() not in (Availability.AVAILABLE, Availability.LIMITED):
            coverage[key] = "UNAVAILABLE"
            continue
        budget = budget_for(job.depth)
        try:
            stored = 0
            for q in queries:
                if budget.exhausted:
                    break
                for raw in provider.search(q, budget):
                    stored += _store(job, provider.normalize(raw))
            coverage[key] = "COMPLETED"
        except ProviderError:
            coverage[key] = "FAILED"
        spent += budget.spent_usd

    job.coverage = coverage
    job.cost_usd = round(spent, 4)
    ok = [v for v in coverage.values() if v == "COMPLETED"]
    if not ok:
        job.status = ResearchJob.Status.FAILED
    elif len(ok) < len(coverage):
        job.status = ResearchJob.Status.PARTIALLY_COMPLETED
    else:
        job.status = ResearchJob.Status.COMPLETED
    job.completed_at = timezone.now()
    job.save(update_fields=["coverage", "cost_usd", "status", "completed_at"])
    return job
