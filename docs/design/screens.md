# Screen specifications

Priority: **P0** = initial build, **P1** = MVP completion, **P2** = post-launch.

## P0 — Marketing site (`/`, route group `(marketing)`)
Public, fully static (prerendered). Copy and sample data live in `frontend/src/content/marketing.ts`; components in `frontend/src/components/marketing/`.
- **Home sections, in order:** Hero (animated product preview) · Research sources (Supported / Limited / Not included) · Problem · How it works (sticky visual on lg+) · Product walkthrough slot (`DEMO_VIDEO` in content; placeholder until a video exists) · 4 feature rows · Evidence vs generic AI · TAM/SAM/SOM · Use cases · Pricing · FAQ · Final CTA.
- **Other pages:** `/pricing`, `/sample-report` (illustrative, labelled), `/about`, `/contact`, `/glossary`, `/privacy`, `/terms`, `/cookies` (legal pages are drafts), `/blog`, `/guides`, `/feedback` (coming soon, noindex).
- **CTAs:** "Validate my idea" / "Get started" → `/signup`; "Log in" → `/login`; "Explore a sample report" → `/sample-report`.
- **Honesty rules:** every mock is labelled "Sample data"; only name sources we search or are rolling out (per `docs/data-sources.md`). Platforms we don't search (Reddit, X, Instagram, TikTok, review sites) are never named on public pages, not even as "not included"; a Vitest guard enforces this. No prices until set (Pro/Advanced show "Price TBA").
- **Auth pages (`/login`, `/signup`, `/verify-email`):** header (logo, site nav, back to home, login/signup switch) + compact footer; two columns on lg+ (form left, animated sample research preview right), form + trust strip below lg.
- **Motion:** CSS only. Entrance (`vm-in`) for the hero, scroll-driven reveals (`vm-reveal`) under `@supports (animation-timeline: view())`, all inside `prefers-reduced-motion: no-preference`; content is visible without JS or animation support.
- **SEO:** `pageMetadata()` in `src/lib/seo.ts` (canonical, OG image, large card), `sitemap.ts`, `robots.ts`, `opengraph-image.tsx`, JSON-LD (Organization, SoftwareApplication, FAQPage, DefinedTermSet), no ratings or prices in structured data.
- **Analytics:** `track()` in `src/lib/analytics.ts`; no vendor wired yet.

## P0 — Dashboard home (`/dashboard`)
Answers: how many ideas researched, what's in progress, what looks promising, what next.
- Greeting + plan badge; KPI row: Research projects · Reports generated · Evidence records · Active jobs.
- "Have a new idea?" inline textarea → `+ New research` (prefills wizard step 1).
- Recent projects (2-col cards): name, status pill, date, stages covered, score shown only on completed projects.
- Recent activity + recommended next actions (e.g. "Interview 5 owners from your report").
- Empty state: explain the 4-step flow with one CTA.

## P0 — New research wizard (`/research/new`)
Desktop: left stepper (~230px) · center form (~700px) · right AI help panel (~280px) · breadcrumbs + autosave status on top. Mobile: single column, compact step bar, sticky bottom actions.

**Step 1 — Describe your idea**
| Field | Type | Req | Validation |
|---|---|---|---|
| Project name | text | yes | 3–80 chars |
| Idea description | textarea | yes | 30–2,000 chars, live counter |
| Research objectives | multi-select chips | yes | ≥1 of: validate demand, pain points, competitors, market gaps, audiences, acquisition channels, pricing |
| Existing product URL | url | no | http/https |
| Additional context | textarea | no | ≤1,000 |
Action "Understand my idea" → editable interpretation (problem, solution, customers, category, assumptions). Never silently rewrite the original text.

**Step 2 — Define your market**
AI interpretation card (Edit) · Industry (AI suggested, editable) · Customer type B2B/B2C/B2B2C · Audience segments (chips, add/remove, ≥1) · Geography (multi, searchable) · Business stage (idea/MVP/launched/existing) · optional current alternatives, price hypothesis. Every AI field shows the `AI suggested` badge until confirmed/edited.

**Step 3 — Configure research**
- A. Source cards grouped (Web & search · Community · Competitor & review), each with what it contributes + state: Available / Limited / Requires connection / Unavailable. Selected ≠ available.
- B. Generated queries grouped by intent: Problem discovery · Buying intent · Competitor gaps · Customer acquisition. Add, edit, remove, disable, regenerate group, exclude terms, preview per-source adaptation.
- C. Competitors: automatic discovery and/or up to 10 URLs; choose what to analyze (features, pricing, audience, positioning, complaints, gaps).
- D. Depth: Quick (1×) · Standard (2×, recommended) · Deep (4×) — multipliers map to internal budgets; never claim "10,000 posts".

**Step 4 — Review & launch**
Summary of project, market, included/excluded sources, deliverables, depth, estimated credits, balance before/after, limitations note, required checkbox "I have reviewed the scope and usage". Submit with idempotency key; double-click must not double-charge. Success screen → "View research progress".

Autosave: debounce 800ms, save on step change, show Saving/Saved/Save failed, warn on leave, drafts never consume credits.

## P0 — Research progress (`/projects/[id]/progress`)
Stage list from backend (Idea analysis · Web research · Evidence analysis · Competitor analysis · Opportunity report) with Complete / Processing / Queued / Failed; coverage panel per source. User can leave; in-app notification on completion; failed providers named; partial report accessible; Retry for failed. No elapsed-time fake percentage.

## P0 — Opportunity report (`/projects/[id]/report`)
Header: breadcrumb, status, title, date, geography/industry/audience chips, Export · Share · More. Tabs keep header context; on mobile tabs become horizontal scroll.
1. **Overview:** score /100 + confidence + evidence count + competitors found; executive summary; key findings (each linked to evidence); recommended next step.
2. **Demand:** demand signals by category, problem frequency, evidence by source (stacked bar), buying-intent indicators, coverage & date range.
3. **Evidence:** = Evidence explorer scoped to project.
4. **Pain points:** clusters with distinct records, distinct authors (if legitimately available), severity, sample evidence, confidence, opportunity.
5. **Competitors:** searchable table (positioning, pricing w/ verified/unavailable, identified gap) + detail drawer (website, audience, features, plans, strengths, complaints, sources).
6. **Market gaps / opportunity:** six dimensions with weight, score, evidence, explanation; assumptions, risks, market size (with calculation or "unavailable"), missing info, "what would change the score".
7. **Audience:** segment cards (needs, evidence, motivations, accessibility).
8. **Distribution:** channel cards labelled *Researched* vs *Hypothesis*, with supporting evidence count; "Where to find your first 100 potential customers"; first-10 action plan.

## P0 — Evidence explorer (`/evidence`)
Search + filter chips (All, Pain points, Buying intent, Feature requests, platform, date). Evidence card: source title, provider badge, link ↗, published + retrieved dates, excerpt, category, relevance, verification state, related-duplicates count, Save button. Desktop table / mobile cards.

## P1 — Competitors, Audience & distribution, Billing & usage, Settings
## P2 — Idea comparison, Monitoring dashboard, Team workspaces
