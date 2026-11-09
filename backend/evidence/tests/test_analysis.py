"""Week 3: near-duplicates, classification, themes, evidence explorer API. The LLM is faked."""

from datetime import UTC, datetime
from decimal import Decimal

import pytest

from evidence import analysis
from evidence.models import Evidence, EvidenceCluster
from projects.models import IdeaDefinition, Project
from research.ai import client as llm
from research.ai.client import LLMResult
from research.models import ResearchJob

TEXT = "We count every shelf on a clipboard each Sunday and it takes our chef about two hours to finish."


def make_evidence(project, job, url, text, provider="hackernews", **kw):
    return Evidence.objects.create(
        project=project,
        job=job,
        provider=provider,
        source_url=url,
        title="t",
        excerpt=text,
        retrieved_at=datetime.now(UTC),
        content_hash=str(abs(hash((url, text)))),
        **kw,
    )


@pytest.fixture
def setup(user):
    project = Project.objects.create(owner=user, name="Restaurant stock", status="COMPLETED")
    IdeaDefinition.objects.create(project=project, original_description="Stock counting app for small restaurants.")
    job = ResearchJob.objects.create(project=project, idempotency_key="k", status="RUNNING")
    return project, job


@pytest.fixture
def fake_llm(monkeypatch, settings):
    settings.ANTHROPIC_API_KEY = "test-key"
    settings.LLM_PROVIDER = "anthropic"
    replies: list = []

    def complete_json(prompt, schema, **kwargs):
        reply = replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return LLMResult(data=reply, model="claude-opus-5-5", input_tokens=1, output_tokens=1, cost_usd=Decimal("0.01"))

    monkeypatch.setattr(analysis.llm, "complete_json", complete_json)
    return replies


# ---------------------------------------------------------------- near-duplicates
def test_simhash_close_for_reposts_far_for_different_text():
    a = analysis.simhash(TEXT)
    # Reposts usually differ only in case, punctuation and spacing: those must be identical.
    b = analysis.simhash(TEXT.upper().replace(" ", "  ").replace(".", "!!"))
    c = analysis.simhash("Our pricing page converts badly and nobody upgrades from the free plan at all.")
    assert analysis.hamming(a, b) == 0
    assert analysis.hamming(a, analysis.simhash(TEXT)) == 0
    assert analysis.hamming(a, c) > analysis.SIMHASH_DISTANCE


def test_reposts_on_other_urls_merge_into_the_original(setup):
    project, job = setup
    original = make_evidence(project, job, "https://a.test/1", TEXT)
    copy = make_evidence(project, job, "https://b.test/2", TEXT + " ")  # same words, other site
    other = make_evidence(project, job, "https://c.test/3", "Completely different complaint about supplier invoices piling up.")
    assert analysis.mark_near_duplicates(job) == 1
    copy.refresh_from_db()
    other.refresh_from_db()
    assert copy.duplicate_of_id == original.id
    assert other.duplicate_of_id is None


# ---------------------------------------------------------------- classification
def test_classify_stores_ai_fields_only(setup, fake_llm):
    project, job = setup
    e = make_evidence(project, job, "https://a.test/1", TEXT)
    fake_llm.append({"results": [{"id": e.id, "category": "pain_point", "relevance": 0.91}]})
    result = analysis.AnalysisResult()
    analysis.classify(job, result)
    e.refresh_from_db()
    assert (e.category, e.relevance) == ("pain_point", 0.91)
    assert e.classifier_version == "classify_v1@claude-opus-5-5"
    assert e.excerpt == TEXT  # source text untouched
    assert result.classified == 1


def test_classify_rejects_unknown_ids(setup, fake_llm):
    project, job = setup
    e = make_evidence(project, job, "https://a.test/1", TEXT)
    fake_llm.append({"results": [{"id": e.id + 999, "category": "pain_point", "relevance": 0.9}]})
    result = analysis.AnalysisResult()
    analysis.classify(job, result)
    e.refresh_from_db()
    assert e.category == "unclassified"
    assert result.unclassified == 1 and "unknown evidence" in result.summary()


def test_classify_failure_leaves_unclassified_and_records_cost(setup, fake_llm):
    project, job = setup
    make_evidence(project, job, "https://a.test/1", TEXT)
    fake_llm.append(llm.LLMInvalidOutput("bad", cost_usd=Decimal("0.02")))
    result = analysis.AnalysisResult()
    analysis.classify(job, result)
    assert result.unclassified == 1 and result.cost_usd == Decimal("0.02")


