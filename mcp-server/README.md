# ValidMe MCP server

Lets Claude (Claude Code, Claude Desktop) validate startup ideas with ValidMe: start research, read the report,
search the evidence and get a first-10-customers plan. It's a thin stdio wrapper around the ValidMe REST API.

## 1. Get an API key
Sign in to ValidMe → **Settings → API keys** → Create key, and choose what it may do (see Permissions below). The key is
shown once. By default it can read your projects, monitoring and Lab results, and start research (which spends your
credits); it can't change your account or create other keys. Revoke it there if it leaks.

## 2. Install
Python 3.11+.
```bash
cd mcp-server
pip install -e .
```
This installs the `validme-mcp` command.

## 3. Connect Claude
**Claude Code**
```bash
claude mcp add validme --scope user -e VALIDME_API_URL=https://<your-validme-host>/api -e VALIDME_API_KEY=<key> -- validme-mcp
```

**Claude Desktop** (Settings → Developer → Edit config)
```json
{
  "mcpServers": {
    "validme": {
      "command": "validme-mcp",
      "env": { "VALIDME_API_URL": "https://<your-validme-host>/api", "VALIDME_API_KEY": "<key>" }
    }
  }
}
```

| Variable | Default | Meaning |
|---|---|---|
| `VALIDME_API_URL` | `http://localhost:8000/api` | API base (the web app's `/api` proxy works too) |
| `VALIDME_API_KEY` | — | Required for live data |
| `VALIDME_MOCK` | `0` | `1` returns clearly-labelled sample data (`sample: true`), no backend needed |

In this repo, `.mcp.json` registers it as `validme` with `VALIDME_MOCK=1`.

## Tools
| Tool | What it does |
|---|---|
| `validate_idea(idea, audience, geography, depth)` | Creates a project and launches research. **Spends credits.** Returns `job_id`, `project_id` |
| `get_research_status(job_id)` | Stages and per-source coverage (`COMPLETED`, `PARTIALLY_COMPLETED`, `FAILED`) |
| `get_report(project_id, report_id?)` | The report: score + confidence, demand, pain points, competitors, market gaps, audience, distribution; cited records in `evidence_index` |
| `list_reports(project_id)` | Report versions, newest first |
| `search_evidence(project_id, query, category)` | Stored evidence with source links and dates |
| `list_competitors(project_id)` | Competitors with verified-or-unavailable pricing and gaps |
| `suggest_channels(project_id)` | Channels (Researched vs Hypothesis), threads, first-10 plan, audience segments |
| `list_watches(project_id)` | Monitored competitor pages (`monitoring:read`) |
| `list_changes(project_id)` | Detected page changes with significance (`monitoring:read`) |
| `list_signals(project_id, status)` | Opportunity Radar signals with their factual basis (`monitoring:read`) |
| `get_score_history(project_id)` | Score over time: reports and weekly re-checks (`monitoring:read`) |
| `update_signal(project_id, signal_id, status, feedback, confirm)` | Mark a signal seen / acted / dismissed. **Confirm action** (`monitoring:write`) |
| `get_lab_results(project_id)` | Test pages (views, sign-ups, price test) and survey aggregates with sample-size messages; never emails or answers (`lab:read`) |
| `get_predicted_vs_actual(project_id)` | Research prediction vs your experiments, and assumptions with survey verdicts (`lab:read`) |
| `set_assumption_status(project_id, assumption_id, status, note, confirm)` | Set an assumption's status, or `follow_survey`. **Confirm action** (`assumptions:write`) |

**Confirm actions** change data. Called without `confirm=true` they only return what would change (`confirm_required`)
and a `confirm_token`; the confirming call needs that token, so it can't skip the preview or confirm a different change
(tokens last about 10 minutes and only for this server process). The server's instructions tell Claude to ask you before
confirming, and tools are marked read-only or not so your MCP client can ask too.

## Permissions (API key scopes)
Each key has scopes, chosen when you create it and editable in **Settings → API keys**. Anything a key's scopes don't
cover is refused (default deny), and some things are never possible with a key: managing keys or your account, billing,
creating watches, publishing or deleting Lab pages and surveys, and reading waitlist emails or survey answers.

| Scope | Allows | Default |
|---|---|---|
| `research:read` | Projects, reports, evidence, assumptions | on |
| `research:run` | Start research (spends credits) | on |
| `monitoring:read` | Watches, changes, new competitors, Radar signals, score history | on |
| `lab:read` | Lab pages, surveys and results as counts | on |
| `monitoring:write` | Mark Radar signals seen / acted on / dismissed | off |
| `assumptions:write` | Set an assumption's status or note | off |

Keys created before scopes existed have the four default scopes, which is what they could already do.

The server's instructions tell Claude to state only claims backed by returned evidence, show score and confidence
together, and call hypothesis channels hypotheses. Nothing here contacts anyone on your behalf.

## Test
```bash
pip install -e ".[dev]"
pytest
```
