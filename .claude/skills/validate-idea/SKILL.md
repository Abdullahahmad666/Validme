---
name: validate-idea
description: Validate a startup or product idea with ValidMe's MCP tools — demand evidence, competitors, pain points and a first-10-customers plan. Use when the user asks to validate, research, or sanity-check an idea.
---

# Validate an idea with ValidMe

Requires the `validme` MCP server (configured in `.mcp.json`).

1. Restate the idea in one sentence and confirm audience + geography with the user if unclear.
2. Call `validate_idea` with `idea`, `audience`, `geography`, `depth` (default `standard`). Tell the user the estimated credits before confirming a `deep` run.
3. Poll `get_research_status` until `COMPLETED` or `PARTIALLY_COMPLETED`; tell the user which sources failed if partial.
4. Call `get_report` and present: verdict (score + confidence together), top 3 pain points with source links, competitors and their gaps, and the first-10-customers plan. Mark hypotheses as hypotheses.
5. Offer `search_evidence` for follow-up questions. Never state a claim that isn't in the returned evidence.
