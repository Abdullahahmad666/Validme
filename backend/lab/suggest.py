"""AI copy suggestions for a Lab page, and survey questions from the founder's assumptions (labelled; the founder edits
them). Input: the idea, its audience and the names
of its strongest pain themes. Output is refused if it contains numbers, links or testimonial-like claims, because a
public page must not state invented facts (rule 1)."""

from __future__ import annotations

import logging
import re

from billing.models import UsageTransaction
from lab.blocks import _LINKY, clean_blocks, validate_blocks
from monitoring.summarize import under_daily_ai_cap
from research.ai import client as llm
from research.ai import prompts
from research.ai.tasks import SYSTEM, _quote

logger = logging.getLogger(__name__)

_item = lambda props, req: {"type": "object", "properties": props, "required": req, "additionalProperties": False}  # noqa: E731
_s = lambda n: {"type": "string", "minLength": 1, "maxLength": n}  # noqa: E731
SCHEMA = _item(
    {
        "headline": _s(90),
        "subheadline": _s(240),
        "problem": _s(600),
        "benefits": {
            "type": "array",
            "minItems": 1,
            "maxItems": 4,
            "items": _item({"title": _s(60), "body": _s(200)}, ["title", "body"]),
        },
        "faq": {"type": "array", "minItems": 1, "maxItems": 4, "items": _item({"q": _s(120), "a": _s(400)}, ["q", "a"])},
    },
    ["headline", "subheadline", "problem", "benefits", "faq"],
)
# A public page must not state invented facts. These patterns refuse a draft that has any number (digits or words),
# multipliers, prices or currency, "free"/discounts, availability or launch claims, dates, quoted testimonials,
# ratings and superlatives. Filters can't catch everything, which is why the editor says so and the founder reviews.
_NUMBER_WORDS = (
    r"one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|"
    r"eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundreds?|thousands?|millions?|"
    r"billions?|dozens?|percent|half|twice|double[sd]?|triple[sd]?|quadruple[sd]?|tenfold"
)
_NUMBERS = re.compile(rf"\d|[$€£¥%]|\b(?:{_NUMBER_WORDS})\b|\btimes (?:faster|more|less|cheaper|better)\b", re.IGNORECASE)
_CLAIMS = re.compile(
    r"(?:\b(?:trusted by|loved by|used by|relied on|customers (?:say|love)|testimonials?|star reviews?|rated|ratings?|award|"
    r"as seen|guarantee[ds]?|number one|best[- ]in[- ]class|the best|the only|first and only|leading|fastest|cheapest|"
    r"proven|certified|official|partner(?:ed|s)? with|(?<![-\w])free(?! up)|discount|dollars?|euros?|pounds?|cents?|"
    r"available (?:now|today)|now available|launch(?:ed|es|ing)?|live now|in beta|coming soon|soon|"
    r"this (?:week|month|year|spring|summer|autumn|fall|winter)|"
    r"next (?:week|month|year)|january|february|april|june|july|august|september|october|november|december)\b)"
    r"|#\s*1\b"
    r"|[\"“'‘][^\"”'’]{3,}[\"”'’]\s*[-–—]\s*\w",  # a quote attributed to someone: a testimonial
    re.IGNORECASE,
)


class SuggestError(Exception):
    pass


def suggest(project, user) -> list[dict]:
    """Blocks to offer as suggestions: hero, problem, benefits, faq. Raises SuggestError with a user-safe reason."""
    if not llm.is_configured():
        raise SuggestError("AI suggestions aren't available right now.")
    if not under_daily_ai_cap(user):
        raise SuggestError("You've used today's AI allowance. Try again tomorrow.")
    from evidence.models import EvidenceCluster

    idea = getattr(getattr(project, "idea", None), "original_description", "") or project.name
    market = getattr(project, "market", None) if hasattr(project, "market") else None
    audience = ", ".join(market.audiences[:3]) if market and market.audiences else "not specified"
    themes = list(EvidenceCluster.objects.filter(project=project).values_list("name", flat=True)[:5])
    template, version = prompts.load("lab_copy_v1")
    prompt = template.format(
        idea=_quote(idea[:800]), audience=_quote(audience[:300]), themes=_quote("\n".join(f"- {t}" for t in themes) or "none yet")
    )
    try:
        result = llm.complete_json(prompt, SCHEMA, system=SYSTEM, max_tokens=1500)
    except llm.LLMError as exc:
        UsageTransaction.objects.create(user=user, operation="lab_copy_failed", credits=0, cost_usd=getattr(exc, "cost_usd", 0) or 0)
        raise SuggestError("The AI couldn't write suggestions this time. Please try again.") from exc
    UsageTransaction.objects.create(user=user, operation="lab_copy", credits=0, cost_usd=result.cost_usd)
    d = result.data
    blocks = clean_blocks(
        [
            {"type": "hero", "headline": d["headline"], "subheadline": d["subheadline"], "cta_label": "Join the waitlist"},
            {"type": "problem", "heading": "The problem", "body": d["problem"]},
            {"type": "benefits", "heading": "What it would do", "items": d["benefits"]},
            {"type": "faq", "heading": "Questions", "items": d["faq"]},
        ]
    )
    text = " ".join(v for b in blocks for k, v in _pairs(b) if k != "type" and k != "cta_label")
    if (
        _NUMBERS.search(text)
        or _CLAIMS.search(text)
        or _LINKY.search(text)
        or _names_competitor(project, text)
        or validate_blocks(blocks)
    ):
        logger.warning("lab copy suggestion for project %s broke the rules; discarded", project.pk)
        raise SuggestError("The AI's draft included claims we can't allow on a public page. Please try again or write your own.")
    return blocks


