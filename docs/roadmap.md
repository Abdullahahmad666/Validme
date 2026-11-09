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
- [x] `research/ai` LLM client with JSON-schema validation (Anthropic SDK, structured outputs, jsonschema check + one retry, refusal fallback, cost on the ledger)
- [x] Interpret idea + generate queries endpoints (versioned prompts; query CRUD; AI throttle) — *needs `ANTHROPIC_API_KEY` to run live*
- [x] Providers: Brave web search, HN Algolia, Stack Exchange, user URLs, competitor page fetcher (SSRF-safe, robots.txt) — *Exa not added; Brave needs `BRAVE_SEARCH_API_KEY`*
- [x] Celery job orchestration + JobStage tracking + 7-day search cache
- [x] Wizard steps 1–4 (RHF + Zod, 800ms autosave, idempotent launch) + research progress page
- Milestone: submit idea → real results stored ✅ (verified in browser: HN + Stack Exchange evidence stored, 1 credit charged once)
- [ ] Playwright test for the wizard flow (CLAUDE.md convention)
- [x] Verify migrations on local Postgres (all tests pass on Postgres 18)

## Week 3 — Evidence intelligence
- [x] Normalize, dedupe (URL + simhash), classify (7 categories), cluster — *classify/cluster need `ANTHROPIC_API_KEY`; without it evidence is stored unclassified and says so*
- [x] Evidence explorer UI (search, category/source/saved filters, themes, duplicates merged, save, CC BY-SA attribution)
- Milestone: traceable evidence ✅ (verified on Postgres with live Hacker News results)

## Week 4 — Competitors & opportunity
- [x] Competitor profiles + pricing extraction with dates
- [x] Scoring model + confidence + "what would change the score"
- [x] Report tabs: Overview, Demand, Pain points, Competitors, Market gaps

## Week 5 — Distribution & reports
- [ ] Audience segments, channel recommendations (researched vs hypothesis), first-10 plan
- [ ] Report history, Markdown/PDF export
- [ ] MCP server against live API; publish install instructions

## Week 6 — Billing, hardening, deploy
- [ ] Credits, packs, server-side limits, payment provider (merchant of record)
- [ ] Error handling, job recovery, security review, analytics
- [ ] Deploy (Vercel + Render or Railway)

## Marketing site
- [x] Landing page (hero with animated preview, sources, problem, how it works, features, evidence-first, TAM/SAM/SOM, use cases, pricing, FAQ, final CTA)
- [x] Pricing, sample report, about, contact, glossary, privacy/terms/cookies (drafts), coming-soon blog/guides/feedback
- [x] SEO: metadata, OG image, sitemap, robots, JSON-LD; analytics abstraction (no vendor)
- [ ] Product walkthrough video/animation for the demo slot (`DEMO_VIDEO` in `frontend/src/content/marketing.ts`)
- [ ] Final plan prices + allowances; decide subscriptions vs credit packs (PRD §9 favours packs)
- [ ] Real support inbox (`NEXT_PUBLIC_CONTACT_EMAIL`), social links (`SOCIAL_LINKS`), legal review of policies
- [ ] Analytics vendor via `registerAnalyticsHandler`; server-side `first_research_started`, `first_report_completed`, `subscription_started`

## Weeks 7–8 — Private beta
- [ ] 20-idea quality test set reviewed by a human
- [ ] 10–20 founders; survey "hours saved" + "would pay for another report"
