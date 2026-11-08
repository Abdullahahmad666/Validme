# ValidMe — project memory for Claude Code

ValidMe helps indie founders validate a startup idea with **source-linked evidence** and get a plan for their **first 10 customers**. It has a web app and an MCP server so founders can run it from Claude.

Read before starting any feature:
- `docs/PRD.md` — scope, evidence rules, scoring, pricing
- `docs/architecture.md` — apps, API, job states, provider interface
- `docs/design/design-system.md` + `docs/design/screens.md` — UI rules and per-screen specs
- `docs/data-sources.md` — which sources are allowed
- `docs/roadmap.md` — what's next; tick items when done

## Repo layout
```
backend/     Django 5 + DRF, Celery, PostgreSQL (SQLite allowed for tests)
frontend/    Next.js App Router + TypeScript + Tailwind + shadcn/ui
mcp-server/  Python MCP server (stdio) wrapping the REST API
docs/        product + design source of truth
.claude/     skills and subagents for this repo
```

## Commands
| Task | Command |
|---|---|
| Start DB + Redis | `docker compose up -d` |
| Backend setup | `cd backend && python -m venv .venv && .venv/Scripts/activate` (Windows) or `source .venv/bin/activate`, then `pip install -r requirements.txt` |
| Backend run | `cd backend && python manage.py migrate && python manage.py runserver` |
| Backend tests | `cd backend && pytest` |
| Worker | `cd backend && celery -A config worker -l info` |
| Frontend | `cd frontend && npm install && npm run dev` |
| Frontend checks | `cd frontend && npm run lint && npm run typecheck && npm test` |
| MCP server tests | `cd mcp-server && pip install -e . && pytest` |

## Non-negotiable rules
1. **No fabricated evidence or numbers.** Every finding must reference stored `Evidence` rows. Missing data → "unavailable".
2. Keep **evidence**, **AI conclusions**, and **user assumptions** in separate fields/models.
3. Only use data sources marked allowed in `docs/data-sources.md`. Never add a scraper for Reddit, G2, Capterra, Trustpilot, X, Instagram, TikTok.
4. One provider failing ⇒ `PARTIALLY_COMPLETED`, never silent skips. Coverage is always recorded.
5. Credits are deducted server-side, inside a transaction, with an idempotency key.
6. Users can only access their own projects — every queryset filters by `owner=request.user`. Write a test for it.
7. Never put secrets in code. Read from env; document new vars in `.env.example`.
8. No automated outreach features.

## Conventions
- Python: type hints, `ruff` formatting, services in `services.py`, Celery tasks in `tasks.py`, providers in `research/providers/`.
- API: DRF ViewSets, snake_case JSON, pagination on lists, errors `{ "error": { "code", "message" } }`.
- Frontend: server components for static report content, client components for filters/charts/tabs; data via typed services in `src/services/`; no research logic in components.
- Tests with every feature (pytest for backend, Vitest for frontend, Playwright for the wizard flow).
- Brand name lives only in `frontend/src/lib/brand.ts` and `backend/config/settings.py` (`VALIDME_BRAND`).
- **SEO / AEO / GEO for every public page (required, every time):**
  1. Add an entry to `frontend/src/content/seo.ts` (title ≤ 60 chars with suffix, description 70–160, answer-first; social headline ≤ 70; `index`/`sitemap`).
  2. In the page: `export const metadata = pageMetadata("<key>")` and render `<PageJsonLd page="<key>" />` (add `extra` entities such as `faqPageEntity(...)` when the page has Q&A, HowTo or terms).
  3. That automatically gives: canonical, robots, Open Graph image 1200×630 (`/og/<key>/og.png`) and X card 1200×600 (`/og/<key>/x.png`), sitemap entry, breadcrumbs and `llms.txt` listing.
  4. Facts only in copy and structured data: no ratings, reviews, invented prices or unsearched platforms.
  `npm test` (src/content/seo.test.ts) fails if a public page is missing from the registry.

## Workflow
Use the project skills in `.claude/skills/` (`/new-screen`, `/add-provider`, `/api-endpoint`, `/evidence-pipeline`, `/ship-check`, `/validate-idea`). After a feature, run the `research-quality-reviewer` or `ui-reviewer` subagent as relevant, then update `docs/roadmap.md`.
