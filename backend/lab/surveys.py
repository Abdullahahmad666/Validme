"""Survey questions (Week 14): a fixed set of answer types with plain-text prompts and options, like page blocks.

Types: "single" (one option), "multi" (any options), "scale" (1–5 with two end labels), "text" (short free text, stored
encrypted). Each question has a stable id ("q1".."q99") so answers stay attached to it, and may name the founder's
assumption it tests (rule 2: the assumption stays the founder's; answers are a separate experiment result).
"""

from __future__ import annotations

import re

from jsonschema import Draft202012Validator

from lab.blocks import _LINKY, _strings, clean_blocks

QUESTION_TYPES = ("single", "multi", "scale", "text")
MAX_QUESTIONS = 12
MAX_TEXT_ANSWER = 1000
SCALE = (1, 5)
QID = re.compile(r"^q[1-9][0-9]?$")


def _t(max_len: int, min_len: int = 0) -> dict:
    return {"type": "string", "minLength": min_len, "maxLength": max_len}


_QUESTION = {
    "type": "object",
    "properties": {
        "id": {"type": "string", "pattern": QID.pattern},
        "type": {"enum": list(QUESTION_TYPES)},
        "prompt": _t(200, 1),
        "help": _t(200),
        "options": {"type": "array", "maxItems": 8, "items": _t(80, 1)},
        "low_label": _t(30),
        "high_label": _t(30),
        "required": {"type": "boolean"},
        "assumption_id": {"type": ["integer", "null"]},
    },
    "required": ["id", "type", "prompt"],
    "additionalProperties": False,
}
_VALIDATOR = Draft202012Validator({"type": "array", "maxItems": MAX_QUESTIONS, "items": _QUESTION})


def small_int(raw: str, max_digits: int = 3) -> int | None:
    """A form or query value as a small non-negative int. ASCII digits only: str.isdigit() also accepts characters like
    "²" that int() rejects, and huge digit strings are refused too."""
    raw = raw or ""
    return int(raw) if raw.isascii() and raw.isdigit() and len(raw) <= max_digits else None


def clean_questions(questions: list) -> list:
    return clean_blocks(questions)


def validate_questions(questions, assumption_ids: set[int] | None = None) -> list[str]:
    """Problems that make the questions unsavable. Empty list = valid."""
    from itertools import islice

    if not isinstance(questions, list) or len(questions) > MAX_QUESTIONS:
        return [f"A survey has at most {MAX_QUESTIONS} questions."]
    problems = []
    for err in sorted(islice(_VALIDATOR.iter_errors(questions), 5), key=lambda e: list(e.path)):
        where = ".".join(str(p) for p in err.path) or "questions"
        problems.append(f"{where}: {err.message[:120]}")
    if problems:
        return problems
    ids = [q["id"] for q in questions]
    if len(set(ids)) != len(ids):
        problems.append("Each question needs its own id.")
    for n, q in enumerate(questions, 1):
        opts = q.get("options") or []
        if q["type"] in ("single", "multi") and len(opts) < 2:
            problems.append(f"Question {n}: give at least two options.")
        if q["type"] in ("single", "multi") and len({o.lower() for o in opts}) != len(opts):
            problems.append(f"Question {n}: options must differ.")
        if q["type"] not in ("single", "multi") and opts:
            problems.append(f"Question {n}: only choice questions have options.")
        if assumption_ids is not None and q.get("assumption_id") is not None and q["assumption_id"] not in assumption_ids:
            problems.append(f"Question {n}: that assumption isn't in this project.")
    for text in _strings([{k: v for k, v in q.items() if k not in ("id", "type")} for q in questions]):
        if _LINKY.search(text):
            problems.append("Links, web addresses and e-mail addresses aren't allowed in questions.")
            break
    return problems


