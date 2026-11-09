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
