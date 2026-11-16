---
name: ship-check
description: Pre-merge / pre-release checklist for ValidMe. Use when the user says ship, release, deploy, ready to merge, or asks to verify a feature is done.
---

# Ship check

This is also the weekly gate. Run each and report pass/fail with the output:
1. `cd backend && ruff check . && pytest -q`
2. `cd frontend && npm run lint && npm run typecheck && npm test && npm run build`
3. `cd mcp-server && pytest -q`
4. **Dependency scans** (must be clean before merge):
   - `cd backend && pip-audit -r requirements.lock` (falls back to `-r requirements.txt` only if the lock is missing; then say so).
   - `cd frontend && npm audit --omit=dev` → 0 vulnerabilities. `npm audit` (dev tools too) → only the accepted
     findings listed in `docs/architecture.md` › Dependencies; anything new is a blocker or needs a written reason.
   - If `requirements.txt` changed, regenerate the lock: `python -m piptools compile --generate-hashes --strip-extras --allow-unsafe -o requirements.lock requirements.txt`.
5. **Performance** (PostgreSQL, `DEBUG=True`): `cd backend && python manage.py perf_check --evidence 2000 --strict`.
   Budgets: p95 ≤ 250 ms and ≤ 20 queries per endpoint. Add any new read endpoint to `_endpoints()` in
   `projects/management/commands/perf_check.py` (and seed what it needs) in the same change. Report the table.
6. Search the diff for secrets (`sk-`, `api_key=`, `.env`) and for `TODO: fake` or hardcoded sample numbers outside `src/mocks/`.
7. Owner-isolation: confirm new querysets filter by owner and a cross-user test exists.
8. Evidence rule: any new user-facing finding has an evidence link or is labelled hypothesis/unavailable.
9. SEO: new public pages are in `frontend/src/content/seo.ts` and `npm test` passes the SEO guard; spot-check `/og/<key>/og.png` renders and `/sitemap.xml`, `/llms.txt` list the page.
10. `.env.example` updated for new env vars; `docs/roadmap.md` boxes ticked; `docs/architecture.md` API table current.
11. Reviews: `security-reviewer` subagent for every change that touches auth, billing, email, providers, monitoring or the MCP server; `ui-reviewer` for screen changes. Fix or explicitly accept each finding before committing.
Summarize what's blocking, if anything.
