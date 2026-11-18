"""Assumptions marked from survey results (Week 15, D3). Deterministic, no AI.

A survey question linked to an assumption, with the founder's rule for which answers support it (choice options, or a
minimum on the 1–5 scale), gives a share: supporting answers ÷ people who answered. With at least MIN_ANSWERS answers:
- supported when the whole 95% Wilson interval is above 50% ("most of the people you reached"),
- contradicted when the whole interval is below 50%,
- otherwise inconclusive.
Several questions on one assumption: supported only if some support and none contradict (and the reverse); a mix is
inconclusive. The verdict cites each question, survey and count. The founder's own status always wins once they set it
(`status_locked`); until then the status follows the verdict. Typed answers are never judged.
"""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from lab.experiments import wilson

MIN_ANSWERS = 10
MAJORITY = 0.5
DECISIVE = ("supported", "contradicted")


def _supports(q: dict, value) -> bool | None:
    """Does one answer support the assumption? None when the question has no rule."""
    if q["type"] in ("single", "multi") and q.get("support_options"):
        chosen = value if isinstance(value, list) else [value]
        return any(i in q["support_options"] for i in chosen)
    if q["type"] == "scale" and q.get("support_min") is not None:
        return isinstance(value, int) and value >= q["support_min"]
    return None


def question_result(survey, q: dict, answers: list[dict]) -> dict | None:
    """The verdict of one linked question, or None if it has no supporting-answer rule."""
    if _supports(q, 1 if q["type"] == "scale" else 0) is None:
        return None
    values = [a.get(q["id"]) for a in answers if a.get(q["id"]) is not None]
    n = len(values)
    k = sum(1 for v in values if _supports(q, v))
    interval = wilson(k, n)
    low, high = (round(interval[0], 4), round(interval[1], 4)) if interval else (None, None)
    if n < MIN_ANSWERS:
        verdict = "inconclusive"
        why = f"{n} answer{'s' if n != 1 else ''}, too few to judge (needs {MIN_ANSWERS})"
    else:
        verdict = "supported" if low > MAJORITY else "contradicted" if high < MAJORITY else "inconclusive"
        why = f"{k} of {n} gave a supporting answer ({k / n * 100:.0f}%; {low * 100:.0f}–{high * 100:.0f}% with 95% confidence)"
    late = q["id"] in (survey.late_rules or [])
    return {
        "survey_id": survey.id,
        "survey_title": survey.title,
        "question_id": q["id"],
        "prompt": q["prompt"],
        "n": n,
        "k": k,
        "low": low,
        "high": high,
        "verdict": verdict,
        "late_rule": late,
        "basis": f"“{q['prompt']}” in “{survey.title}”: {why}."
        + (" The supporting answers were chosen after people had answered." if late else ""),
    }


def _combine(results: list[dict]) -> str:
    verdicts = {r["verdict"] for r in results}
    if "supported" in verdicts and "contradicted" not in verdicts:
        return "supported"
    if "contradicted" in verdicts and "supported" not in verdicts:
        return "contradicted"
    return "inconclusive"


def evaluate_assumptions(project) -> int:
    """Recompute every assumption's experiment verdict for a project. Returns how many changed."""
    from lab.models import Survey
    from projects.models import Assumption

    now = timezone.now()
    by_assumption: dict[int, list[dict]] = {}
    for survey in Survey.objects.filter(project=project, published_at__isnull=False):
        linked = [q for q in survey.questions if q.get("assumption_id") is not None]
        if not linked:
            continue
        answers = list(survey.responses.filter(expires_at__gt=now).values_list("answers", flat=True))
        for q in linked:
            result = question_result(survey, q, answers)
            if result:
                by_assumption.setdefault(q["assumption_id"], []).append(result)
    changed = 0
    with transaction.atomic():
        for a in Assumption.objects.select_for_update().filter(project=project, dismissed=False):
            results = by_assumption.get(a.id, [])
            auto = _combine(results) if results else ""
            basis = " ".join(r["basis"] for r in results)
            status = a.status
            if not a.status_locked:
                status = auto if auto in DECISIVE else Assumption.Status.UNTESTED
            if (a.auto_status, a.auto_basis, a.auto_refs, a.status) == (auto, basis, results, status):
                continue
            a.auto_status, a.auto_basis, a.auto_refs, a.status = auto, basis, results, status
            a.auto_at = now if results else None
            a.save(update_fields=["auto_status", "auto_basis", "auto_refs", "status", "auto_at", "updated_at"])
            changed += 1
    return changed
