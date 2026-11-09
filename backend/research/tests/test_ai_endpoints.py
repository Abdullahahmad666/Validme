"""Interpret + query generation endpoints. The LLM is faked; we test storage, isolation and errors."""

from decimal import Decimal

import pytest

from billing.models import UsageTransaction
from projects.models import Project
from research.ai import client as llm
from research.ai.client import LLMResult
from research.models import ResearchQuery

IDEA = "A tool that helps independent restaurants track inventory and reduce food waste."

INTERPRETATION = {
    "problem": "Owners waste food and time on manual stock counts.",
    "solution": "A quick weekly counting app for one-location restaurants.",
    "target_customers": ["single-location restaurant owners"],
    "category": "Inventory management",
    "industry": "Food service",
    "customer_type": "B2B",
    "suggested_audiences": ["restaurant owners", "head chefs"],
    "suggested_geographies": [],
    "assumptions": ["Owners will pay monthly to save time on counts"],
    "clarifying_questions": [],
}


@pytest.fixture
def project(api):
    r = api.post("/api/projects", {"name": "Restaurant inventory", "description": IDEA}, format="json")
    assert r.status_code == 201, r.content
    return r.json()["id"]


@pytest.fixture
def fake_llm(monkeypatch, settings):
    settings.ANTHROPIC_API_KEY = "test-key"
    settings.LLM_PROVIDER = "anthropic"
    replies: list[dict] = []

    def complete_json(prompt, schema, **kwargs):
        return LLMResult(data=replies.pop(0), model="claude-opus-5-5", input_tokens=10, output_tokens=5, cost_usd=Decimal("0.001"))

    monkeypatch.setattr("research.ai.tasks.complete_json", complete_json)
    return replies


def test_interpret_stores_ai_output_without_touching_founder_text(api, project, fake_llm, user):
    fake_llm.append(INTERPRETATION)
    r = api.post(f"/api/projects/{project}/interpret")
    assert r.status_code == 200, r.content
    assert r.json()["ai_interpretation"]["industry"] == "Food service"
    data = api.get(f"/api/projects/{project}").json()
    assert data["description"] == IDEA  # founder's words untouched
    assert data["ai_interpretation"]["problem"].startswith("Owners waste")
    assert data["interpretation_confirmed"] is False
    assert data["industry"] == ""  # suggestions are not silently applied to the market step
    ledger = UsageTransaction.objects.get(user=user, operation="ai_interpret")
    assert ledger.credits == 0
    assert ledger.cost_usd == Decimal("0.001")


def test_generate_queries_keeps_founder_queries(api, project, fake_llm):
    mine = api.post(f"/api/projects/{project}/queries", {"text": "my own query", "intent": "buying_intent"}, format="json")
    assert mine.status_code == 201
    fake_llm.append(
        {
            "queries": [
                {"text": "restaurant stock spreadsheet", "intent": "problem_discovery"},
                {"text": "Restaurant  stock spreadsheet", "intent": "problem_discovery"},
                {"text": "best inventory app small restaurant", "intent": "buying_intent"},
            ]
        }
    )
    r = api.post(f"/api/projects/{project}/keywords/generate", {}, format="json")
    assert r.status_code == 200, r.content
    texts = sorted(q["text"] for q in r.json()["results"])
    assert texts == ["best inventory app small restaurant", "my own query", "restaurant stock spreadsheet"]  # deduped

    # Regenerating one group replaces only that group's unedited AI queries.
    fake_llm.append({"queries": [{"text": "walk-in fridge waste every week", "intent": "problem_discovery"}]})
    r = api.post(f"/api/projects/{project}/keywords/generate", {"intent": "problem_discovery"}, format="json")
    texts = sorted(q["text"] for q in r.json()["results"])
    assert texts == ["best inventory app small restaurant", "my own query", "walk-in fridge waste every week"]


def test_bad_intent_rejected(api, project, fake_llm):
    r = api.post(f"/api/projects/{project}/keywords/generate", {"intent": "world_domination"}, format="json")
    assert r.status_code == 400


def test_ai_unavailable_without_key(api, project, settings):
    settings.ANTHROPIC_API_KEY = ""
    r = api.post(f"/api/projects/{project}/interpret")
    assert r.status_code == 503
    assert r.json()["error"]["code"] == "ai_unavailable"


def test_ai_failure_saves_nothing(api, project, monkeypatch, settings):
    settings.ANTHROPIC_API_KEY = "test-key"

    def boom(*a, **k):
        raise llm.LLMInvalidOutput("bad")

    monkeypatch.setattr("research.ai.tasks.complete_json", boom)
    r = api.post(f"/api/projects/{project}/interpret")
    assert r.status_code == 502
    assert api.get(f"/api/projects/{project}").json()["ai_interpretation"] == {}


def test_other_user_cannot_use_ai_endpoints(project, other_api, fake_llm):
    fake_llm.append(INTERPRETATION)
    assert other_api.post(f"/api/projects/{project}/interpret").status_code == 404
    assert other_api.post(f"/api/projects/{project}/keywords/generate", {}, format="json").status_code == 404


def test_only_drafts(api, project, fake_llm):
    Project.objects.filter(pk=project).update(status="RESEARCHING")
    assert api.post(f"/api/projects/{project}/interpret").status_code == 400
    assert ResearchQuery.objects.count() == 0
