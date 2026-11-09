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
    "tell the user it is sample data."
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


def main() -> None:
    server.run("stdio")


if __name__ == "__main__":
    main()
