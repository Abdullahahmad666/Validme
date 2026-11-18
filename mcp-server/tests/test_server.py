import pytest

from validme_mcp import server
from validme_mcp.client import ValidMeClient, ValidMeError


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
        "validate_idea",
        "get_research_status",
        "get_report",
        "search_evidence",
        "list_competitors",
        "suggest_channels",
        "list_reports",
        "list_watches",
        "list_changes",
        "list_signals",
        "get_score_history",
        "update_signal",
        "get_lab_results",
        "get_predicted_vs_actual",
        "set_assumption_status",
    }


def test_channels_come_from_report_distribution():
    res = server.suggest_channels("prj_sample")
    assert res["channels"] and res["first_ten_plan"][0]["title"]
    assert all(c["is_hypothesis"] is False or c["evidence_count"] == 0 for c in res["channels"])


def test_list_reports_mock():
    assert server.list_reports("prj_sample")["count"] == 1


def test_read_tools_return_labelled_sample_data():
    for fn in (
        server.list_watches,
        server.list_changes,
        server.list_signals,
        server.get_score_history,
        server.get_lab_results,
        server.get_predicted_vs_actual,
    ):
        assert fn("prj_sample")["sample"] is True, fn.__name__


def test_write_tools_need_confirmation(monkeypatch):
    calls = []
    monkeypatch.setattr(server.client(), "update_signal", lambda *a: calls.append(a) or {"ok": True})
    preview = server.update_signal("prj_sample", 3, "acted")
    assert preview["confirm_required"] is True and preview["would_change"]["status"] == "acted" and calls == []
    assert "error" in server.update_signal("prj_sample", 3, "acted", confirm=True)  # no preview token: refused
    assert "error" in server.update_signal("prj_sample", 3, "dismissed", confirm=True, confirm_token=preview["confirm_token"])
    assert calls == []  # a token only fits the change it previewed
    token = preview["confirm_token"]
    assert server.update_signal("prj_sample", 3, "acted", confirm=True, confirm_token=token) == {"ok": True} and len(calls) == 1


def test_set_assumption_status_body():
    preview = server.set_assumption_status("prj_sample", 4, "follow_survey", note=" from calls ")
    assert preview["would_change"] == {
        "project_id": "prj_sample",
        "assumption_id": 4,
        "follow_experiments": True,
        "note": "from calls",
    }
    token = server.set_assumption_status("prj_sample", 4, "supported")["confirm_token"]
    done = server.set_assumption_status("prj_sample", 4, "supported", confirm=True, confirm_token=token)
    assert done["sample"] is True and done["status"] == "supported"


def test_permission_errors_are_passed_on(monkeypatch):
    from validme_mcp.client import ValidMeError

    def denied(*a):
        raise ValidMeError("ValidMe API error 403: This API key doesn't have the “lab:read” permission")

    monkeypatch.setattr(server.client(), "predicted_vs_actual", denied)
    assert "lab:read" in server.get_predicted_vs_actual("prj_sample")["error"]


def test_live_client_paths_are_safe(monkeypatch):
    seen = []
    c = ValidMeClient(api_key="k", use_mock=False)
    monkeypatch.setattr(c, "_request", lambda method, path, **kw: seen.append((method, path, kw)) or {})
    c.update_signal("p-1", 7, "dismissed")
    c.set_assumption("p1", 2, {"status": "supported"})
    assert seen[0][:2] == ("PATCH", "/projects/p-1/signals/7") and seen[0][2]["json"] == {"status": "dismissed"}
    assert seen[1][:2] == ("PATCH", "/projects/p1/assumptions/2")
    for bad in ("a/b", "..", "", "x" * 65, "p 1"):
        with pytest.raises(ValidMeError):
            c.update_signal(bad, 7, "dismissed")
    with pytest.raises(ValidMeError):
        c.job_status("../api-keys")


@pytest.mark.anyio
async def test_tools_carry_read_and_write_hints():
    tools = {t.name: t.annotations for t in await server.server.list_tools()}
    assert tools["get_lab_results"].read_only_hint is True and tools["list_signals"].read_only_hint is True
    assert tools["update_signal"].read_only_hint is False and tools["set_assumption_status"].read_only_hint is False
    assert tools["validate_idea"].read_only_hint is False