# ---------------------------------------------------------------- themes
def test_cluster_creates_themes_with_computed_confidence(setup, fake_llm):
    project, job = setup
    items = [
        make_evidence(
            project,
            job,
            f"https://s{i}.test/x",
            f"{TEXT} variant {i} with different trailing words {i * 7}",
            provider="hackernews" if i % 2 else "stackexchange",
            category="pain_point",
            relevance=0.8,
        )
        for i in range(5)
    ]
    fake_llm.append(
        {
            "themes": [
                {
                    "name": "Manual counts take hours",
                    "category": "pain_point",
                    "summary": "Counting is slow.",
                    "severity": "high",
                    "evidence_ids": [e.id for e in items],
                }
            ]
        }
    )
    result = analysis.AnalysisResult()
    analysis.cluster(job, result)
    c = EvidenceCluster.objects.get()
    assert c.confidence == "high"  # 5 distinct sources across 2 providers, computed not asked
    assert c.severity == "high" and c.ai_summary == "Counting is slow." and c.job_id == job.id
    assert set(c.evidence.values_list("id", flat=True)) == {e.id for e in items}


def test_cluster_rejects_unknown_ids(setup, fake_llm):
    project, job = setup
    a = make_evidence(project, job, "https://a.test/1", TEXT, category="pain_point", relevance=0.8)
    make_evidence(project, job, "https://b.test/1", TEXT + " again", category="workaround", relevance=0.8)
    fake_llm.append(
        {
            "themes": [
                {"name": "Invented theme", "category": "pain_point", "summary": "s", "severity": "low", "evidence_ids": [a.id, 424242]}
            ]
        }
    )
    result = analysis.AnalysisResult()
    analysis.cluster(job, result)
    assert EvidenceCluster.objects.count() == 0 and "rejected" in result.summary()


def test_without_ai_evidence_stays_unclassified(setup, settings):
    settings.ANTHROPIC_API_KEY = ""
    project, job = setup
    make_evidence(project, job, "https://a.test/1", TEXT)
    result = analysis.analyze_evidence(job)
    assert result.unclassified == 1 and "AI unavailable" in result.summary()


# ---------------------------------------------------------------- explorer API
def test_explorer_filters_and_hides_duplicates(api, setup):
    project, job = setup
    orig = make_evidence(project, job, "https://a.test/1", TEXT, category="pain_point", relevance=0.9)
    make_evidence(project, job, "https://b.test/1", TEXT + "!", duplicate_of=orig)
    make_evidence(project, job, "https://c.test/1", "Looking for a better tool, happy to pay", category="buying_intent", relevance=0.5)
    body = api.get(f"/api/evidence?project={project.id}").json()
    assert body["count"] == 2
    first = body["results"][0]
    assert first["id"] == orig.id and first["duplicates"] == 1  # ordered by relevance
    assert first["classification"]["category"] == "pain_point"
    assert api.get(f"/api/evidence?project={project.id}&category=buying_intent").json()["count"] == 1
    assert api.get(f"/api/evidence?project={project.id}&q=better tool").json()["count"] == 1
    assert api.get(f"/api/evidence?project={project.id}&duplicates=1").json()["count"] == 3
    facets = api.get(f"/api/evidence/facets?project={project.id}").json()
    assert facets["categories"] == {"pain_point": 1, "buying_intent": 1} and facets["duplicates"] == 1


def test_save_toggle_only(api, setup):
    project, job = setup
    e = make_evidence(project, job, "https://a.test/1", TEXT)
    assert api.patch(f"/api/evidence/{e.id}", {"saved_by_user": True}, format="json").status_code == 200
    assert api.get(f"/api/evidence?project={project.id}&saved=1").json()["count"] == 1
    assert api.patch(f"/api/evidence/{e.id}", {"excerpt": "rewritten"}, format="json").status_code == 400
    e.refresh_from_db()
    assert e.excerpt == TEXT


def test_explorer_owner_isolation(api, other_api, setup):
    project, job = setup
    e = make_evidence(project, job, "https://a.test/1", TEXT)
    EvidenceCluster.objects.create(project=project, name="Theme", category="pain_point")
    assert other_api.get("/api/evidence").json()["count"] == 0
    assert other_api.get(f"/api/evidence?project={project.id}").json()["count"] == 0
    assert other_api.get(f"/api/evidence/{e.id}").status_code == 404
    assert other_api.patch(f"/api/evidence/{e.id}", {"saved_by_user": True}, format="json").status_code == 404
    assert other_api.get(f"/api/evidence/clusters?project={project.id}").json() == []
    assert other_api.get(f"/api/evidence/facets?project={project.id}").json()["total"] == 0


def test_bad_project_id_is_400(api):
    assert api.get("/api/evidence?project=not-a-uuid").status_code == 400
