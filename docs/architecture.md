# Architecture

Modular monolith. No microservices, no Kubernetes for the MVP.

```
frontend/   Next.js (App Router, TS, Tailwind, shadcn/ui)  ── calls ──┐
mcp-server/ Python MCP server (stdio) for Claude / Claude Code ──────┤
                                                                      ▼
backend/    Django + DRF  (auth, projects, credits, research API)
              │  enqueue
              ▼
            Celery workers (Redis broker)
              ├── research: providers fan-out → normalize → dedupe
              └── analysis: classify → cluster → competitors → score → distribution → report
              │
            PostgreSQL (all structured data)   S3-compatible storage (exports)
```

## Backend apps (`backend/`)
| App | Owns |
|---|---|
| `accounts` | User, API keys (for MCP), plan/credits balance |
| `projects` | Project, IdeaDefinition (original + AI interpretation), MarketProfile, ResearchConfig snapshot |
| `research` | ResearchJob, ResearchQuery, provider registry, `providers/*` adapters, Celery tasks |
| `evidence` | Evidence, EvidenceCluster, classification |
| `reports` | Competitor, Opportunity, DistributionStrategy, Report |
| `billing` | UsageTransaction (credits, cost in USD), plans |

## Provider interface
```python
class ResearchProvider(Protocol):
    key: str                       # "web_search", "hackernews", ...
    def availability(self) -> Availability   # AVAILABLE | LIMITED | REQUIRES_CONNECTION | UNAVAILABLE
    def search(self, query: ResearchQueryIn, budget: Budget) -> list[RawResult]
    def normalize(self, raw: RawResult) -> EvidenceIn
```
One provider failing marks the job `PARTIALLY_COMPLETED`, never `FAILED`, unless all fail.

## Research pipeline (Week 2)
- **Drafting (free, 0 credits):** `POST /projects/{id}/interpret` and `/keywords/generate` call `research/ai/client.py::complete_json` (Anthropic SDK, structured outputs, jsonschema-validated, one retry). Output is stored apart from the founder's input (`IdeaDefinition.ai_interpretation`, `ResearchQuery.ai_generated`); cost goes on `UsageTransaction` with 0 credits. Throttle scope `ai`.
- **Launch:** `POST /research/jobs` snapshots `ResearchConfig` (sources, depth, queries, exclude terms, evidence/competitor URLs) onto the job; credits are spent in the same transaction.
- **Run:** stages `idea_analysis → web_research → community_research → evidence_analysis → competitor_analysis → report`. Providers declare a `stage`; URL providers (`user_urls`, `competitor_pages`) read the snapshot's URL lists through `providers/fetch.py` (public IPs only, robots.txt, 2 MB, 10 s). Query providers go through a 7-day `SearchCache`. Coverage per provider: `COMPLETED | FAILED | UNAVAILABLE | SKIPPED` (SKIPPED = nothing to read, doesn't make a job partial).
- Dev without Redis: `CELERY_TASK_ALWAYS_EAGER=True` runs the job inline.

## Job states
`DRAFT → PENDING → RUNNING → COMPLETED | PARTIALLY_COMPLETED | FAILED | CANCELLED`
Each stage writes a `JobStage` row so the progress screen shows real status (no fake percentages).

