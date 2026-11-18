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
- Plan badge (plan + credits, links to billing). "Recommended next": rule-based actions from project state (finish a draft, review new Radar signals, test demand with a landing page, share a page under 30 views, test untested assumptions with a survey, watch competitors, refresh a report older than 60 days), each with its reason and link, at most two per project. "Recent activity": research runs, page changes, Radar signals and published Lab pages, newest first, icon + kind in words.
- Project cards open `/projects/[id]` (overview: status, description, latest score with confidence and recommendation, latest run's stages, project tools; tools not yet available are shown disabled with why).

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
1. **Overview:** score /100 + confidence + evidence count + competitors found; executive summary; key findings (each linked to evidence); recommended next step; **score history** (≥ 2 versions: line breaks at unscored versions, which sit in a separate band, never at 0; plus a version table).
2. **Demand:** demand signals by category, problem frequency, evidence by source (stacked bar), buying-intent indicators, coverage & date range.
3. **Evidence:** = Evidence explorer scoped to project.
4. **Pain points:** clusters with distinct records, distinct authors (if legitimately available), severity, sample evidence, confidence, opportunity.
5. **Competitors:** **pricing compared** (verified plans only, cheapest plan only when billed the same way, read date + link), **features compared** (from their own pages, AI-extracted label, "not listed ≠ lacks it"), **gap candidates** (complaint/request themes not in any listed feature, cited, method shown); then the searchable table (positioning, pricing w/ verified/unavailable, identified gap) + detail drawer (website, audience, features, plans, strengths, complaints, sources).
6. **Market gaps / opportunity:** six dimensions with weight, score, evidence, explanation; **assumption tracker** (founder or AI-suggested; status untested/supported/contradicted is the founder's call; notes; link cited evidence via select + Link button; remove/dismiss with confirmation), risks, market size (with calculation or "unavailable"), missing info, "what would change the score".
7. **Audience:** segment cards (needs, evidence, motivations, accessibility).
8. **Distribution:** channel cards labelled *Researched* vs *Hypothesis*, with supporting evidence count; "Where to find your first 100 potential customers"; first-10 action plan.
9. **Economics:** unit-economics simulator on the founder's own numbers (saved per project, not per report). Example numbers are labelled and can't be saved until edited; inline validation; three scenarios; "your numbers, not market data".

## P1 — Compare ideas (`/projects/compare?ids=`)
2–4 researched ideas side by side from each latest report: score (with a low-confidence flag), confidence, recommendation, share of the model scored, each dimension, evidence/competitor counts, date. Sticky row labels on mobile; stale ids in the URL are dropped with a note.

## Public — Unit economics calculator (`/tools/unit-economics`)
Same simulator without saving; example numbers labelled; FAQ with FAQPage JSON-LD; registered in `seo.ts`.

## P0 — Evidence explorer (`/evidence`)
Search + filter chips (All, Pain points, Buying intent, Feature requests, platform, date). Evidence card: source title, provider badge, link ↗, published + retrieved dates, excerpt, category, relevance, verification state, related-duplicates count, Save button. Desktop table / mobile cards.

## P1 — Competitors, Audience & distribution, Billing & usage, Settings
## P1 — Competitor monitoring (`/projects/[id]/monitoring`, `/competitors`)
Watched pages: add a URL (name, weekly/daily by plan), watch competitors from the report (limited to free slots), each row with status in words, last/next check, cadence, Check now (result announced), Pause/Resume, Remove (confirm says it deletes recorded changes). "N of M pages watched"; at the limit the form is disabled with a billing link. Change timeline: filters (page, significance) with a no-match state, cards with the factual summary, a labelled AI summary, price chips (now shown / no longer shown), expandable text blocks exactly as read, link to the page (safeHref). `/competitors`: the same cards across projects. Header bell: unread count, keyboard-reachable items, mark all read.
Possible new competitors (`#candidates`, shown only when there are some): name, domain, found date, link to the launch post, Watch (disabled at the plan limit) / Dismiss, with a note that a match isn't proof of competition.

## P1 — Opportunity Radar (`/projects/[id]/radar`)
Breadcrumb, intro ("a reason to look closer, not proof"), Check now (re-reads stored evidence; says it uses no credits). Filters: Open / Acted on / Dismissed and type (aria-pressed pills). Signal card: type badge, confidence badge with its reason in words, found date, title, "Based on" fact line, relevance/impact meters (rule-based), AI view (labelled, optional) with a suggested next step, evidence (expandable: excerpt, platform, date or "date not given", source link via safeHref, link to the explorer for the rest), change or launch-post links; Mark as acted on, Dismiss, useful / not useful. New signals on screen are marked seen (they keep their New mark for the visit and still go into that week's digest). `?signal=` focuses and scrolls to one card once. Meters say they're rule-based (or fixed by kind for monitoring signals); the confidence reason shows the stored counts. Empty state explains what feeds the Radar. Below: Score over time (report points vs weekly re-checks; unscored on a separate line). Linked from the report header and the monitoring page.

## P1 — Where to find your customers (`/projects/[id]/customers`)
Breadcrumb, intro (every figure says where it came from and when; nothing contacts anyone), "Look up YouTube and search demand" (disabled, with the reason as its description, when the idea isn't researched or nothing is connected; full width on phones) with a hint (YouTube at most every 6 hours, keyword allowance, no credits); per-source result status. Sections: channels from the report (ChannelCard, researched vs hypothesis); YouTube channels (credit "Data from YouTube" + YouTube Terms link; subscribers or "Hidden by the channel", videos, latest matching video with date, "found by N of your searches — our search result, not a YouTube figure", read date and deletion date; no combined score); search demand table (keyword, monthly searches, CPC, ad competition, difficulty, 12-month sparkline with a text equivalent, read date, "over 30 days old"; "Unavailable" for missing figures; not-connected state); first-10 experiments with cited threads. Keyword allowance used → warning with a link to plans, and only YouTube is looked up. Linked from the report's "Project tools" row and the distribution tab; the sidebar's "Audience & distribution" lists researched ideas and links here.

## P1 — Validation Lab (`/projects/[id]/lab`, `/projects/[id]/lab/[pageId]`)
List: pages with status (Draft / Live / Unpublished), sign-up count, edited date, open-live-page and Edit; "New test page" (starts from the idea's name with a hero and a waitlist; plan cap → message + plans link); empty state. Editor (two columns on desktop): Page panel (title, web address prefixed with the pages origin, availability check on blur, locked while live; retention select with explanation); Blocks panel (AI suggestion button → labelled panel "edit before publishing", use or dismiss; each block a card with move up/down/remove (44px) and its fields with character counts and a link warning; add-block select); sticky action bar (Save / Publish or Save and publish / Unpublish / open live page / Delete page with confirm; every publish problem listed). Right: preview (same consent and pricing note as the live page), Results (views, sign-ups, conversion or "No views yet", with an explanation of what views mean and that small numbers prove little), Waitlist (emails, joined and deletion dates, delete one, delete all with confirm, Export CSV, a reminder of what people agreed to).
Public page (server-rendered on the pages origin, no JavaScript): blocks in order, honest pricing note, waitlist form (email, invisible honeypot, consent checkbox with fixed text and privacy link, button), thank-you and error messages after the redirect, footer with the test-page notice and privacy / delete / report links; light and dark via prefers-color-scheme; 44px targets.

## P1 — Validation Lab 2: surveys and price tests (Week 14)
**Lab list** adds: a "Surveys" section (title, status Draft / Live / Closed / Unpublished, answer count, edited date, open-live-survey, Edit; "New survey" with plan cap → message + plans link; empty state) and, when respondents had data deleted, a notice ("A respondent asked us to delete their data from <page/survey>; delete it from any CSV you downloaded too", Mark as read).
**Survey editor** (`/projects/[id]/lab/surveys/[surveyId]`, two columns on desktop): Survey panel (title, intro, web address on the pages origin with availability check, retention select, "Ask for an optional email" switch, locked once there are answers); Questions panel (AI "Suggest questions from my assumptions" → labelled panel listing each question with the assumption it tests, use or dismiss; each question a card: type select, question, optional help, options (2–8) for choice questions, end labels for the 1–5 scale, Required checkbox, "Tests assumption" select; move/remove 44px; add-question select). Once a survey has answers, ids/types/options/order are locked with a note (wording can still be fixed). Sticky bar: Save / Publish / Close (keeps the address, stops answers) / Unpublish / open live survey / Delete with confirm; every problem listed. Right: preview (inert form + the exact consent text as saved), Results (answers, views, response rate or "—", the server's sample-size message with icon + text, per question: horizontal bars with count and share, scale distribution and median, typed answers counted only; "answers come from the people you reached"), Answers (each response with its answers and optional email, delete one / delete all with confirm, Export CSV, reminder of what people agreed to).
**Page editor** adds: price-test variants inside the pricing block (Variant A = the block's prices; "Test another price" adds B and C as copies; remove variant), a preview note that each visitor sees one variant, and in Results a price-test table (variant, prices, views, chose a price, signed up, with rates or "—"), comparisons in words ("not enough views yet to tell them apart" / "no clear difference" / "B is clearly higher among the people you reached") with an icon, and the sample-size message.
**Public survey** (`/s/{slug}`, no JavaScript): title, intro, one fieldset per question (radios, checkboxes, 1–5 radios with end labels, textarea), required marks in text, optional email, honeypot, consent with fixed text and privacy link; on a mistake the form returns with answers kept and the problem announced (role=alert, aria-invalid); thank-you and closed states. **Public price test:** one variant per visitor, a "Choose <plan>" button per price, then "You chose X. It isn't available yet and nothing is charged. Join the waitlist…".
**Data request** (`/data-request` on the pages origin, linked from every footer): email + copy/delete; always the same "if we hold anything, we've emailed a link" answer; the emailed link shows a confirm button, then the copy (table per item) or "Deleted N items".

## P1 — Close the loop (Week 15)
**Lab page** adds, under the notices, a **Predicted vs actual** panel: a table (Demand, Willingness to pay) × (Research predicted: score/100 + confidence, "Not scored" or "No report yet" · Your experiment: score/100 with "N sign-ups from M views (rate, at least lower bound)", "too few to count yet", or "No result yet"), the rules note and report date; then **Your assumptions**: each tested one with its status, who set it ("set by you" / "from your survey") and the survey verdict (icon + text + each question's counts); a count of untested ones with how to test them; an empty state linking to the report's Market gaps tab.
**Survey editor:** a question linked to an assumption shows "Which answers support the assumption?" (checkboxes per option) or "Supports the assumption at N or higher" (scale), with the rule explained and, once answered, a note that a rule set now is marked as chosen after seeing results; text questions say they aren't judged automatically.
**Assumption tracker:** the survey verdict under each tested assumption; "The status follows your survey until you set one yourself", or "You set this yourself…" with a **Use the survey result** button when they differ.
**Report → Opportunity dimensions:** "Includes your experiment (strongest evidence)" chip when a Lab result counted.
**Settings → API keys:** on create, "What this key may do" checkboxes (four read/run defaults on; write scopes marked "changes data", off) and the list of things never possible with a key; each key shows its scopes as chips and a Permissions button to edit them; the MCP tools list includes the new tools.

## P1 — Plan & credits (`/billing`)
Balance + current plan; Plans: monthly/yearly toggle (aria-pressed), Free / Founder / Pro cards with the provider's price label (catalog price until payments are live), "Current plan" badge, Choose → hosted checkout, or "Switch in billing portal" when subscribed; subscription line (renews / cancelled until / payment failed) with Manage subscription → customer portal; "Opens at launch" while closed. Credit packs below, then usage history. Return from checkout polls for ~30 s.

## P1 — Settings (`/settings`)
Email (`#email`): weekly-digest switch (role=switch), the address it goes to, a bounced warning. Then API keys + MCP setup.
`/unsubscribed` (noindex): confirmation or invalid-link message, link to email settings.

## P2 — Team workspaces
