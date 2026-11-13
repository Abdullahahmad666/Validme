"""AI summaries of detected changes (Week 9). Input is the deterministic diff only, never the full page.

The deterministic `Change.summary` stays the fact; `ai_summary` is a separate, labelled AI conclusion
(CLAUDE.md rule 2). Low-significance changes aren't summarised (cost), and a failure leaves the field empty.
"""

from __future__ import annotations

import logging
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from billing.models import UsageTransaction
from monitoring.diff import prices
from monitoring.models import Change
from research.ai import client as llm
from research.ai import prompts
from research.ai.tasks import SYSTEM, _quote
from research.providers.base import redact

logger = logging.getLogger(__name__)

SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string", "minLength": 1, "maxLength": 300},
        "watch_for": {"type": "string", "maxLength": 200},
    },
    "required": ["summary", "watch_for"],
    "additionalProperties": False,
}
MAX_DIFF_CHARS = 6000


def _diff_text(change: Change) -> str:
    d = change.details or {}
    lines = [f"PRICE ADDED: {p}" for p in d.get("prices_added", [])]
    lines += [f"PRICE REMOVED: {p}" for p in d.get("prices_removed", [])]
    lines += [f"+ {b}" for b in d.get("blocks_added", [])]
    lines += [f"- {b}" for b in d.get("blocks_removed", [])]
    return "\n".join(lines)[:MAX_DIFF_CHARS]


def summarize_change(change: Change) -> bool:
    """Fill change.ai_summary when worth it and possible. Returns True if a summary was stored."""
    if change.significance == Change.Significance.LOW or change.ai_summary or not llm.is_configured():
        return False
    if not _under_daily_cap(change):
        return False
    template, version = prompts.load("change_summary_v1")
    watch = change.watch
    # Everything from the page is escaped so it can't close the <diff> tag (or open a new one).
    prompt = template.format(
        label=_quote(watch.label or "unnamed"),
        url=_quote(redact(watch.url)),
        summary=_quote(change.summary),
        diff=_quote(_diff_text(change)),
    )
    try:
        result = llm.complete_json(prompt, SCHEMA, system=SYSTEM, max_tokens=600)
    except llm.LLMError as exc:
        _record(change, getattr(exc, "cost_usd", 0) or 0, "monitoring_summary_failed")
        logger.warning("change summary failed for change %s", change.pk)
        return False
    _record(change, result.cost_usd, "monitoring_summary")
    summary = result.data["summary"].strip()[:300]
    watch_for = (result.data.get("watch_for") or "").strip()[:200]
    if _invented_prices(change, summary + " " + watch_for):
        # Rule 1: an AI sentence may only quote prices that appear in the diff. Otherwise it's dropped.
        logger.warning("AI summary for change %s mentioned prices not in the diff; discarded", change.pk)
        return False
    change.ai_summary = summary
    change.ai_watch_for = watch_for
    change.ai_version = f"{version}@{result.model}"[:60]
    change.save(update_fields=["ai_summary", "ai_watch_for", "ai_version"])
    return True


def _under_daily_cap(change: Change) -> bool:
    """Per-account daily cap on AI summaries (a page that changes on every visit can't run up AI cost)."""
    from billing.plans import plan_for

    owner = change.project.owner
    since = timezone.now() - timedelta(days=1)
    used = UsageTransaction.objects.filter(user=owner, operation__startswith="monitoring_summary", created_at__gte=since).count()
    return used < settings.MONITORING_AI_DAILY.get(plan_for(owner), 0)


def _invented_prices(change: Change, text: str) -> bool:
    d = change.details or {}
    allowed = set(d.get("prices_added", [])) | set(d.get("prices_removed", []))
    blocks = " ".join(d.get("blocks_added", []) + d.get("blocks_removed", []))
    return any(p not in allowed and p not in blocks for p in prices(text))


def _record(change: Change, cost_usd, operation: str) -> None:
    # Real provider cost on the ledger (0 credits): never shown to users, used for unit economics.
    UsageTransaction.objects.create(user_id=change.project.owner_id, operation=operation, credits=0, cost_usd=cost_usd)