def publish_problems(survey) -> list[str]:
    problems = validate_questions(survey.questions)
    if not survey.questions:
        problems.append("Add at least one question.")
    if not survey.title.strip():
        problems.append("Give the survey a title.")
    if survey.slug is None:
        problems.append("Choose a web address for the survey.")
    return problems


def structure(questions: list) -> list:
    """What answers depend on (ids, types, options). Wording can be fixed later; this can't once answers exist."""
    return [(q.get("id"), q.get("type"), [o.lower() for o in q.get("options") or []]) for q in questions or []]


def parse_answers(questions: list, post) -> tuple[dict, dict, list[str]]:
    """Read a submitted form. Returns (choice/scale answers, typed answers, ids of required questions left empty).
    Anything not offered (an option index out of range, a scale value outside 1–5) is ignored, never stored."""
    answers: dict = {}
    texts: dict = {}
    missing: list[str] = []
    for q in questions:
        qid, kind = q["id"], q["type"]
        n_opts = len(q.get("options") or [])
        value: object = None
        if kind == "single":
            n = small_int(post.get(qid, ""))
            value = n if n is not None and n < n_opts else None
        elif kind == "multi":
            picked = {n for n in (small_int(v) for v in post.getlist(qid)[:n_opts]) if n is not None and n < n_opts}
            value = sorted(picked) or None
        elif kind == "scale":
            n = small_int(post.get(qid, ""))
            value = n if n is not None and SCALE[0] <= n <= SCALE[1] else None
        elif kind == "text":
            text = clean_blocks((post.get(qid) or "")[:MAX_TEXT_ANSWER])
            if text:
                texts[qid] = text
            value = text or None
        if value is None and q.get("required"):
            missing.append(qid)
        if kind != "text":
            answers[qid] = value
    return answers, texts, missing


# --- sample size ------------------------------------------------------------------------------------------------


def margin_of_error(n: int) -> float | None:
    """Worst-case 95% margin of error for a share measured on n people (±, as a fraction). None without data."""
    if n <= 0:
        return None
    return round(1.96 * (0.25 / n) ** 0.5, 4)


def sample_note(n: int, unit: str = "answers") -> dict:
    """How much a number based on n people can say. Thresholds are deliberately conservative."""
    moe = margin_of_error(n)
    if n == 0:
        return {"n": 0, "level": "none", "margin": None, "message": f"No {unit} yet."}
    if n < 10:
        msg = f"Only {n} {unit}: far too few to read anything into. Treat each one as a conversation, not a statistic."
        return {"n": n, "level": "too_small", "margin": moe, "message": msg}
    if n < 30:
        msg = f"{n} {unit}: early hints only. Shares could be off by up to ±{round(moe * 100)} points."
        return {"n": n, "level": "small", "margin": moe, "message": msg}
    msg = f"{n} {unit}. Shares could be off by up to ±{round(moe * 100)} points, and only reflect who you reached."
    return {"n": n, "level": "ok", "margin": moe, "message": msg}


def compare_rates(a: tuple[int, int], b: tuple[int, int], min_n: int = 100) -> dict:
    """Two-proportion z-test of successes/trials. Says "can't tell yet" unless both groups have min_n trials and the
    difference is clear at the 95% level. Returns {verdict, z}; verdict in "not_enough_data" | "no_clear_difference" |
    "a_higher" | "b_higher"."""
    (sa, na), (sb, nb) = a, b
    if na < min_n or nb < min_n:
        return {"verdict": "not_enough_data", "z": None}
    pooled = (sa + sb) / (na + nb)
    se = (pooled * (1 - pooled) * (1 / na + 1 / nb)) ** 0.5
    if se == 0:
        return {"verdict": "no_clear_difference", "z": 0.0}
    z = (sa / na - sb / nb) / se
    if abs(z) < 1.96:
        return {"verdict": "no_clear_difference", "z": round(z, 2)}
    return {"verdict": "a_higher" if z > 0 else "b_higher", "z": round(z, 2)}
