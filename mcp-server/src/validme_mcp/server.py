"""ValidMe MCP server: exposes idea-validation tools to Claude / Claude Code over stdio."""

from __future__ import annotations

from typing import Any, Literal

from mcp.server.mcpserver import MCPServer

from validme_mcp.client import ValidMeClient, ValidMeError

INSTRUCTIONS = (
    "ValidMe researches startup ideas using source-linked evidence. "
    "Start with validate_idea, poll get_research_status, then get_report. "
    "Only state claims that appear in returned evidence, show score and confidence together, "
    "and label channels with is_hypothesis=true as hypotheses. If a payload has sample=true, "
    "tell the user it is sample data. "
    "Monitoring, Radar and Lab tools read the founder's own data; Lab results are counts, so report the sample-size "
    "message with any rate. update_signal and set_assumption_status change data: call them without confirm first, "
    "show the user what will change, and only call again with confirm=true after they agree. "
    "If a tool says the API key lacks a permission, tell the user which one and that they can add it in "
    "ValidMe → Settings → API keys."
)

server = MCPServer("validme", instructions=INSTRUCTIONS)
_client: ValidMeClient | None = None


def client() -> ValidMeClient:
    global _client
    if _client is None:
        _client = ValidMeClient()
    return _client


def _safe(fn, *args: Any) -> dict[str, Any]:
    try:
        return fn(*args)
    except ValidMeError as exc:
        return {"error": str(exc)}


@server.tool()
def validate_idea(
    idea: str,
    audience: str,
    geography: str = "Global",
    depth: Literal["quick", "standard", "deep"] = "standard",
) -> dict[str, Any]:
    """Start a ValidMe research job for a startup idea. Spends credits. Returns job_id and project_id."""
    if len(idea.strip()) < 30:
        return {"error": "Describe the idea in at least 30 characters (problem, who has it, proposed solution)."}
    return _safe(client().start_research, idea.strip(), audience.strip(), geography.strip(), depth)


@server.tool()
def get_research_status(job_id: str) -> dict[str, Any]:
    """Get stage-by-stage status and source coverage for a research job."""
    return _safe(client().job_status, job_id)


@server.tool()
def get_report(project_id: str, report_id: int | None = None) -> dict[str, Any]:
    """Get the opportunity report (latest, or a version from list_reports): score + confidence, demand, pain points,
    competitors, market gaps, audience segments and distribution. Cited records are in evidence_index."""
    return _safe(client().report, project_id, report_id)


@server.tool()
def list_reports(project_id: str) -> dict[str, Any]:
    """List every report version for a project, newest first, with score and confidence."""
    return _safe(client().history, project_id)


@server.tool()
def search_evidence(project_id: str, query: str = "", category: str = "") -> dict[str, Any]:
    """Search stored evidence for a project. category: pain_point, feature_request, alternative_seeking,
    pricing_objection, buying_intent, workaround, positive_feedback."""
    return _safe(client().evidence, project_id, query, category)


@server.tool()
def list_competitors(project_id: str) -> dict[str, Any]:
    """List competitors found for a project with pricing, gaps and dated sources."""
    data = _safe(client().report, project_id)
    if "error" in data:
        return data
    return {"project_id": project_id, "competitors": data.get("competitors", []), "sample": data.get("sample", False)}


@server.tool()
def suggest_channels(project_id: str) -> dict[str, Any]:
    """Where to find the first customers, with evidence or hypothesis labels, plus the first-10 action plan."""
    data = _safe(client().report, project_id)
    if "error" in data:
        return data
    dist = data.get("distribution") or {}
    return {
        "project_id": project_id,
        "channels": dist.get("channels", []),
        "threads": dist.get("threads", []),
        "first_ten_plan": dist.get("first_ten_plan", []),
        "audience_segments": (data.get("audience") or {}).get("segments", []),
        "sample": data.get("sample", False),
    }


# --- Week 15: monitoring, Radar and the Lab ---------------------------------------------------------------------


@server.tool()
def list_watches(project_id: str) -> dict[str, Any]:
    """Competitor pages being monitored for a project (needs the monitoring:read permission)."""
    return _safe(client().watches, project_id)


@server.tool()
def list_changes(project_id: str) -> dict[str, Any]:
    """Detected changes on monitored pages (prices, content), newest first, with significance (monitoring:read)."""
    return _safe(client().changes, project_id)


@server.tool()
def list_signals(project_id: str, status: Literal["open", "new", "acted", "dismissed", "all"] = "open") -> dict[str, Any]:
    """Opportunity Radar signals with their factual basis and confidence (monitoring:read). A signal is a reason to
    look closer, not proof."""
    return _safe(client().signals, project_id, status)


@server.tool()
def get_score_history(project_id: str) -> dict[str, Any]:
    """Score over time: report scores and weekly re-checks (monitoring:read). Points with different scoring_version
    values aren't comparable."""
    return _safe(client().score_history, project_id)


@server.tool()
def update_signal(
    project_id: str,
    signal_id: int,
    status: Literal["seen", "acted", "dismissed"],
    feedback: Literal["", "useful", "not_useful"] = "",
    confirm: bool = False,
) -> dict[str, Any]:
    """Mark a Radar signal as seen, acted on or dismissed (needs monitoring:write). Without confirm=true this only
    describes the change: ask the user, then call again with confirm=true."""
    if not confirm:
        return {
            "confirm_required": True,
            "would_change": {"project_id": project_id, "signal_id": signal_id, "status": status, "feedback": feedback or None},
            "next": "Ask the user to confirm, then call update_signal again with confirm=true.",
        }
    return _safe(client().update_signal, project_id, signal_id, status, feedback)


@server.tool()
def get_lab_results(project_id: str) -> dict[str, Any]:
    """Validation Lab results: each test page's views, sign-ups and price test, and each survey's aggregate answers,
    with sample-size messages (lab:read). Never includes emails or individual answers."""
    return _safe(client().lab_results, project_id)


@server.tool()
def get_predicted_vs_actual(project_id: str) -> dict[str, Any]:
    """What research predicted (demand, willingness to pay) next to the founder's experiment results, and each
    assumption with what their surveys say (lab:read). Experiments are the strongest evidence."""
    return _safe(client().predicted_vs_actual, project_id)


@server.tool()
def set_assumption_status(
    project_id: str,
    assumption_id: int,
    status: Literal["untested", "supported", "contradicted", "follow_survey"],
    note: str = "",
    confirm: bool = False,
) -> dict[str, Any]:
    """Set an assumption's status (the founder's call, which overrides survey results) or hand it back to the survey
    result with status="follow_survey" (needs assumptions:write). Without confirm=true this only describes the change."""
    body: dict[str, Any] = {"follow_experiments": True} if status == "follow_survey" else {"status": status}
    if note.strip():
        body["note"] = note.strip()[:1000]
    if not confirm:
        return {
            "confirm_required": True,
            "would_change": {"project_id": project_id, "assumption_id": assumption_id, **body},
            "next": "Ask the user to confirm, then call set_assumption_status again with confirm=true.",
        }
    return _safe(client().set_assumption, project_id, assumption_id, body)


def main() -> None:
    server.run("stdio")


if __name__ == "__main__":
    main()