def _names_competitor(project, text: str) -> bool:
    """Comparisons with named products are claims the founder must make themselves, if at all."""
    from reports.models import Competitor

    names = {n.strip() for n in Competitor.objects.filter(project=project).values_list("name", flat=True) if len(n.strip()) >= 3}
    return any(re.search(rf"(?<!\w){re.escape(n)}(?!\w)", text, re.IGNORECASE) for n in names)


def _pairs(v, key=""):
    if isinstance(v, dict):
        for k, x in v.items():
            yield from _pairs(x, k)
    elif isinstance(v, list):
        for x in v:
            yield from _pairs(x, key)
    elif isinstance(v, str):
        yield key, v


def _flatten(v):
    if isinstance(v, dict):
        for x in v.values():
            yield from _flatten(x)
    elif isinstance(v, list):
        for x in v:
            yield from _flatten(x)
    elif isinstance(v, str):
        yield v


# --- survey questions (Week 14) ---------------------------------------------------------------------------------

MAX_SUGGESTED_QUESTIONS = 8
QUESTION_SCHEMA = _item(
    {
        "questions": {
            "type": "array",
            "minItems": 1,
            "maxItems": MAX_SUGGESTED_QUESTIONS,
            "items": _item(
                {
                    "assumption_id": {"type": "integer"},
                    "type": {"enum": ["single", "multi", "scale", "text"]},
                    "prompt": _s(200),
                    "options": {"type": "array", "maxItems": 6, "items": _s(80)},
                    "low_label": {"type": "string", "maxLength": 30},
                    "high_label": {"type": "string", "maxLength": 30},
                },
                ["assumption_id", "type", "prompt", "options", "low_label", "high_label"],
            ),
        }
    },
    ["questions"],
)
# Leading or salesy wording, and requests for personal data, aren't neutral survey questions.
_LEADING = re.compile(
    r"\b(?:don't you|wouldn't you|won't you|isn't it|aren't you|agree that|how much would you love|wouldn't it be|"
    r"amazing|revolutionary|game[- ]chang\w*|incredible|your (?:full )?name|phone number|home address|date of birth)\b",
    re.IGNORECASE,
)


def suggest_questions(project, user) -> list[dict]:
    """One neutral question per open assumption (max 8), each linked to it. Raises SuggestError with a safe reason."""
    from lab.surveys import validate_questions

    assumptions = list(project.assumptions.filter(dismissed=False)[:MAX_SUGGESTED_QUESTIONS])  # contradicted ones can be re-tested
    if not assumptions:
        raise SuggestError("Add an assumption you want to test first (on the report's Assumptions tab).")
    if not llm.is_configured():
        raise SuggestError("AI suggestions aren't available right now.")
    if not under_daily_ai_cap(user):
        raise SuggestError("You've used today's AI allowance. Try again tomorrow.")
    idea = getattr(getattr(project, "idea", None), "original_description", "") or project.name
    listed = "\n".join(f'<assumption id="{a.id}">{_quote(a.text[:300])}</assumption>' for a in assumptions)
    template, _version = prompts.load("lab_survey_v1")
    prompt = template.format(idea=_quote(idea[:800]), assumptions=listed)
    try:
        result = llm.complete_json(prompt, QUESTION_SCHEMA, system=SYSTEM, max_tokens=2000)
    except llm.LLMError as exc:
        UsageTransaction.objects.create(user=user, operation="lab_survey_failed", credits=0, cost_usd=getattr(exc, "cost_usd", 0) or 0)
        raise SuggestError("The AI couldn't write questions this time. Please try again.") from exc
    UsageTransaction.objects.create(user=user, operation="lab_survey", credits=0, cost_usd=result.cost_usd)
    allowed = {a.id for a in assumptions}
    questions = []
    for raw in result.data.get("questions", []):
        if raw.get("assumption_id") not in allowed:
            continue  # only questions about the founder's own assumptions
        q = {"id": f"q{len(questions) + 1}", "type": raw["type"], "prompt": raw["prompt"], "required": False, "drafted_by": "ai"}
        q["assumption_id"] = raw["assumption_id"]
        if raw["type"] in ("single", "multi"):
            q["options"] = raw.get("options") or []
        if raw["type"] == "scale":
            q["low_label"] = raw.get("low_label") or "Not at all"
            q["high_label"] = raw.get("high_label") or "Very much"
        q = clean_blocks(q)  # strip control/bidi characters first, so nothing is hidden from the checks below
        text = " ".join([q["prompt"], *q.get("options", [])])
        if _LEADING.search(text) or _LINKY.search(text) or validate_questions([q], allowed):
            logger.warning("lab survey suggestion for project %s dropped a question that broke the rules", project.pk)
            continue
        questions.append(q)
    if not questions:
        raise SuggestError(
            "The AI's questions didn't meet the rules for neutral survey questions. Please try again or write your own."
        )
    return questions
