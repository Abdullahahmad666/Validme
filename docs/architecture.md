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

## Job states
`DRAFT → PENDING → RUNNING → COMPLETED | PARTIALLY_COMPLETED | FAILED | CANCELLED`
Each stage writes a `JobStage` row so the progress screen shows real status (no fake percentages).

## API (v1, all under `/api/`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/projects` | create draft |
| PATCH | `/projects/{id}` | update draft (autosave) |
| POST | `/projects/{id}/interpret` | AI interpretation of idea |
| POST | `/projects/{id}/keywords/generate` | generate queries |
| GET | `/research/sources` | providers + availability |
| GET | `/research/estimate?project={id}&depth=` | credit estimate |
| POST | `/research/jobs` | submit (requires `Idempotency-Key`) |
| GET | `/research/jobs/{id}` | status + stages |
| GET | `/reports/{project_id}` | full report |
| GET | `/evidence?project=&category=&q=` | evidence explorer |

## MCP server (`mcp-server/`)
Thin client over the REST API, authenticated with a user API key (`VALIDME_API_KEY`). Tools:
`validate_idea`, `get_research_status`, `get_report`, `search_evidence`, `list_competitors`, `suggest_channels`.
Set `VALIDME_MOCK=1` to return fixture data for local development without the backend.

## AI usage
LLM calls live only in `backend/research/ai/` behind one interface (`complete_json(prompt, schema)`), so the model provider (Claude or OpenAI) is a config switch. Every LLM output is validated against a schema before saving.

## Cost control
Per job: `search_cost + llm_input_cost + llm_output_cost`, stored on `UsageTransaction`. Cache search results 7 days by `(provider, normalized_query)`. Depth = hard budget of queries/results/tokens.
