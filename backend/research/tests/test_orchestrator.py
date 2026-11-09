"""Coverage honesty and dedupe, with fake providers (no network)."""

from datetime import UTC, datetime

import pytest

from accounts.models import User
from evidence.models import Evidence
from projects.models import Project
from research.models import ResearchJob
from research.providers import registry
from research.providers.base import Availability, EvidenceIn, ProviderError, RawResult
from research.providers.hackernews import HackerNewsProvider
from research.services import collect_evidence


class FakeOK:
    key, label, contributes = "fake_ok", "Fake", "test"

    def availability(self):
        return Availability.AVAILABLE

    def search(self, query, budget):
        # the same text twice from the same URL -> must be stored once
        return [RawResult(self.key, {"u": "https://example.com/a", "t": "Too expensive"})] * 2

    def normalize(self, raw):
        return EvidenceIn(self.key, raw.data["u"], "t", raw.data["t"], datetime.now(UTC))


class FakeBroken(FakeOK):
    key = "fake_broken"

    def search(self, query, budget):
        raise ProviderError("boom")


@pytest.fixture
def job(db, monkeypatch):
    monkeypatch.setattr(registry, "PROVIDERS", {"fake_ok": FakeOK(), "fake_broken": FakeBroken()})
    owner = User.objects.create_user("o", "o@example.com", "pw-12345678")
    project = Project.objects.create(owner=owner, name="P")
    return ResearchJob.objects.create(
        project=project,
        idempotency_key="x",
        config_snapshot={
            "sources": ["fake_ok", "fake_broken", "reddit"],
            "queries": [{"text": "q", "intent": "problem_discovery"}],
        },
    )


def test_partial_coverage_is_recorded(job):
    job = collect_evidence(job)
    assert job.status == ResearchJob.Status.PARTIALLY_COMPLETED
    assert job.coverage == {"fake_ok": "COMPLETED", "fake_broken": "FAILED", "reddit": "UNAVAILABLE"}


def test_duplicates_counted_once(job):
    collect_evidence(job)
    assert Evidence.objects.count() == 1


def test_hackernews_normalize_strips_html():
    raw = RawResult(
        "hackernews",
        {
            "objectID": "42",
            "comment_text": "<p>Too &amp; expensive</p>",
            "author": "pg",
            "created_at": "2026-10-20T10:00:00Z",
            "story_title": "Ask HN",
        },
    )
    ev = HackerNewsProvider().normalize(raw)
    assert ev.source_url == "https://news.ycombinator.com/item?id=42"
    assert ev.excerpt == "Too & expensive"
    assert str(ev.published_at) == "2026-10-20"
    assert ev.author_hash and "pg" not in ev.author_hash


# --- Week 2: stages, cache, exclude terms, URL providers, crash handling -------------------


class CountingSearch(FakeOK):
    key = "counting"
    stage = "community_research"

    def __init__(self):
        self.calls = 0

    def search(self, query, budget):
        self.calls += 1
        return [
            RawResult(self.key, {"u": "https://example.com/1", "t": "We waste food every week"}),
            RawResult(self.key, {"u": "https://example.com/2", "t": "Hiring a chef, jobs board"}),
        ]


class FakeUrls:
    key, label, contributes = "fake_urls", "Links", "test"
    stage = "web_research"
    uses_queries = False
    config_key = "evidence_urls"

    def availability(self):
        return Availability.AVAILABLE

    def fetch_urls(self, urls, budget):
        return [RawResult(self.key, {"u": u, "t": f"page {u}"}) for u in urls], []

    def normalize(self, raw):
        return EvidenceIn(self.key, raw.data["u"], "t", raw.data["t"], datetime.now(UTC))


def _job(project, sources, **snapshot):
    from research.services import create_stages

    job = ResearchJob.objects.create(
        project=project,
        idempotency_key=f"k-{ResearchJob.objects.count()}",
        depth="quick",
        config_snapshot={"sources": sources, "queries": [{"text": "q", "intent": "problem_discovery"}], **snapshot},
    )
    create_stages(job)
    return job


@pytest.fixture
def owner_project(db):
    owner = User.objects.create_user("w", "w@example.com", "pw-12345678")
    return Project.objects.create(owner=owner, name="P")


def test_stages_record_real_progress(owner_project, monkeypatch):
    counting = CountingSearch()
    monkeypatch.setattr(registry, "PROVIDERS", {"counting": counting, "fake_urls": FakeUrls()})
    job = collect_evidence(_job(owner_project, ["counting", "fake_urls"], evidence_urls=[]))
    stages = {s.name: s for s in job.stages.all()}
    assert stages["idea_analysis"].status == "COMPLETED"
    assert stages["community_research"].status == "COMPLETED"
    assert stages["community_research"].detail == "Fake: 2 found, 2 new"
    assert stages["web_research"].status == "SKIPPED"  # URL provider with no URLs: skipped, not failed
    assert stages["competitor_analysis"].status == "SKIPPED"
    # Analysis runs; without an AI key it merges duplicates and says evidence stays unclassified.
    assert stages["evidence_analysis"].status == "COMPLETED"
    assert "AI unavailable" in stages["evidence_analysis"].detail
    assert job.coverage == {"counting": "COMPLETED", "fake_urls": "SKIPPED"}
    assert job.status == ResearchJob.Status.COMPLETED  # skipped sources don't make a job partial


def test_url_provider_reads_snapshot_urls(owner_project, monkeypatch):
    monkeypatch.setattr(registry, "PROVIDERS", {"fake_urls": FakeUrls()})
    job = collect_evidence(_job(owner_project, ["fake_urls"], evidence_urls=["https://a.test/1", "https://a.test/2"]))
    assert job.coverage == {"fake_urls": "COMPLETED"}
    assert Evidence.objects.filter(job=job).count() == 2


def test_search_cache_serves_repeat_queries(owner_project, monkeypatch):
    counting = CountingSearch()
    monkeypatch.setattr(registry, "PROVIDERS", {"counting": counting})
    collect_evidence(_job(owner_project, ["counting"]))
    job2 = collect_evidence(_job(owner_project, ["counting"]))
    assert counting.calls == 1  # second job hit the 7-day cache
    # ...but cache hits are never shown: that would reveal another user's recent searches.
    assert "cache" not in job2.stages.get(name="community_research").detail


def test_exclude_terms_filter_evidence(owner_project, monkeypatch):
    monkeypatch.setattr(registry, "PROVIDERS", {"counting": CountingSearch()})
    job = collect_evidence(_job(owner_project, ["counting"], exclude_terms=["JOBS"]))
    assert list(Evidence.objects.filter(job=job).values_list("excerpt", flat=True)) == ["We waste food every week"]


def test_task_marks_failure_visibly(owner_project, monkeypatch):
    from research.tasks import run_research_job

    def explode(job):
        from research.services import set_stage

        set_stage(job, "web_research", "PROCESSING")
        raise RuntimeError("bug")

    monkeypatch.setattr("research.tasks.collect_evidence", explode)
    owner_project.status = "RESEARCHING"
    owner_project.save()
    job = _job(owner_project, ["counting"])
    with pytest.raises(RuntimeError):
        run_research_job.run(str(job.id))
    job.refresh_from_db()
    owner_project.refresh_from_db()
    assert job.status == ResearchJob.Status.FAILED
    assert job.stages.get(name="web_research").status == "FAILED"
    assert owner_project.status == "DRAFT"  # can be edited and run again
