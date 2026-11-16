"""AI rationale for a signal (optional, labelled). Input: the signal's computed facts and short quoted excerpts of
its own evidence. Output is dropped if it mentions a number that isn't in that input (rule 1)."""

from __future__ import annotations

import json
import logging
import re

from billing.models import UsageTransaction
from monitoring.summarize import under_daily_ai_cap
from radar.models import Signal
from research.ai import client as llm
from research.ai import prompts
from research.ai.tasks import SYSTEM, _quote
from research.providers.base import redact

logger = logging.getLogger(__name__)

SCHEMA = {
    "type": "object",
    "properties": {
        "rationale": {"type": "string", "minLength": 1, "maxLength": 400},
        "action": {"type": "string", "minLength": 1, "maxLength": 240},
    },
    "required": ["rationale", "action"],
    "additionalProperties": False,
}
MAX_EXCERPTS = 5
EXCERPT_CHARS = 300
PER_RUN = 3  # rationales per project per run: only the strongest new signals
# A number with what makes it a claim: currency before, unit after ("$9bn", "17%", "6x", "3.5k", "2 million").
_NUM = re.compile(
    r"(?P<cur>[$€£])?\s?(?P<n>\d+(?:[.,]\d+)*)\s?(?P<unit>%|x\b|×|k\b|m\b|bn\b|b\b|million|billion|thousand)?",
    re.IGNORECASE,
)
# Magnitude and change words make numeric claims without digits.
_WORDS = re.compile(
    r"\b(doubl\w*|tripl\w*|quadrupl\w*|halv\w*|dozens|hundreds|thousands|millions|billions|"
    r"twice|thrice|(?:two|three|four|five|ten)[- ]?fold)\b",
    re.IGNORECASE,
)
# Facts the AI may quote: counts and prices. Never dates, URLs, ids or anything copied from a page.
QUOTABLE_FACTS = ("records", "distinct_sources", "sites", "recent", "baseline", "baseline_per_30_days", "ratio")


def _excerpts(signal: Signal) -> str:
    rows = signal.evidence.filter(duplicate_of__isnull=True).order_by("-relevance", "-id")[:MAX_EXCERPTS]
    return "\n".join(f"- {e.excerpt[:EXCERPT_CHARS]}" for e in rows)


def _claims(text: str) -> set[str]:
    """Normalised numeric claims: "6x" and "6×" are the same; "$9bn" is not "9"."""
    out = set()
    for m in _NUM.finditer(text):
        n = m.group("n").replace(",", "")
        n = n[:-2] if n.endswith(".0") else n
        unit = (m.group("unit") or "").lower().replace("×", "x")
        out.add(f"{m.group('cur') or ''}{n}{unit}")
    return out


def allowed_claims(signal: Signal) -> set[str]:
    f = signal.facts or {}
    nums = [f[k] for k in QUOTABLE_FACTS if isinstance(f.get(k), int | float)]
    allowed = set()
    for v in nums:
        allowed |= _claims(str(v))
        if f.get("ratio") == v:
            allowed |= _claims(f"{v}x")
    for p in list(f.get("prices_added") or []) + list(f.get("prices_removed") or []):
        allowed |= _claims(str(p))
    return allowed


def invents_numbers(signal: Signal, text: str) -> bool:
    """Rule 1: an AI sentence may only use the counts and prices we computed (with the same unit)."""
    return bool(_claims(text) - allowed_claims(signal)) or bool(_WORDS.search(text))


def add_rationale(signal: Signal) -> bool:
    """Fill ai_rationale / ai_action when AI is configured and the owner is under today's cap."""
    if signal.ai_rationale or signal.ai_version or not llm.is_configured():
        return False
    project = signal.project
    if not under_daily_ai_cap(project.owner):
        return False
    template, version = prompts.load("signal_rationale_v1")
    facts = json.dumps(signal.facts, ensure_ascii=False, default=str)[:2000]
    excerpts = _excerpts(signal)
    idea = getattr(getattr(project, "idea", None), "original_description", "") or project.name
    prompt = template.format(
        idea=_quote(idea[:400]),
        type=signal.type,
        title=_quote(signal.title),
        facts=_quote(redact(facts)),
        excerpts=_quote(excerpts),
    )
    try:
        result = llm.complete_json(prompt, SCHEMA, system=SYSTEM, max_tokens=500)
    except llm.LLMError as exc:
        _record(project.owner_id, getattr(exc, "cost_usd", 0) or 0, "radar_rationale_failed")
        _mark(signal, f"failed:{version}")
        logger.warning("signal rationale failed for signal %s", signal.pk)
        return False
    _record(project.owner_id, result.cost_usd, "radar_rationale")
    rationale = result.data["rationale"].strip()[:400]
    action = result.data["action"].strip()[:240]
    if invents_numbers(signal, rationale + " " + action):
        _mark(signal, f"discarded:{version}")
        logger.warning("AI rationale for signal %s used numbers not in its sources; discarded", signal.pk)
        return False
    signal.ai_rationale, signal.ai_action = rationale, action
    signal.ai_version = f"{version}@{result.model}"[:60]
    signal.save(update_fields=["ai_rationale", "ai_action", "ai_version", "updated_at"])
    return True


def _mark(signal: Signal, version: str) -> None:
    """Remember an attempt that produced nothing, so it isn't retried (and doesn't spend the daily cap again)."""
    signal.ai_version = version[:60]
    signal.save(update_fields=["ai_version", "updated_at"])


def add_rationales(signals: list[Signal]) -> int:
    done = 0
    for s in sorted(signals, key=lambda s: -s.rank)[:PER_RUN]:
        try:
            done += add_rationale(s)
        except Exception:  # noqa: BLE001 - optional, never blocks the signal
            logger.exception("rationale for signal %s crashed", s.pk)
    return done


def _record(user_id, cost_usd, operation: str) -> None:
    # Real provider cost on the ledger (0 credits), counted against the same daily AI cap as change summaries.
    UsageTransaction.objects.create(user_id=user_id, operation=operation, credits=0, cost_usd=cost_usd)
