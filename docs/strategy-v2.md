# ValidMe v2: what to build so people pay (Nov 2026)

Input: the "How to turn an AI idea validator into a SaaS people actually pay for" review (17 pages), checked against what ValidMe already ships (Weeks 0–6) and against our own rules (CLAUDE.md, `docs/data-sources.md`).

## 1. The core test: what can't a chat model do?

ChatGPT, Claude and Gemini can already write a one-shot report: SWOT, TAM guesses, a GTM plan, unit-economics maths, interview questions. Anything that is **one prompt → one answer** is a commodity, so we can't charge for it.

A general chat model can't, by itself:

| Moat | Why a chat model can't | ValidMe asset |
|---|---|---|
| **Time** | It doesn't watch a market for weeks or remember last week's price. | Scheduled monitoring, dated snapshots, diffs, score history |
| **Provenance** | It can't show a dated, stored, re-checkable source for every number. | `Evidence` rows, `SourceSnapshot`, verbatim-verified prices |
| **Real-world signal** | It can't collect the founder's own waitlist sign-ups or survey answers. | Validation Lab results, used as the strongest evidence |
| **Workspace and memory** | It doesn't track assumptions, experiments and decisions across ideas. | Portfolio, assumptions, report versions, alerts |

**Decision:** the paid product is **continuous, evidence-backed intelligence about one idea or market**, not the report. The report becomes onboarding: the first thing a user sees, and the reason to start a watchlist.

## 2. Every module in the review, classified

Legend:
- **Built %**: how much exists today.
- **GPT?**: can a chat model replicate it?
- **Size**: S ≈ 1–2 days, M ≈ 1 week, L ≈ 2+ weeks.