## API (v1, all under `/api/`)
| Method | Path | Purpose |
|---|---|---|
| GET/PATCH | `/me` | profile + credit balance (credits read-only) |
| GET | `/dashboard/summary` | KPI counts (projects, reports, evidence, active jobs) — own data only |
| GET/POST | `/api-keys` | list / issue MCP API key (raw key returned once; only SHA-256 stored) |
| DELETE | `/api-keys/{id}` | revoke key |
| GET | `/projects?status=` | list own projects (paginated) |
| POST | `/projects` | create draft |
| PATCH | `/projects/{id}` | update draft (autosave) |
| POST | `/projects/{id}/interpret` | AI interpretation of idea |
| POST | `/projects/{id}/keywords/generate` | generate queries (all intents, or `{"intent"}` to regenerate one group) |
| GET/POST | `/projects/{id}/queries` | list / add queries (founder-written queries are kept on regenerate) |
| PATCH/DELETE | `/projects/{id}/queries/{qid}` | edit text, enable/disable, remove |
| GET | `/research/sources` | providers + availability + stage + uses_queries |
| GET | `/research/estimate?project={id}&depth=` | credit estimate (balance before/after, budget) |
| GET | `/research/jobs?project={id}` | jobs for a project (latest first) |
| POST | `/research/jobs` | submit (requires `Idempotency-Key`) |
| GET | `/research/jobs/{id}` | status + stages |
| GET | `/reports/{project_id}?report=` | report snapshot (owner only; 404 until built; latest unless `report` id given): overview, demand, pain_points, competitors, opportunity, audience, distribution, evidence_index, notes |
| GET | `/reports/{project_id}/history` | report versions, newest first (score, confidence, depth) |
| GET | `/reports/{project_id}/export?report=` | Markdown download of a report |
| GET | `/reports/{project_id}/competitive-matrix?report=` | verified pricing (cheapest only within one billing period), feature grid, cited gap candidates + method; from the snapshot only |
| GET/POST/PATCH/DELETE | `/projects/{id}/assumptions` | founder's assumptions (status is theirs; AI rows can't be reworded, delete = dismiss); new evidence links must be in the free preview or cited by the latest report |
| GET | `/projects/compare?ids=a,b[,c,d]` | latest report summary for 2–4 own projects (400 bad ids, 404 any foreign) |
| GET/PUT | `/projects/{id}/unit-economics` | founder's simulator inputs (bounded floats), per project |
| GET/POST/PATCH/DELETE | `/projects/{id}/watches` | pages to monitor (owner only; ≤ 20 per project, 50 per account; URL must resolve to a public address); no etag/hash/page text in responses |
| POST | `/projects/{id}/watches/{wid}/check` | check now (10-min cooldown per watch) |
| POST | `/projects/{id}/watches/from-report` | `{competitor_ids}` → watch each competitor's read pricing page (or website) |
| GET/PATCH | `/projects/{id}/changes?watch=&significance=` | detected changes, newest first; only `seen` is writable |
| GET | `/monitoring/changes` | recent changes across your projects (owner only) |
| GET | `/notifications` | your notices + `unread` count |
| POST | `/notifications/read` | `{ids}` or `{all:true}` (web sessions only) |
| GET | `/billing/packs` | plan + limits + packs on sale (price label from the payment provider; no provider ids) |
| POST | `/billing/checkout` | `{pack}` → hosted checkout URL (web sessions only; API keys get 403; throttle `checkout`) |
| GET | `/billing/usage` | own credit ledger, paginated (credits only, never `cost_usd`) |
| POST | `/billing/webhooks/lemonsqueezy` | signed webhook (`X-Signature`, HMAC-SHA256); the only path that grants purchased credits |
| POST | `/analytics/events` | whitelisted client events, anonymous allowed, throttled; returns 204 |
| GET | `/evidence?project=&category=a,b&provider=&cluster=&q=&saved=1&duplicates=1` | evidence explorer (originals only by default, `duplicates` count) |
| PATCH | `/evidence/{id}` | `saved_by_user` only; source text is never editable |
| GET | `/evidence/facets?project=` | counts by category / provider / saved / duplicates |
| GET | `/evidence/clusters?project=` | AI themes with cited evidence ids and computed confidence |

