import pytest

from validme_mcp import server
from validme_mcp.client import ValidMeClient


@pytest.fixture(autouse=True)
def mock_client(monkeypatch):
    monkeypatch.setattr(server, "_client", ValidMeClient(use_mock=True))


def test_validate_idea_rejects_short_idea():
    assert "error" in server.validate_idea("too short", "founders")


def test_validate_idea_mock_flow():
    job = server.validate_idea("A tool that helps independent restaurants track inventory and reduce waste", "restaurant owners")
    assert job["sample"] is True and job["estimated_credits"] == 2
    status = server.get_research_status(job["job_id"])
    assert status["status"] == "COMPLETED"
    report = server.get_report(status["project_id"])
    for pain in report["pain_points"]:
        assert pain["evidence_ids"], "every pain point must cite evidence"


def test_search_evidence_filters_by_category():
    res = server.search_evidence("prj_sample", category="feature_request")
    assert [e["id"] for e in res["results"]] == ["ev_2"]


def test_channels_label_hypotheses():
    res = server.suggest_channels("prj_sample")
    assert all("is_hypothesis" in c for c in res["channels"])


def test_missing_api_key_returns_error(monkeypatch):
    monkeypatch.setattr(server, "_client", ValidMeClient(api_key="", use_mock=False))
    assert "VALIDME_API_KEY" in server.get_report("x")["error"]


@pytest.mark.anyio
async def test_tools_are_registered():
    names = {t.name for t in await server.server.list_tools()}
    assert names == {
        "validate_idea", "get_research_status", "get_report",
        "search_evidence", "list_competitors", "suggest_channels",
    }
