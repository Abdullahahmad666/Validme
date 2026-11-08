# Roadmap (one developer, ~6 weeks + 2-week beta)

Tick boxes as you go — Claude Code reads this file to know what's next.

## Week 0 — Setup ✅
- [x] Repo, CLAUDE.md, skills, agents, MCP config
- [x] Docs: PRD, architecture, data sources, design system, screens
- [x] Backend skeleton with models + provider interface + tests
- [x] Frontend shell (sidebar layout, tokens, dashboard placeholder)
- [x] MCP server with mock mode

## Week 1 — Foundation
- [ ] `npx shadcn@latest init` in frontend/ and add base components (button, card, tabs, input, textarea, badge, sheet, skeleton)
- [ ] docker compose up: Postgres + Redis; Django settings from env
- [ ] Auth: email + Google (django-allauth), JWT/session for frontend, API keys for MCP
- [ ] Projects CRUD API + permissions (owner-only) + tests
- [ ] Frontend: auth pages, app shell responsive, dashboard wired to API
- Milestone: user signs up and creates a draft project

## Week 2 — Idea analysis & providers
- [ ] `research/ai` LLM client with JSON-schema validation
- [ ] Interpret idea + generate queries endpoints
- [ ] Providers: Brave/Exa web search, HN Algolia, Stack Exchange, user URLs, competitor page fetcher
- [ ] Celery job orchestration + JobStage tracking + search cache
- [ ] Wizard steps 1–4 (RHF + Zod, autosave)
- Milestone: submit idea → real results stored

## Week 3 — Evidence intelligence
- [ ] Normalize, dedupe (URL + simhash), classify (7 categories), cluster
- [ ] Evidence explorer UI
- Milestone: traceable evidence

## Week 4 — Competitors & opportunity
- [ ] Competitor profiles + pricing extraction with dates
- [ ] Scoring model + confidence + "what would change the score"
- [ ] Report tabs: Overview, Demand, Pain points, Competitors, Market gaps

## Week 5 — Distribution & reports
- [ ] Audience segments, channel recommendations (researched vs hypothesis), first-10 plan
- [ ] Report history, Markdown/PDF export
- [ ] MCP server against live API; publish install instructions

## Week 6 — Billing, hardening, deploy
- [ ] Credits, packs, server-side limits, payment provider (merchant of record)
- [ ] Error handling, job recovery, security review, analytics
- [ ] Deploy (Vercel + Render or Railway)

## Weeks 7–8 — Private beta
- [ ] 20-idea quality test set reviewed by a human
- [ ] 10–20 founders; survey "hours saved" + "would pay for another report"
