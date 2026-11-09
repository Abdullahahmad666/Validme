"""Research orchestration: run every selected provider, record coverage honestly, store deduped evidence.

Each stage writes a JobStage row as it runs, so the progress screen shows real status (no fake
percentages). Nothing is skipped silently: every provider's outcome, counts and problems are stored
in job.coverage / job.coverage_detail after each stage. One provider failing (or only partly working)
makes the job PARTIALLY_COMPLETED; only if none succeed is it FAILED.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from evidence.models import Evidence
from research.budgets import DEPTH_BUDGETS, budget_for
from research.models import JobStage, ResearchJob, SearchCache
from research.providers import registry
from research.providers.base import Availability, Budget, EvidenceIn, ProviderError, QueryIn, RawResult, normalize_url

STAGES = ["idea_analysis", "web_research", "community_research", "evidence_analysis", "competitor_analysis", "report"]
PROVIDER_STAGES = ["web_research", "community_research", "competitor_analysis"]
NOT_YET_AVAILABLE = {
    "evidence_analysis": "Classification and clustering arrive in a later release; evidence is stored unclassified.",
    "report": "The opportunity report arrives in a later release.",
}
CACHE_TTL = timedelta(days=7)
MAX_NOTES = 10


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


def can_run(snapshot: dict) -> bool:
    """True if at least one selected source would actually do something (used to refuse empty launches)."""
    for key in snapshot.get("sources", []):
        provider = registry.PROVIDERS.get(key)
        if provider is None or provider.availability() not in (Availability.AVAILABLE, Availability.LIMITED):
            continue
        if getattr(provider, "uses_queries", True) or snapshot.get(provider.config_key):
            return True
    return False


# --------------------------------------------------------------------------------------------
# Search cache: 7 days by (provider, intent, size, normalized query). Search results are public
# data and only an identical query is served. Cache hits are deliberately NOT shown to users:
# that would reveal whether someone else searched the same thing recently.
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
                license=item.license,
                author_name=item.author_name[:120],
                author_url=item.author_url[:500],
                content_hash=item.content_hash,
            )
        return True
    except IntegrityError:  # already stored for this project (same url + same text) — counted once
        return False


def exclusion_pattern(terms: list[str]) -> re.Pattern | None:
    """Whole-word, case-insensitive match ("ai" must not exclude "said")."""
    cleaned = [re.escape(t.strip()) for t in terms if t.strip()]
    return re.compile(r"\b(" + "|".join(cleaned) + r")\b", re.IGNORECASE) if cleaned else None


@dataclass
class ProviderRun:
    status: str  # COMPLETED | PARTIAL | FAILED | UNAVAILABLE | SKIPPED
    found: int = 0
    stored: int = 0
    excluded: int = 0
    queries_ok: int = 0
    queries_total: int = 0
    spent_usd: float = 0.0
    notes: list[str] = field(default_factory=list)

    def note(self, text: str) -> None:
        if len(self.notes) < MAX_NOTES:
            self.notes.append(text[:200])

    def detail(self) -> dict:
        return {
            "status": self.status,
            "found": self.found,
            "stored": self.stored,
            "excluded": self.excluded,
            "queries_ok": self.queries_ok,
            "queries_total": self.queries_total,
            "notes": self.notes,
        }

    def summary(self, label: str) -> str:
        if self.status == "SKIPPED":
            return f"{label}: nothing to read"
        if self.status == "UNAVAILABLE":
            return f"{label}: unavailable"
        if self.status == "FAILED":
            return f"{label}: failed" + (f" ({self.notes[0]})" if self.notes else "")
        parts = [f"{self.found} found, {self.stored} new"]
        if self.excluded:
            parts.append(f"{self.excluded} excluded")
        if self.queries_total and self.queries_ok < self.queries_total:
            parts.append(f"{self.queries_ok} of {self.queries_total} searches worked")
        elif self.notes:
            parts.append(f"{len(self.notes)} problem{'s' if len(self.notes) > 1 else ''}")
        return f"{label}: " + ", ".join(parts)


def run_provider(job: ResearchJob, provider, queries: list[QueryIn], snapshot: dict) -> ProviderRun:
    if provider.availability() not in (Availability.AVAILABLE, Availability.LIMITED):
        return ProviderRun("UNAVAILABLE", notes=[f"{provider.label} isn't connected"])
    budget = budget_for(job.depth)
    exclude = exclusion_pattern(snapshot.get("exclude_terms", []))
    run = ProviderRun("COMPLETED")
    raws: list[RawResult] = []

    if getattr(provider, "uses_queries", True):
        run.queries_total = len(queries)
        for q in queries:
            if budget.exhausted:
                run.note(f"Spending budget reached after {run.queries_ok} searches")
                run.queries_total = run.queries_ok
                break
            try:
                results, _from_cache = cached_search(provider, q, budget)
            except ProviderError as exc:
                run.note(str(exc))  # one failing query doesn't discard the others
                continue
            raws.extend(results)
            run.queries_ok += 1
        if run.queries_total and run.queries_ok == 0:
            run.status = "FAILED"
        elif run.queries_ok < run.queries_total:
            run.status = "PARTIAL"
    else:
        urls = snapshot.get(provider.config_key, [])
        if not urls:
            return ProviderRun("SKIPPED")
        budget.max_results = 10
        try:
            raws, problems = provider.fetch_urls(urls, budget)
        except ProviderError as exc:
            run.status = "FAILED"
            run.note(str(exc))
            raws, problems = [], []
        for p in problems:
            run.note(p)
        if problems and raws:
            run.status = "PARTIAL"

    seen: set[tuple[str, str]] = set()
    for raw in raws:
        item = provider.normalize(raw)
        if not item.excerpt:
            continue
        item.source_url = normalize_url(item.source_url)
        key = (item.source_url, item.content_hash)
        if key in seen:  # the same record returned by several queries counts once
            continue
        seen.add(key)
        if exclude and exclude.search(f"{item.title} {item.excerpt}"):
            run.excluded += 1
            continue
        run.found += 1
        run.stored += _store(job, item)
    run.spent_usd = budget.spent_usd
    return run


def _stage_status(runs: dict[str, ProviderRun]) -> str:
    statuses = {r.status for r in runs.values()}
    if not runs or statuses <= {"SKIPPED", "UNAVAILABLE"}:
        return JobStage.Status.SKIPPED
    if statuses & {"COMPLETED", "PARTIAL"}:
        return JobStage.Status.COMPLETED
    return JobStage.Status.FAILED


def _save_coverage(job: ResearchJob, coverage: dict, detail: dict, spent: float) -> None:
    job.coverage = coverage
    job.coverage_detail = detail
    job.cost_usd = round(spent, 4)
    job.save(update_fields=["coverage", "coverage_detail", "cost_usd"])


def collect_evidence(job: ResearchJob) -> ResearchJob:
    snapshot = job.config_snapshot
    queries = [QueryIn(q["text"], q["intent"]) for q in snapshot.get("queries", [])]
    queries = queries[: DEPTH_BUDGETS[job.depth]["queries"]]
    n = len(queries)
    set_stage(job, "idea_analysis", JobStage.Status.COMPLETED, f"{n} search quer{'y' if n == 1 else 'ies'} prepared")

    coverage: dict[str, str] = {}
    detail: dict[str, dict] = {}
    spent = 0.0
    selected = snapshot.get("sources", [])
    for key in selected:
        if key not in registry.PROVIDERS:
            coverage[key] = "UNAVAILABLE"
            detail[key] = ProviderRun("UNAVAILABLE", notes=["Not searched: licensed data required"]).detail()

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
            detail[k] = r.detail()
            spent += r.spent_usd
        labels = {p.key: p.label for p in providers}
        set_stage(job, stage, _stage_status(runs), " · ".join(r.summary(labels[k]) for k, r in runs.items()))
        _save_coverage(job, coverage, detail, spent)  # survives a crash in a later stage

    for stage, reason in NOT_YET_AVAILABLE.items():
        set_stage(job, stage, JobStage.Status.SKIPPED, reason)

    counted = {k: v for k, v in coverage.items() if v != "SKIPPED"}
    if not any(v in ("COMPLETED", "PARTIAL") for v in counted.values()):
        job.status = ResearchJob.Status.FAILED
    elif all(v == "COMPLETED" for v in counted.values()):
        job.status = ResearchJob.Status.COMPLETED
    else:
        job.status = ResearchJob.Status.PARTIALLY_COMPLETED
    job.completed_at = timezone.now()
    _save_coverage(job, coverage, detail, spent)
    job.save(update_fields=["status", "completed_at"])
    return job