| # | Module | Built % | GPT? | Size | Data risk / cost | Decision |
|---|---|---|---|---|---|---|
| 7 | Pricing & feature gap analyzer | ~80% (verified plans, features, complaints, gaps) | Partly (not dated, verified prices) | **S** | None (our own data) | **Quick win, Week 7** |
| 10 | Idea portfolio & revalidation | ~70% (projects, report versions, re-run) | No (memory over time) | **S** | None | **Quick win, Week 7**: comparison, score history, assumption tracker |
| 9 | Unit economics simulator | 0% | **Yes** (it's arithmetic) | **S** | None | **Build as a free hook** (no AI, founder inputs): Week 7. Not a paid reason. |
| 5-score | Real validation score v2 | ~70% (deterministic, confidence, coverage = `scored_weight`) | No | **S–M** | None | Add evidence tiers + score history (Weeks 7 and 11) |
| 3 | Customer pain intelligence | ~75% (HN, Stack Exchange, web, user links, themes) | No (sourced) | S per source | Reddit/G2 **blocked** unless licensed | Add GitHub issues (allowed); others are business decisions |
| 2 | Distribution intelligence | ~40% (Researched vs Hypothesis channels, first-10 plan) | Partly (generic advice) | **M** | YouTube API (free quota, ToS), keyword data (paid per request); LinkedIn/X/TikTok/Reddit **blocked** | Week 12: YouTube + keyword demand, with size / relevance / activity kept separate |
| 1 | Competitor monitoring | ~25% (SSRF-safe fetcher, snapshots, price verification) | **No (needs time)** | **L** | Low: our own fetching; funding data is paid | **Core of Phase B (Weeks 8–9)** |
| 4 | Weekly market newsletter | 0% | No (needs monitoring) | **S** after #1 | Email provider | Week 10, built on monitoring events |
| 11 | Opportunity Radar | 0% | No | **M** after #1 + #3 | LLM cost (only on new signals) | Week 11, the strongest differentiator |
| 6 | Market trend radar | 0% | Partly | **M** | Google Trends has no official API: licensed keyword/trends data or our own time series only | Our own discussion-volume trends in Week 11; search trends in Week 12 |
| 8 | Real-world Validation Lab | 0% | **No (real customers)** | **L** | User-generated public pages + respondents' personal data = heavy security | Phase C (Weeks 13–15); makes the score *real* |
| 5 | GTM strategy generator | ~30% (evidence-linked first-10 plan) | **Yes** | M | — | **Don't build standalone.** Fold the evidence-linked parts into Distribution. |
| — | Agency workspaces | 0% | No | **L** (tenancy migration) | — | Phase D; prepare the query helper now |

### Answer to "which modules are easy?"
Easy, low complexity and mostly built on existing data:
- Pricing & feature gap matrix (#7).
- Portfolio compare, score history and the assumption tracker (#10).
- Unit economics simulator (#9).
- Score v2 evidence tiers.
- Interview-question helper (part of #8).
- The newsletter (#4), once monitoring exists.

**But easy isn't what people pay for.** The simulator and the interview-question helper are things a chat model already does. Build them as cheap hooks: free tools, SEO and activation.

What people pay for:
- **Monitoring + newsletter + Opportunity Radar (#1, #4, #11):** the recurring value.
- **Validation Lab (#8):** real evidence.
- **Distribution with real platform data (#2).**

These take more effort, so the plan below does the quick wins first (one week, no new infrastructure), then puts most of the time into the moat.

## 3. Where the review conflicts with our rules (and the decision)

| Review suggests | Our rule | Decision |
|---|---|---|
| Reddit, LinkedIn, X, TikTok, Instagram data | Rule 3: never scrape them; `data-sources.md` marks them blocked or licence-only | **Not in this plan.** Reddit only through a signed commercial licence or a licensed provider (a business and cost decision for you); the others stay out. |
| G2 / Capterra reviews | Licence-only | Only through an authorized data provider. Until then, use user-pasted review links and competitors' own pages. |
| Similarweb traffic, Crunchbase funding | Paid enterprise APIs | Phase D, and only when revenue justifies it. Funding news comes from web search and RSS meanwhile (dated, linked). |
| "Illustrative" scores and audience sizes | Rule 1: no fabricated numbers | Kept: every metric has a source, observation date and confidence. Community size, relevance and activity are separate, and a community's member count is never presented as the number of potential customers. |
| Automated outreach / partnerships | Rule 8: no automated outreach | The Validation Lab is **inbound only**: people sign up on the founder's page. We never message anyone. |

## 4. Architecture decisions (ADRs)

**ADR-1: The product unit becomes a watchlist per idea.** A completed report proposes watches (its competitors, queries and keywords). The user confirms them, and from then on the project is "monitored". The dashboard leads with "what changed" rather than "make a report".

**ADR-2: A new `monitoring` app, diff first and LLM last.**

Models:

| Model | Fields |
|---|---|
| `Watch` | project, kind (`competitor_page` / `search_query` / `keyword` / `repo_issues`), target, cadence, `next_run_at` (indexed), etag/last-modified, last hash, active |
| `Observation` | watch, fetched_at, status, content hash, normalized text (bounded), HTTP metadata |
| `Change` | watch, before/after observation, kind (pricing / features / copy / new_result), deterministic diff, AI summary (labelled, optional), significance |
| `Signal` | the Radar card: project, type (opportunity / risk / trend), title, rationale (AI, labelled), evidence M2M, discovered_at, relevance, impact, confidence, status (new / seen / dismissed / acted) |
| `Digest` | user, period, content snapshot, sent_at, idempotency key |

How a check runs:
1. **Scheduler:** Celery beat every 5 minutes claims due watches with `select_for_update(skip_locked=True)` in batches, then fans out tasks.
2. **Politeness:** a per-domain Redis lock (one request per domain every N seconds), robots.txt respected, conditional GET (ETag / If-Modified-Since), the existing SSRF-safe fetcher re-checked for each request.
3. **Cost and performance rule:** no change in hash → stop (no AI, no write beyond `last_checked`).
   - On change, prices are re-verified verbatim (`verified_plans`) and a deterministic section diff is computed.
   - Only then does the LLM summarise the **diff** (small input), and its output is labelled AI.
   - We track cost per watch.
4. **Retention:** keep the observations that changed plus the last N unchanged ones, with `Observation.text` capped at 20k characters; prune them in the beat job.

**ADR-3: Data-source policy stays strict.**

New allowed providers:
- **GitHub issues:** public API, attribution kept.
- **YouTube Data API:** quota-based. Its terms require cached stats to be refreshed or deleted within 30 days, so we store them with expiry.
- **Keyword volume and trends:** a licensed provider such as DataForSEO, paid per request, cached for 30 days and capped per plan.
- **RSS / changelog feeds** of competitors.

Each provider registers a terms note and an availability state, as today.

**ADR-4: Hybrid billing.**
- **Credits stay** for one-off research runs, because those costs vary.
- **Subscriptions** (Lemon Squeezy, same merchant of record) unlock **monitoring capacity**: number of watches, cadence, digest, Radar and the Lab. Those are the recurring-cost features.
- One entitlements table/config replaces the current free/paid `PLAN_LIMITS` and is enforced server-side.
- Prices stay in config and the provider (no invented prices). The review's tiers ($9 / $19 / $39 / $99) are a hypothesis to test in the beta, not copy.

**ADR-5: Notifications.**
- An in-app inbox, plus email through a transactional provider (Postmark or Resend: your pick).
- Unsubscribe uses signed one-click tokens, with per-user frequency settings.
- No tracking pixels or link redirects, consistent with first-party analytics.
- An email only ever contains the recipient's own data.

**ADR-6: Validation Lab isolation.**
- Founder pages are served from a **separate origin** (e.g. `pages.<domain>`), so they can never read app cookies.
- Pages are built from **structured blocks only**: no raw HTML or JavaScript from users, so stored XSS isn't possible.
- Sign-up forms are protected by a honeypot, per-IP and per-page rate limits, and optionally Cloudflare Turnstile.
- Respondents' emails are encrypted at the field level and kept only for a set retention period, with export and delete.
- Consent text is shown on every form.
- Results flow into scoring as the **highest-tier evidence**.

**ADR-7: Score v2.** Evidence tiers, strongest first:
1. Founder experiments (sign-ups, survey answers, price clicks).
2. Verified prices and buying intent.
3. Public discussion.
4. AI interpretation (never scored on its own).

Every report and every Radar recalculation stores a score snapshot, so we can draw history. A dimension with no data stays "not scored", and having **no competitors is never a penalty**: it remains "not scored" rather than counting as an opportunity or a risk.

**ADR-8: Tenancy readiness.** Before Agency, route every owner filter through one helper (`owned(request, qs)`), so moving to a `Workspace` later is a mechanical change. No workspace model until a paying agency asks.

**ADR-9: Infrastructure prerequisite.** Monitoring needs an always-on worker, Celery beat and Redis. **Deployment (deferred from Week 6) must land before the Phase B beta.** Until then, everything runs locally with eager Celery for development only.

## 5. Plan, week by week and day by day

One developer, matching the existing pace. **Every week ends with a gate day.** Nothing is pushed until the gate passes:

1. `security-reviewer` agent on the week's diff, with every finding fixed or written down as accepted.
2. `research-quality-reviewer` (data/AI weeks) and `ui-reviewer` (screen weeks).
3. Performance: query counts for new endpoints (no N+1 queries), p95 under load for hot paths, LLM cost per unit (per watch, per digest, per signal) logged and under budget.
4. The exposure check (memory rule): no keys, env, costs or internal ids in responses, logs or the bundle.
5. Tests (pytest + Vitest; Playwright for the main new flows), lint, typecheck and build; a browser check at 375 / 768 / 1280 px.
6. Docs: `roadmap.md` ticked, `architecture.md` API table updated, `.env.example` updated.

### Phase A: quick wins on data we already have

**Week 7: Decision workspace**
- **D1 Pricing & feature gap matrix.**
  - **Endpoint:** `GET /reports/{id}/competitive-matrix` shows normalized plan tiers (verified only), a feature × competitor grid built from extracted features, complaint counts per competitor, and "missing everywhere" candidates (each must cite complaints).
  - **UI:** an upgraded Competitors tab.
- **D2 Assumption tracker.** An `Assumption` model (founder or AI, status untested / supported / contradicted, linked evidence) kept separate from `Evidence` (rule 2). UI on the report and the project.
- **D3 Score history and idea comparison.** `GET /projects/compare?ids=` (2–4 of your own projects; owner-checked) and a history chart from report versions.
- **D4 Unit economics simulator.** Deterministic and client-side: founder inputs, three scenarios, break-even. Saved to the project as "your inputs", never as evidence. A public `/tools/unit-economics` page (SEO registry entry, JSON-LD) works as a free hook.
- **D5 Gate.**

### Phase B: continuous intelligence (the recurring revenue)

> Prerequisite: production deploy (worker + beat + Redis) before inviting beta users to Phase B.

**Week 8: Monitoring engine**
- **D1:** `monitoring` app: `Watch` and `Observation` models, migrations, indexes (`next_run_at`, `(watch, -fetched_at)`), admin.
- **D2:** Scheduler: beat claims due watches with `skip_locked`, plus the per-domain Redis politeness lock and jitter. Watches are created from a report's competitors (the user confirms).
- **D3:** Fetch path: conditional GET, robots.txt and the SSRF fetcher re-checked for each fetch, content normalization, hashing and retention pruning.
- **D4:** Deterministic diffs: pricing via `verified_plans` (added / removed / changed plan and price), section diffs for features and copy. Creates `Change` rows. No AI yet.
- **D5 Gate**, with an SSRF-focused review (recurring fetches of user-supplied URLs): redirects, DNS rebinding, ports, response-size limits. Load test: 1,000 watches per cycle.

**Week 9: Change intelligence and alerts**
- **D1:** LLM change summary on **diff input only** (new versioned prompt), labelled AI, plus deterministic significance rules (price change > cosmetic copy).
- **D2:** Watch management UI: add a competitor page or query, cadence, pause, delete, and the last check with its status.
- **D3:** Competitor timeline UI: changes over time, each linked to its two snapshots and dates.
- **D4:** In-app notifications (a bell and inbox) and **entitlements v1** (watch quota and cadence per plan, enforced at creation and in the scheduler).
- **D5 Gate.**

**Week 10: Weekly digest, new competitors and subscriptions**
- **D1:** Email provider integration and the digest builder. Deterministic sections: price changes, new competitors, new complaints, top signals. Every item links to its evidence.
- **D2:** Preferences (frequency, which projects), signed one-click unsubscribe, idempotent sends (`digest:<user>:<week>`), bounce handling.
- **D3:** New-competitor detection: saved queries re-run weekly (web search, HN, GitHub). A new domain or product not already known becomes a candidate, which the user confirms before it becomes a watch.
- **D4:** Lemon Squeezy **subscriptions**: created / updated / cancelled / expired webhooks → entitlements (same signed, idempotent pattern as packs). Billing page plan picker.
- **D5 Gate**, with a billing-heavy security review.

**Week 11: Opportunity Radar**
- **D1:** The `Signal` model and generators:
  - A new complaint theme crossing a threshold.
  - A competitor price or feature change that's significant.
  - Rising discussion volume, from **our own** stored evidence time series.
  - A new competitor confirmed.
- **D2:** Relevance, impact and confidence computed deterministically from evidence counts, diversity and recency. The AI writes only the rationale and the suggested action, both labelled.
- **D3:** Radar UI: cards with evidence, source, date, relevance, impact, confidence and action; dismiss, mark as acted, and feedback.
- **D4:** Revalidation: new evidence triggers a re-score and stores a score snapshot, so the history chart is live. Radar items go into the digest.
- **D5 Gate**, with a research-quality review focused on no fabricated signals.

### Phase C: real-world evidence and distribution data

**Week 12: Distribution data v2 ("Where to find your customers")**
- **D1:** YouTube Data API provider: relevant channels and videos, with size, relevance and activity as **separate** measures, and stored stats expiring within 30 days per its terms.
- **D2:** Keyword demand provider: search volume, CPC, difficulty and trend from a licensed source; cached 30 days; per-plan cost cap; "unavailable" when not connected.
- **D3:** GitHub issues provider (pain intelligence for developer tools).
- **D4:** Distribution UI v2: channels with real metrics, each showing source, observation date and confidence. Recommended experiments link to evidence.
- **D5 Gate.**

**Week 13: Validation Lab 1, landing page and waitlist**
- **D1:** The separate origin, page model (structured blocks), publish / unpublish and slug rules.
- **D2:** Block editor UI: hero, problem, benefits, price points, FAQ. Copy suggestions are AI-labelled and the founder edits them.
- **D3:** Waitlist form: honeypot, rate limits, optional Turnstile, consent, encrypted respondent emails, retention and delete.
- **D4:** First-party page analytics (views, sign-ups, conversion), with no third-party scripts on hosted pages.
- **D5 Gate**, the heaviest security review: XSS, CSRF on the public form, spam and abuse, personal data, origin isolation.

**Week 14: Validation Lab 2, surveys and price tests**
- **D1:** Survey builder: questions (suggested from the assumptions, labelled AI), answer types, a public survey page.
- **D2:** Pricing smoke test: two or three price variants on a page, measuring clicks and sign-ups per variant. Honest copy: "not available yet, join the waitlist".
- **D3:** Results dashboard: per experiment, with sample size and a confidence warning when the sample is small.
- **D4:** Export (CSV), founder-controlled deletion, and the respondent data-request flow.
- **D5 Gate.**

**Week 15: Close the loop**
- **D1:** Experiment results become **tier-1 evidence** in scoring (willingness to pay, demand).
- **D2:** A "Predicted vs actual" panel: the initial assumptions next to the experiment results.
- **D3:** Assumptions are marked supported or contradicted automatically, citing the experiment, and the founder can override.
- **D4:** MCP server tools for watches, Radar and the Lab (read-only plus confirm actions), with API-key scopes.
- **D5 Gate**, plus a full regression and performance pass.

### Phase D: later, only on evidence of demand
- **Agency workspaces:** a `Workspace` model, members and roles. A migration of owner→workspace through the ADR-8 helper.
- **Licensed sources** (business decisions with real costs): Reddit through a commercial agreement or licensed provider, G2/Capterra through an authorized provider, Crunchbase for funding, Similarweb for traffic.
- A GTM generator only if beta users ask for it, built evidence-first.

## 6. Pricing to test (hypothesis, config-only)

| Plan | What it includes | Billing |
|---|---|---|
| Free | 1 Quick report, evidence preview, simulator, comparison | — |
| Report credits | One-off Standard / Deep research runs | Packs (as today) |
| Founder | Up to N watches, weekly cadence, weekly digest, assumption tracker | Monthly subscription |
| Pro | More watches, daily cadence, Opportunity Radar, Validation Lab, MCP | Monthly subscription |
| Agency | Workspaces and clients | Later |

Prices are set in Lemon Squeezy and the entitlements config, and validated in the beta with the "would you pay" survey before launch.

## 7. Decisions you need to make (and my defaults)

| Decision | Needed by | Default if you don't decide |
|---|---|---|
| Deploy target (Vercel + Render or Railway) and timing | Before the Phase B beta | Deploy at the end of Week 7 |
| Email provider (Postmark or Resend) | Week 10 | Resend |
| Keyword data provider and monthly budget | Week 12 | DataForSEO, capped per plan |
| YouTube Data API project (free quota) | Week 12 | Create it in Week 12 |
| Reddit / G2 licensing | Phase D | **No**: stay compliant |
| Separate domain for Lab pages | Week 13 | `pages.<your domain>` |
| Subscription prices | Week 10 | Hypothesis tiers, tested in the beta |
