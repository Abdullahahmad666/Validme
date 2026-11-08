---
name: evidence-pipeline
description: Work on ValidMe's evidence processing, LLM prompts, classification, clustering, competitor gap analysis, opportunity scoring, or report generation. Use for backend/evidence, backend/reports, backend/research/ai.
---

# Evidence pipeline rules

Pipeline: normalize → dedupe → classify → cluster → competitor gaps → score → distribution → report.

## Classification categories (fixed enum)
`pain_point`, `feature_request`, `alternative_seeking`, `pricing_objection`, `buying_intent`, `workaround`, `positive_feedback`, `irrelevant`.

## LLM calls
- Only through `research/ai/client.py::complete_json(prompt, schema)`. Validate output with the schema; on failure retry once, then mark the item `unclassified`.
- Prompts live in `research/ai/prompts/` as versioned files (`classify_v1.md`). Store `prompt_version` on outputs.
- The model may only **cite evidence IDs it was given**. Reject outputs that reference unknown IDs.
- Batch items (≤ 25 per call) to control cost; record tokens and cost on the job.

## Traceability
- Every `PainPoint`, `CompetitorGap`, `Opportunity` reason and `ChannelRecommendation` has a M2M to `Evidence` (≥ 1, except channels flagged `is_hypothesis=True`).
- Counts shown to users are **distinct sources after dedupe**, plus date range and providers covered.
- Never store LLM text in `Evidence.excerpt`.

## Scoring
Weights in `reports/scoring.py` (see PRD §8). Each dimension returns `score (0–100)`, `confidence (low/medium/high)`, `evidence_ids`, `explanation`. Overall confidence = min of evidence volume, source diversity, recency. TAM/SAM/SOM: show calculation + sources or `unavailable`.

## Quality check
Run `backend/research/tests/quality/` fixtures and ask the `research-quality-reviewer` subagent to review a generated report before merging.
