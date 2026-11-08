# Roadmap (one developer, ~6 weeks + 2-week beta)

Tick boxes as you go — Claude Code reads this file to know what's next.

## Week 0 — Setup ✅
- [x] Repo, CLAUDE.md, skills, agents, MCP config
- [x] Docs: PRD, architecture, data sources, design system, screens
- [x] Backend skeleton with models + provider interface + tests
- [x] Frontend shell (sidebar layout, tokens, dashboard placeholder)
- [x] MCP server with mock mode

## Week 1 — Foundation
- [x] `npx shadcn@latest init` in frontend/ and add base components (button, card, tabs, input, textarea, badge, sheet, skeleton)
- [x] docker compose up: Postgres + Redis (healthchecks); Django settings from env — *verify `migrate` on Postgres once Docker runs locally*
- [x] Auth: email + Google (django-allauth headless), session + CSRF via Next proxy, API keys for MCP — *Google needs real OAuth creds to test*
- [x] Projects CRUD API + permissions (owner-only) + tests
- [x] Frontend: auth pages, app shell responsive (mobile bar / tablet rail / desktop sidebar), dashboard wired to API, wizard step 1 saves a draft
- Milestone: user signs up and creates a draft project ✅ (verified in browser on SQLite)

## Week 2 — Idea analysis & providers
- [ ] Dashboard: plan badge, recent activity, recommended next actions, stages covered on project cards; project detail route (cards link to it)
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
