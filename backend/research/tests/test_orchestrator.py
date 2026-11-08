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
