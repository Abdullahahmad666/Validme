# Roadmap (one developer: v1 Weeks 0–6, v2 Weeks 7–15)

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
- [x] Audience segments, channel recommendations (researched vs hypothesis), first-10 plan
- [x] Report history, Markdown/PDF export (PDF via the browser's print → Save as PDF)
- [x] MCP server against live API; install instructions in Settings and `mcp-server/README.md` (a public install page waits for a published package)

## Week 6 — Billing, hardening, deploy
- [x] Credits, packs, server-side limits, payment provider (merchant of record: Lemon Squeezy; packs + prices configured there), free-plan evidence preview, partial refunds
- [x] Error handling, job recovery, security review, analytics (first-party)
- [ ] Deploy (Vercel + Render or Railway)

## Marketing site
- [x] Landing page (hero with animated preview, sources, problem, how it works, features, evidence-first, TAM/SAM/SOM, use cases, pricing, FAQ, final CTA)
- [x] Pricing, sample report, about, contact, glossary, privacy/terms/cookies (drafts), coming-soon blog/guides/feedback
- [x] SEO: metadata, OG image, sitemap, robots, JSON-LD; analytics abstraction (no vendor)
- [ ] Product walkthrough video/animation for the demo slot (`DEMO_VIDEO` in `frontend/src/content/marketing.ts`)
- [ ] Final plan prices + allowances; decide subscriptions vs credit packs (PRD §9 favours packs)
- [ ] Real support inbox (`NEXT_PUBLIC_CONTACT_EMAIL`), social links (`SOCIAL_LINKS`), legal review of policies
- [ ] Analytics vendor via `registerAnalyticsHandler`; server-side `first_research_started`, `first_report_completed`, `subscription_started`

## v2: continuous intelligence (plan in `docs/strategy-v2.md`)
Every week ends with a **gate day**: security-reviewer, research-quality/ui reviewer, performance (query counts, p95, LLM cost per unit), exposure check, tests + build, docs. Nothing is pushed before the gate passes.

### Week 7 — Decision workspace (quick wins)
- [ ] D1 Pricing & feature gap matrix (`/reports/{id}/competitive-matrix`, Competitors tab v2)
- [ ] D2 Assumption tracker (separate from evidence; status + linked evidence)
- [ ] D3 Score history chart + compare 2–4 ideas
- [ ] D4 Unit economics simulator (deterministic, founder inputs) + public `/tools/unit-economics`
- [ ] D5 Gate

### Week 8 — Monitoring engine (needs deploy: worker + beat + Redis)
- [ ] D1 `monitoring` app: Watch, Observation, indexes
- [ ] D2 Scheduler: beat + skip_locked claims + per-domain politeness lock
- [ ] D3 Conditional GET, robots, SSRF re-check, normalize, hash, retention
- [ ] D4 Deterministic diffs (verified pricing, sections) → Change
- [ ] D5 Gate (SSRF focus; 1k-watch load test)

### Week 9 — Change intelligence & alerts
- [ ] D1 LLM summary on diffs only (labelled) + significance rules
- [ ] D2 Watch management UI
- [ ] D3 Competitor change timeline UI
- [ ] D4 In-app notifications + entitlements v1 (watch quota, cadence)
- [ ] D5 Gate

### Week 10 — Weekly digest, new competitors, subscriptions
- [ ] D1 Email provider + digest builder (every item linked to evidence)
- [ ] D2 Preferences, signed unsubscribe, idempotent sends, bounces
- [ ] D3 New-competitor detection (saved queries; user confirms)
- [ ] D4 Lemon Squeezy subscriptions → entitlements
- [ ] D5 Gate (billing focus)

### Week 11 — Opportunity Radar
- [ ] D1 Signal model + generators (complaint themes, competitor changes, own discussion trends, new competitors)
- [ ] D2 Deterministic relevance/impact/confidence; AI rationale labelled
- [ ] D3 Radar UI (evidence, source, date, action; dismiss/acted)
- [ ] D4 Revalidation + score snapshots; Radar in digest
- [ ] D5 Gate (research-quality focus)

### Week 12 — Distribution data v2
- [ ] D1 YouTube Data API provider (size / relevance / activity separate; 30-day expiry)
- [ ] D2 Licensed keyword demand provider (cached, cost-capped)
- [ ] D3 GitHub issues provider
- [ ] D4 "Where to find your customers" UI v2
- [ ] D5 Gate

### Week 13 — Validation Lab 1: landing page + waitlist
- [ ] D1 Separate origin, structured-block pages, publish rules
- [ ] D2 Block editor UI
- [ ] D3 Waitlist form (honeypot, rate limits, consent, encrypted emails, retention)
- [ ] D4 First-party page analytics
- [ ] D5 Gate (XSS, abuse, PII, origin isolation)

### Week 14 — Validation Lab 2: surveys + price tests
- [ ] D1 Survey builder + public survey page
- [ ] D2 Pricing smoke test (variants, honest "not available yet")
- [ ] D3 Results dashboard with sample-size warnings
- [ ] D4 Export, deletion, respondent data requests
- [ ] D5 Gate

### Week 15 — Close the loop
- [ ] D1 Experiment results as tier-1 evidence in scoring
- [ ] D2 Predicted vs actual panel
- [ ] D3 Assumptions auto-marked supported/contradicted (founder can override)
- [ ] D4 MCP tools for watches, Radar, Lab (scoped keys)
- [ ] D5 Gate + full regression/performance pass

### Later (Phase D, on demand)
- [ ] Agency workspaces · licensed Reddit/G2/Crunchbase/Similarweb (business decisions) · evidence-first GTM generator if asked

## Weeks 7–8 — Private beta
- [ ] 20-idea quality test set reviewed by a human
- [ ] 10–20 founders; survey "hours saved" + "would pay for another report"
