"""Assumptions marked from survey results (Week 15, D3). Deterministic, no AI.

A survey question linked to an assumption, with the founder's rule for which answers support it (choice options, or a
minimum on the 1–5 scale), gives a share: supporting answers ÷ people who answered. With at least MIN_ANSWERS answers:
- supported when the whole 95% Wilson interval is above 50% ("most of the people you reached"),
- contradicted when the whole interval is below 50%,
- otherwise inconclusive.
Several questions on one assumption: supported only if some support and none contradict (and the reverse); a mix is
inconclusive, and questions with too few answers don't block the others. "Answers", not "people": the same email
counts once, but anonymous answers can't be told apart. A rule set or a question reworded after answers came in makes the
verdict advisory (it never sets the status). The verdict cites each question, survey and count. The founder's own
status always wins once they set it (`status_locked`); until then the status follows the verdict. Typed answers are never judged.
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
        return type(value) is int and value >= q["support_min"]  # not bool
    return None


def question_result(survey, q: dict, answers: list[dict], dates: list | None = None) -> dict | None:
    """The verdict of one linked question, or None if it has no supporting-answer rule. `dates` (when answers were
    given, same order as `answers`) records the window the verdict rests on, so the founder can see what moved it."""
    if _supports(q, 1 if q["type"] == "scale" else 0) is None:
        return None
    answered = [i for i, a in enumerate(answers) if a.get(q["id"]) is not None]
    values = [answers[i].get(q["id"]) for i in answered]
    when = sorted(dates[i] for i in answered) if dates else []
    n = len(values)
    k = sum(1 for v in values if _supports(q, v))
    interval = wilson(k, n)
    low, high = (round(interval[0], 4), round(interval[1], 4)) if interval else (None, None)
    if n < MIN_ANSWERS:
        verdict = "inconclusive"
        why = f"{n} answer{'s' if n != 1 else ''}, too few to judge (needs {MIN_ANSWERS})"
    else:
        verdict = "supported" if low > MAJORITY else "contradicted" if high < MAJORITY else "inconclusive"
        why = f"{k} of {n} answers were supporting ({k / n * 100:.0f}%; 95% range {low * 100:.0f}–{high * 100:.0f}%)"
    late = q["id"] in (survey.late_rules or [])
    ai = q.get("drafted_by") == "ai"
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
        "ai_drafted": ai,
        "first_answer_at": when[0].isoformat() if when else None,
        "last_answer_at": when[-1].isoformat() if when else None,
        "basis": f"“{q['prompt']}” in “{survey.title}”: {why}."
        + (" The question or its supporting answers changed after people had answered, so this is advisory only." if late else "")
        + (" The question was drafted by AI and kept by you." if ai else ""),
    }


def _dedupe(rows: list[tuple]) -> list[tuple]:
    """One answer per email: when someone left the same email twice, only their latest answer counts. Answers without an
    email can't be told apart (no cookies or IPs are stored); the public form limits how many come from one network."""
    seen: set[str] = set()
    out = []
    for answers, when, email_hash in sorted(rows, key=lambda r: r[1], reverse=True):
        if email_hash:
            if email_hash in seen:
                continue
            seen.add(email_hash)
        out.append((answers, when))
    return out


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
        rows = _dedupe(list(survey.responses.filter(expires_at__gt=now).values_list("answers", "submitted_at", "email_hash")))
        answers, dates = [r[0] for r in rows], [r[1] for r in rows]
        for q in linked:
            result = question_result(survey, q, answers, dates)
            if result:
                by_assumption.setdefault(q["assumption_id"], []).append(result)
    changed = 0
    with transaction.atomic():
        for a in Assumption.objects.select_for_update().filter(project=project, dismissed=False):
            results = by_assumption.get(a.id, [])
            auto = _combine(results) if results else ""
            basis = " ".join(r["basis"] for r in results)
            status = a.status
            # A late rule (chosen or reworded after answers came in) is shown but never sets the status by itself.
            advisory = any(r["late_rule"] for r in results)
            if not a.status_locked:
                status = auto if auto in DECISIVE and not advisory else Assumption.Status.UNTESTED
            if (a.auto_status, a.auto_basis, a.auto_refs, a.status) == (auto, basis, results, status):
                continue
            a.auto_status, a.auto_basis, a.auto_refs, a.status = auto, basis, results, status
            a.auto_at = now if results else None
            a.save(update_fields=["auto_status", "auto_basis", "auto_refs", "status", "auto_at", "updated_at"])
            changed += 1
    return changed
