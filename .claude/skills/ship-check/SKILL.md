---
name: ship-check
description: Pre-merge / pre-release checklist for ValidMe. Use when the user says ship, release, deploy, ready to merge, or asks to verify a feature is done.
---

# Ship check

Run each and report pass/fail with the output:
1. `cd backend && ruff check . && pytest -q`
2. `cd frontend && npm run lint && npm run typecheck && npm run build`
3. `cd mcp-server && pytest -q`
4. Search the diff for secrets (`sk-`, `api_key=`, `.env`) and for `TODO: fake` or hardcoded sample numbers outside `src/mocks/`.
5. Owner-isolation: confirm new querysets filter by owner and a cross-user test exists.
6. Evidence rule: any new user-facing finding has an evidence link or is labelled hypothesis/unavailable.
7. `.env.example` updated for new env vars; `docs/roadmap.md` boxes ticked; `docs/architecture.md` API table current.
8. Delegate a final review to the `security-reviewer` subagent for auth, billing, or provider changes.
Summarize what's blocking, if anything.
