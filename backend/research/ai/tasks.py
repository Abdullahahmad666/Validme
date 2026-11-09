"""AI steps used while drafting a project: interpret the idea, generate search queries.

Results are stored separately from the founder's input (IdeaDefinition.ai_interpretation,
ResearchQuery.ai_generated) and every call's cost is recorded on the usage ledger (0 credits:
drafts never consume credits).
"""

from __future__ import annotations

import json

from django.db import transaction

from billing.models import UsageTransaction
from projects.models import Project
from research.ai import prompts
from research.ai.client import LLMResult, complete_json
from research.models import ResearchQuery

INTERPRET_PROMPT = "interpret_v1"
QUERIES_PROMPT = "queries_v1"

SYSTEM = (
    "You are a careful market research assistant for indie founders. You never invent facts, "
    "numbers, competitors or sources. When something can't be known from the input, you say so."
)

_text = {"type": "string", "minLength": 1, "maxLength": 400}
_list = lambda item, max_items: {"type": "array", "items": item, "maxItems": max_items}  # noqa: E731

INTERPRETATION_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "problem",
        "solution",
        "target_customers",
        "category",
        "industry",
        "customer_type",
        "suggested_audiences",
        "suggested_geographies",
        "assumptions",
        "clarifying_questions",
    ],
    "properties": {
        "problem": _text,
        "solution": _text,
        "target_customers": _list({"type": "string", "minLength": 1, "maxLength": 120}, 5),
        "category": {"type": "string", "minLength": 1, "maxLength": 80},
        "industry": {"type": "string", "minLength": 1, "maxLength": 120},
        "customer_type": {"type": "string", "enum": ["B2B", "B2C", "B2B2C"]},
        "suggested_audiences": _list({"type": "string", "minLength": 1, "maxLength": 120}, 6),
        "suggested_geographies": _list({"type": "string", "minLength": 1, "maxLength": 80}, 6),
        "assumptions": _list({"type": "string", "minLength": 1, "maxLength": 200}, 6),
        "clarifying_questions": _list({"type": "string", "minLength": 1, "maxLength": 200}, 4),
    },
}

INTENTS = [i.value for i in ResearchQuery.Intent]

QUERIES_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["queries"],
    "properties": {
        "queries": {
            "type": "array",
            "minItems": 1,
            "maxItems": 24,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["text", "intent"],
                "properties": {
                    "text": {"type": "string", "minLength": 3, "maxLength": 120},
                    "intent": {"type": "string", "enum": INTENTS},
                },
            },
        }
    },
}


def _record_cost(project: Project, operation: str, result: LLMResult) -> None:
    UsageTransaction.objects.create(user=project.owner, operation=operation, credits=0, cost_usd=result.cost_usd)


def _idea_text(project: Project) -> str:
    idea = project.idea
    parts = [f"Name: {project.name}", f"Description: {idea.original_description}"]
    if idea.additional_context:
        parts.append(f"Additional context: {idea.additional_context}")
    if idea.existing_product_url:
        parts.append(f"Existing product: {idea.existing_product_url}")
    return "\n".join(parts)


def interpret_idea(project: Project) -> dict:
    """Store and return the AI interpretation. Never touches the founder's own fields."""
    template, version = prompts.load(INTERPRET_PROMPT)
    result = complete_json(template.format(idea=_idea_text(project)), INTERPRETATION_SCHEMA, system=SYSTEM, max_tokens=4000)
    with transaction.atomic():
        idea = project.idea
        idea.ai_interpretation = result.data
        idea.ai_prompt_version = version
        idea.user_confirmed = False
        idea.save(update_fields=["ai_interpretation", "ai_prompt_version", "user_confirmed"])
        _record_cost(project, "ai_interpret", result)
    return result.data


def _market_text(project: Project) -> str:
    m = getattr(project, "market", None)
    if m is None:
        return "Not specified yet."
    fields = {
        "Industry": m.industry,
        "Customer type": m.customer_type,
        "Audiences": ", ".join(m.audiences),
        "Geographies": ", ".join(m.geographies),
        "Current alternatives": m.current_alternatives,
    }
    lines = [f"{k}: {v}" for k, v in fields.items() if v]
    return "\n".join(lines) or "Not specified yet."


def generate_queries(project: Project, intent: str | None = None, per_intent: int = 3) -> list[ResearchQuery]:
    """Generate queries for all intents (or one, to regenerate a group).

    Replaces AI-generated queries the founder hasn't edited; keeps queries they added or changed.
    """
    template, version = prompts.load(QUERIES_PROMPT)
    intent_note = f"\nOnly write {intent} queries ({per_intent + 2} of them).\n" if intent else ""
    prompt = template.format(
        idea=_idea_text(project),
        market=_market_text(project),
        per_intent=per_intent,
        intent_note=intent_note,
    )
    if project.idea.ai_interpretation:
        prompt += f"\n<interpretation>\n{json.dumps(project.idea.ai_interpretation)}\n</interpretation>\n"
    result = complete_json(prompt, QUERIES_SCHEMA, system=SYSTEM, max_tokens=4000)

    items = result.data["queries"]
    if intent:
        items = [q for q in items if q["intent"] == intent]
    seen: set[str] = set()
    unique = []
    for q in items:
        key = " ".join(q["text"].lower().split())
        if key not in seen:
            seen.add(key)
            unique.append(q)

    with transaction.atomic():
        stale = ResearchQuery.objects.filter(project=project, ai_generated=True, user_modified=False)
        if intent:
            stale = stale.filter(intent=intent)
        stale.delete()
        created = ResearchQuery.objects.bulk_create(
            [
                ResearchQuery(project=project, text=q["text"][:200], intent=q["intent"], ai_generated=True, prompt_version=version)
                for q in unique
            ]
        )
        _record_cost(project, "ai_queries", result)
    return created
