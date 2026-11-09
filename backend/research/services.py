"""Research orchestration: run every selected provider, record coverage honestly, store deduped evidence.

Each stage writes a JobStage row as it runs, so the progress screen shows real status (no fake
percentages). One provider failing marks the job PARTIALLY_COMPLETED; only if none succeed is it FAILED.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from evidence.models import Evidence
from research.budgets import DEPTH_BUDGETS, budget_for
from research.models import JobStage, ResearchJob, SearchCache
from research.providers import registry
from research.providers.base import Availability, Budget, EvidenceIn, ProviderError, QueryIn, RawResult

STAGES = ["idea_analysis", "web_research", "community_research", "evidence_analysis", "competitor_analysis", "report"]
PROVIDER_STAGES = ["web_research", "community_research", "competitor_analysis"]
NOT_YET_AVAILABLE = {
    "evidence_analysis": "Classification and clustering arrive in a later release; evidence is stored unclassified.",
    "report": "The opportunity report arrives in a later release.",
}
CACHE_TTL = timedelta(days=7)


def create_stages(job: ResearchJob) -> None:
    JobStage.objects.bulk_create([JobStage(job=job, name=n, order=i) for i, n in enumerate(STAGES)])


def set_stage(job: ResearchJob, name: str, status: str, detail: str = "") -> None:
    now = timezone.now()
    updates: dict = {"status": status, "detail": detail[:500]}
    if status == JobStage.Status.PROCESSING:
        updates["started_at"] = now
    elif status in (JobStage.Status.COMPLETED, JobStage.Status.FAILED, JobStage.Status.SKIPPED):
        updates["finished_at"] = now
    JobStage.objects.filter(job=job, name=name).update(**updates)


# --------------------------------------------------------------------------------------------
# Search cache: 7 days by (provider, normalized query). Search results are public data; the
# cache only ever serves an identical query, so nothing about one user's idea leaks to another.
# --------------------------------------------------------------------------------------------
def _cache_key(provider_key: str, query: QueryIn, max_results: int) -> str:
    normalized = " ".join(query.text.lower().split())
    return hashlib.sha256(f"{provider_key}|{query.intent}|{max_results}|{normalized}".encode()).hexdigest()


def cached_search(provider, query: QueryIn, budget: Budget) -> tuple[list[RawResult], bool]:
    """Return (results, from_cache). Cache hits cost nothing; misses are charged by the provider."""
    key = _cache_key(provider.key, query, budget.max_results)
    hit = SearchCache.objects.filter(provider=provider.key, query_hash=key, fetched_at__gte=timezone.now() - CACHE_TTL).first()
    if hit is not None:
        return [RawResult(provider.key, d) for d in hit.payload.get("results", [])], True
    results = provider.search(query, budget)
    SearchCache.objects.update_or_create(
        provider=provider.key,
        query_hash=key,
        defaults={"payload": {"results": [r.data for r in results]}, "fetched_at": timezone.now()},
    )
    return results, False


def _store(job: ResearchJob, item: EvidenceIn) -> bool:
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


def _excluded(item: EvidenceIn, terms: list[str]) -> bool:
    haystack = f"{item.title} {item.excerpt}".lower()
    return any(t.lower() in haystack for t in terms)


@dataclass
class ProviderRun:
    status: str  # COMPLETED | FAILED | UNAVAILABLE | SKIPPED
    found: int = 0
    stored: int = 0
    cached: int = 0
    spent_usd: float = 0.0
    notes: list[str] = field(default_factory=list)

    def summary(self, key: str) -> str:
        if self.status == "COMPLETED":
            extra = f", {self.cached} from cache" if self.cached else ""
            return f"{key}: {self.found} found, {self.stored} new{extra}"
        if self.status == "SKIPPED":
            return f"{key}: nothing to read"
        return f"{key}: {self.status.lower()}"


def run_provider(job: ResearchJob, provider, queries: list[QueryIn], snapshot: dict) -> ProviderRun:
    if provider.availability() not in (Availability.AVAILABLE, Availability.LIMITED):
        return ProviderRun("UNAVAILABLE")
    budget = budget_for(job.depth)
    terms = snapshot.get("exclude_terms", [])
    run = ProviderRun("COMPLETED")
    try:
        if getattr(provider, "uses_queries", True):
            raws: list[RawResult] = []
            for q in queries:
                if budget.exhausted:
                    run.notes.append("budget reached")
                    break
                results, from_cache = cached_search(provider, q, budget)
                raws.extend(results)
                run.cached += len(results) if from_cache else 0
        else:
            urls = snapshot.get(provider.config_key, [])
            if not urls:
                return ProviderRun("SKIPPED")
            budget.max_results = 10
            raws, problems = provider.fetch_urls(urls, budget)
            run.notes.extend(problems)
    except ProviderError as exc:
        return ProviderRun("FAILED", notes=[str(exc)[:200]], spent_usd=budget.spent_usd)

    for raw in raws:
        item = provider.normalize(raw)
        if not item.excerpt or _excluded(item, terms):
            continue
        run.found += 1
        run.stored += _store(job, item)
    run.spent_usd = budget.spent_usd
    return run


def _stage_status(runs: dict[str, ProviderRun]) -> str:
    statuses = {r.status for r in runs.values()}
    if not runs or statuses <= {"SKIPPED", "UNAVAILABLE"}:
        return JobStage.Status.SKIPPED
    if "COMPLETED" in statuses:
        return JobStage.Status.COMPLETED
    return JobStage.Status.FAILED


def collect_evidence(job: ResearchJob) -> ResearchJob:
    snapshot = job.config_snapshot
    queries = [QueryIn(q["text"], q["intent"]) for q in snapshot.get("queries", [])]
    queries = queries[: DEPTH_BUDGETS[job.depth]["queries"]]

    set_stage(
        job, "idea_analysis", JobStage.Status.COMPLETED, f"{len(queries)} search quer{'y' if len(queries) == 1 else 'ies'} prepared"
    )

    coverage: dict[str, str] = {}
    spent = 0.0
    selected = snapshot.get("sources", [])
    for key in selected:
        if key not in registry.PROVIDERS:
            coverage[key] = "UNAVAILABLE"

    for stage in PROVIDER_STAGES:
        providers = [
            registry.PROVIDERS[k]
            for k in selected
            if k in registry.PROVIDERS and getattr(registry.PROVIDERS[k], "stage", "web_research") == stage
        ]
        if not providers:
            set_stage(job, stage, JobStage.Status.SKIPPED, "No sources selected for this stage")
            continue
        set_stage(job, stage, JobStage.Status.PROCESSING, ", ".join(p.label for p in providers))
        runs = {p.key: run_provider(job, p, queries, snapshot) for p in providers}
        for k, r in runs.items():
            coverage[k] = r.status
            spent += r.spent_usd
        labels = {p.key: p.label for p in providers}
        set_stage(job, stage, _stage_status(runs), " · ".join(r.summary(labels[k]) for k, r in runs.items()))

    for stage, reason in NOT_YET_AVAILABLE.items():
        set_stage(job, stage, JobStage.Status.SKIPPED, reason)

    job.coverage = coverage
    job.cost_usd = round(spent, 4)
    counted = {k: v for k, v in coverage.items() if v != "SKIPPED"}
    ok = [v for v in counted.values() if v == "COMPLETED"]
    if not ok:
        job.status = ResearchJob.Status.FAILED
    elif len(ok) < len(counted):
        job.status = ResearchJob.Status.PARTIALLY_COMPLETED
    else:
        job.status = ResearchJob.Status.COMPLETED
    job.completed_at = timezone.now()
    job.save(update_fields=["coverage", "cost_usd", "status", "completed_at"])
    return job