## Auth
- **Browser:** django-allauth headless (`/_allauth/browser/v1/...`): email + password signup/login, Google OAuth, email verification. Session cookie + CSRF (`X-CSRFToken`).
- The Next.js app proxies `/api/*` and `/_allauth/*` to Django (`BACKEND_URL`), so cookies are first-party and no tokens live in JS storage.
- **MCP / scripts:** `Authorization: Api-Key vm_...` (keys managed at `/api/api-keys`).
- Signup grants `FREE_SIGNUP_CREDITS` once, only after the email is verified (`email_confirmed`, or a Google signup with a verified email). The `signup_grant:<user id>` idempotency key on `UsageTransaction` prevents double grants.
- API keys can read but cannot manage keys or change the account (a leaked key can't mint replacements).
- DRF throttling (`THROTTLE_ANON`/`THROTTLE_USER`) on the `CACHE_URL` cache. **Deploy note:** Next's rewrite proxy does not send `X-Forwarded-For`, so put a real reverse proxy in front that does and set `ALLAUTH_TRUSTED_PROXY_COUNT` before relying on per-IP auth rate limits.
- Google redirect URI: `{FRONTEND_ORIGIN}/accounts/google/login/callback/` (proxied; Django builds it from `X-Forwarded-Host`). "Continue with Google" only shows when `GOOGLE_CLIENT_ID`/`SECRET` are set.

## MCP server (`mcp-server/`)
Thin client over the REST API, authenticated with a user API key (`VALIDME_API_KEY`). Tools:
`validate_idea`, `get_research_status`, `get_report`, `search_evidence`, `list_competitors`, `suggest_channels`.
Set `VALIDME_MOCK=1` to return fixture data for local development without the backend.

## AI usage
LLM calls live only in `backend/research/ai/` behind one interface (`complete_json(prompt, schema)`), so the model provider (Claude or OpenAI) is a config switch. Every LLM output is validated against a schema before saving.

## Cost control
Per job: `search_cost + llm_input_cost + llm_output_cost`, stored on `UsageTransaction`. Cache search results 7 days by `(provider, normalized_query)`. Depth = hard budget of queries/results/tokens.

## Report (Week 4)
- Built by `reports/services.py::build_report` as the last job stage and stored as a `Report.content` snapshot, so a report never changes after it's generated.
- **Competitors** (`reports/competitors.py`): listed ones are profiled from the fetched page (`SourceSnapshot`); a price is kept only if it appears verbatim on that page, with its URL and retrieval date, otherwise pricing is "unavailable". Competitors mentioned in evidence must be named in the cited excerpts.
- **Scoring** (`reports/scoring.py`): deterministic, from evidence counts. A dimension without evidence is "not scored", its weight is excluded and `scored_weight` says how much of the model was scored. Confidence = min(volume, diversity, recency); low confidence never recommends "build".
- Market size stays "unavailable" until a sourced calculation exists. Unclassified evidence is never presented as a finding.

## Audience, distribution and history (Week 5)
- `reports/distribution.py` is deterministic. A channel is **Researched** only when classified evidence (pain, workaround, feature request, alternative seeking, pricing objection, buying intent) was published there; competitor pages never count. Other channels are **Hypothesis** with no evidence count.
- Audience segments are the founder's (or AI-suggested, labelled) segments matched to that evidence by word; needs come from AI themes that share records.
- Audience accessibility (10%) is now scored from researched channels: distinct places and threads. No places → not scored.
- The first-10 plan is a checklist the founder runs by hand. Nothing is sent for them (rule 8).
- A completed project can re-run (`POST /research/jobs`, new idempotency key); each run adds a `Report`, so history is the list of snapshots. A failed re-run keeps the project `COMPLETED` so earlier reports stay reachable.
- PDF export is the browser's print dialog on a print layout of all sections; Markdown export is server-side (`reports/export.py`).

## Billing, limits, recovery and analytics (Week 6)
- **Payments:** Lemon Squeezy is the merchant of record (tax/VAT, invoices, refunds). `POST /billing/checkout` creates a pending `Purchase` and returns a hosted checkout URL; no payment script runs on our pages. Credits are granted only by the signed `order_created` webhook, after checking the purchase id, the user, the pack's variant and test/live mode. `provider_order_id` is unique and the ledger key `purchase:<order>` is idempotent, so retries never double-credit. `order_refunded` takes back the pack's unspent credits once.
- **Packs and prices** live in config (`CREDIT_PACKS`) and in Lemon Squeezy. No price is hard-coded; the UI shows the provider's price or "Price shown at checkout". Without configuration, buying is closed.
- **Plan limits** (`billing/plans.py`, `PLAN_LIMITS`): "free" (no paid pack) runs Quick only; everyone has caps on running jobs and launches per day. Checked at launch under a lock on the user row; 403 `plan_depth`, 429 `too_many_running` / `daily_limit`, nothing charged.
- **Job recovery:** a job that fails (crash, or no source could be searched) is refunded once (`job_refund:<job>`). `recover_stuck_jobs` runs every 5 minutes via Celery beat (and `manage.py recover_jobs`): PENDING > 15 min or RUNNING > 45 min → FAILED with a visible reason, refunded, project released.
- **Errors:** API paths return the JSON error envelope for unmatched URLs and crashes (`config/errors.py`); messages never include exception details. Logs go to stdout; httpx request logs are off (their URLs can carry API keys).
- **Analytics:** first-party only (`analytics.AnalyticsEvent`): server events for research/report/purchase milestones; a short whitelist of client events via `POST /analytics/events`. No cookies, IP or user agent stored; query strings stripped; nothing sent when the browser signals Global Privacy Control or Do Not Track.
- **Free-plan evidence preview:** `EVIDENCE_PREVIEW_LIMIT` (10) most relevant originals per project are browsable in `GET /evidence` (and the MCP `search_evidence`); search, filters, duplicates, detail and save stay inside that set (`evidence/views.py::preview_ids`), and the list response carries `preview {limited, available, total}`. It's a browsing limit, not secrecy: reports and exports always include every record they cite (rule 1).
- **Refund edge cases:** partial refunds take back `floor(credits × refunded/total)`, cumulative and idempotent per level; a refund delivered before the paid event is recorded on the purchase (found via our purchase id) and the paid event then grants only the unrefunded part; a refund for an unlinked order returns 409 so the provider retries. `status: refunded` always counts as full.
- **Hardening (security review):** API keys stop working for deactivated users and write `last_used_at` at most every 5 minutes; throttles key on the proxy-appended IP (`DRF_NUM_PROXIES`); anonymous analytics has a global daily cap and per-event prop keys (slug values only); webhook signature compare is byte-safe; `Idempotency-Key` ≤ 80 chars; Celery soft/hard time limits sit below the stuck-job timeout and job status changes are conditional, so a recovered (refunded) job is never completed or restarted by a late worker; `LEMONSQUEEZY_TEST_MODE` defaults to DEBUG.

## Monitoring engine (Week 8)
- `monitoring` app: **Watch** (URL, cadence daily/weekly, next_run_at, validators, last hash, status) → **Observation** (stored only when the visible text changed, ≤ 20k chars) → **Change** (deterministic diff: prices added/removed, text blocks added/removed; significance high for price changes).
- **Cycle:** `claim_due` leases due watches with `select_for_update(skip_locked)` (one query + one update, whatever the count); `check_watch` takes a per-host slot (`cache.add`, Redis in prod), fetches through the SSRF-safe fetcher with `If-None-Match` / `If-Modified-Since`, hashes the normalized text and stops there when nothing changed. Errors back off (1h, 2h, 4h…) and pause the watch after 5 in a row. Retention keeps the last 10 observations plus any a Change references.
- **Runs locally** with `python manage.py monitor` (one cycle) or `--loop --interval 60`; in production Celery beat calls `monitoring.tasks.run_due_watches` every 5 minutes and fans out one task per watch.
- No AI yet (Week 9 adds summaries of the diff only, labelled).
- **Hardening (security review):** the diff is a linear multiset difference (no difflib), so a hostile page can't stall a worker, and it runs before any transaction opens; Celery check tasks have their own 60/90 s limits. Claims carry a lease token (a duplicate or stale task can't run a check twice) and take at most one watch per host per cycle. Politeness slots are per host **and** per resolved IP, so wildcard DNS can't multiply requests to one victim. ETag/Last-Modified are stored only when printable ASCII; any unexpected error counts as a failed check (backoff/pause). Changes are capped per watch (`MONITORING_KEEP_CHANGES`). "Check now" claims its cooldown atomically and runs on the task queue; create/check/from-report share the `monitoring` throttle. MCP API keys are read-only on monitoring.
- **Production requires a shared cache:** with `DEBUG` off the app refuses to start if `CACHE_URL` is the per-process locmem cache (throttles, the analytics cap and monitoring politeness would silently multiply).

## Change intelligence & alerts (Week 9)
- **AI summary of a change** (`monitoring/summarize.py`, prompt `change_summary_v1`): input is the deterministic diff only (prices added/removed, up to 20 text blocks), escaped so page text can't close the `<diff>` tag; stored in `Change.ai_summary` / `ai_watch_for` apart from the factual `summary` and always labelled. Dropped if it mentions a price not in the diff. Low-significance changes aren't summarised; per-account daily cap `MONITORING_AI_DAILY` (free 10, paid 100); cost on the ledger with 0 credits.
- **Notifications** (`notifications` app): one per change (deduped by `source`), notice first then summary, each isolated so neither fails the check; links must be internal app paths; inbox capped at 200 per user. Bell polls once a minute while visible.
- **Entitlements v1** (`PLAN_LIMITS`): free 3 watched pages, weekly; paid 50, daily or weekly. Enforced on create / from-report / cadence change (user row locked); after a downgrade the oldest watches up to the limit keep running and the rest wait (shown on the page). `/me` returns `monitoring {max_watches, cadences, used}`.

