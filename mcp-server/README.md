# ValidMe MCP server

Lets Claude (Claude Code, Claude Desktop) validate startup ideas with ValidMe: start research, read the report,
search the evidence and get a first-10-customers plan. It's a thin stdio wrapper around the ValidMe REST API.

## 1. Get an API key
Sign in to ValidMe → **Settings → API keys** → Create key. The key is shown once. It can read your projects and start
research (which spends your credits); it can't change your account or create other keys. Revoke it there if it leaks.

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

The server's instructions tell Claude to state only claims backed by returned evidence, show score and confidence
together, and call hypothesis channels hypotheses. Nothing here contacts anyone on your behalf.

## Test
```bash
pip install -e ".[dev]"
pytest
```
