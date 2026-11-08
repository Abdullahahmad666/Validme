---
name: add-provider
description: Add or change a ValidMe research data provider (web search, Hacker News, Stack Exchange, competitor pages, user URLs, licensed sources). Use when touching backend/research/providers/.
---

# Add a research provider

1. **Check permission first.** Confirm the source is ✅ in `docs/data-sources.md`. If not listed, research its current API terms, add a row with the decision and date, and stop if commercial use isn't allowed.
2. Create `backend/research/providers/<key>.py` implementing `ResearchProvider` from `research/providers/base.py`:
   - `key`, `label`, `contributes` (short text shown in the UI source card)
   - `availability()` → returns `Availability` based on env config (missing API key ⇒ `REQUIRES_CONNECTION`)
   - `search(query, budget)` → list of `RawResult`; respect `budget.max_results`; set timeouts (10s) and retry once on 5xx
   - `normalize(raw)` → `EvidenceIn` with `source_url`, `title`, `excerpt` (≤ 500 chars), `published_at`, `retrieved_at`, `author_hash` (hashed, only if legitimately available)
3. Register it in `research/providers/registry.py`.
4. Add the API key name to `.env.example` and `backend/config/settings.py`.
5. Cost: record per-call cost via `budget.charge(usd)`.
6. Tests in `backend/research/tests/test_provider_<key>.py` using recorded fixture JSON (no live network in tests): normalize mapping, availability without key, budget respected, failure returns error not exception to the orchestrator.
7. Run `cd backend && pytest`.
