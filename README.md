# ValidMe

Validate a startup idea with **source-linked evidence** — real complaints, competitors and buying signals — and get a plan to reach your **first 10 customers**. Use it in the web app or straight from Claude through the ValidMe MCP server.

> Status: early development (week 0 of the [roadmap](docs/roadmap.md)).

## What's inside
| Folder | What |
|---|---|
| `backend/` | Django + DRF API, Celery research jobs, provider adapters (web search, Hacker News) |
| `frontend/` | Next.js App Router + Tailwind dashboard |
| `mcp-server/` | MCP server so Claude / Claude Code can run validations |
| `docs/` | PRD, architecture, data-source policy, design system, screen specs, roadmap |
| `.claude/` | Claude Code skills and subagents for this repo |

## Quick start
Requirements: Python 3.11+, Node 20+, Docker (for Postgres + Redis).

```bash
cp .env.example .env
docker compose up -d

# backend
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# frontend (new terminal)
cd frontend && npm install && npm run dev     # http://localhost:3000

# MCP server (optional)
cd mcp-server && pip install -e ".[dev]" && pytest
```

## Working with Claude Code
Open the repo folder and run `claude`. It loads `CLAUDE.md`, the project skills (`/new-screen`, `/add-provider`, `/api-endpoint`, `/evidence-pipeline`, `/ship-check`, `/validate-idea`), three review subagents, and the `validme` MCP server from `.mcp.json`.

Good first prompt:
> Read docs/roadmap.md and implement the first unchecked Week 1 item. Follow CLAUDE.md, write tests, and tick the box when done.

## Principles
No fabricated evidence · every finding links to a source · honest coverage (failed sources are shown) · only data sources whose terms allow commercial use.

## License
TBD
