"""Public surveys (LAB_HOST only, Week 14): /s/{slug} and its form post. Same guards as the waitlist: no JavaScript, no
cookies, a signed survey-bound form token (≥ 3 s, ≤ 2 h old), honeypot, hashed-IP rate limits only in the cache,
optional Turnstile. Typed answers and the optional email are encrypted; choices are stored as option numbers.

On a mistake the form is shown again with the person's answers kept (rendered from the POST, never stored)."""

from __future__ import annotations

import json
import time
from datetime import timedelta

from django.core import signing
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.db.models import F
from django.http import HttpResponseRedirect
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from lab import crypto
from lab.models import Survey, SurveyDailyStat, SurveyResponse
from lab.public import (
    BOT_UA,
    TOKEN_MAX_AGE,
    TOKEN_MIN_AGE,
    _hit,
    _ip_key,
    _not_found,
    _rate_limited,
    _turnstile_ok,
    base_context,
)
from lab.surveys import parse_answers

SURVEY_SALT = "lab.survey.v1"
SURVEY_CONSENT_VERSION = "lab-survey-consent-v1"
SURVEY_LIMIT = (500, 3600)  # answers per survey per hour, counted only for valid answers
CONSENT_TEMPLATE = (
    "I agree to share these answers with the person behind this survey. {brand} stores them, encrypts anything I type, "
    "never sells them, and deletes them after {days} days."
)
EMAIL_CLAUSE = (
    " If I leave my email, they can see it to contact me about this survey, and I can ask {brand} for a copy or "
    "deletion. Without an email my answers can't be traced back to me, so they can't be found later to delete."
)
ERRORS = {
    "required": "Please answer the questions marked as required.",
    "email": "That email address doesn't look right. Leave it empty if you'd rather not give one.",
    "consent": "Please tick the box to agree before sending.",
    "expired": "The form expired. Please check your answers and send again.",
    "busy": "Too many answers from here right now. Please try again later.",
    "check": "We couldn't confirm you're human. Please try again.",
}


def consent_text(survey: Survey) -> str:
    from django.conf import settings

    text = CONSENT_TEMPLATE.format(brand=settings.VALIDME_BRAND, days=survey.retention_days)
    return text + (EMAIL_CLAUSE.format(brand=settings.VALIDME_BRAND) if survey.ask_email else "")


def _token(survey: Survey) -> str:
    return signing.dumps({"s": survey.pk, "t": int(time.time())}, salt=SURVEY_SALT)


def _token_ok(raw: str, survey: Survey) -> bool:
    try:
        data = signing.loads(raw or "", salt=SURVEY_SALT, max_age=TOKEN_MAX_AGE)
    except signing.BadSignature:
        return False
    return isinstance(data, dict) and data.get("s") == survey.pk and time.time() - int(data.get("t", 0)) >= TOKEN_MIN_AGE


def _live(slug: str) -> Survey | None:
    return Survey.objects.filter(slug=slug, status__in=[Survey.Status.PUBLISHED, Survey.Status.CLOSED]).first()


def _bump(survey: Survey, field: str) -> None:
    today = timezone.localdate()
    SurveyDailyStat.objects.get_or_create(survey=survey, day=today)
    SurveyDailyStat.objects.filter(survey=survey, day=today).update(**{field: F(field) + 1})


def _render(request, survey: Survey, *, status: int = 200, **extra):
    questions = []
    values = extra.pop("values", None)
    for q in survey.questions:
        v = values.get(q["id"]) if values else None
        questions.append({**q, "value": v, "picked": set(v) if isinstance(v, list) else {v} if v is not None else set()})
    ctx = {
        **base_context(request, survey.slug or ""),
        "survey": survey,
        "questions": questions,
        "scale": range(1, 6),
        "token": _token(survey),
        "consent": consent_text(survey),
        "closed": survey.status == Survey.Status.CLOSED,
        **extra,
    }
    ctx["uses_form"] = not ctx["closed"] and not ctx.get("done")
    return render(request, "lab/survey.html", ctx, status=status)


@require_GET
def survey_view(request, slug: str):
    survey = _live(slug)
    if survey is None:
        return _not_found(request)
    done = request.GET.get("done") == "1"
    ua = (request.META.get("HTTP_USER_AGENT") or "").lower()
    if survey.status == Survey.Status.PUBLISHED and not done and ua and not any(b in ua for b in BOT_UA):
        if cache.add(f"lab:sv:{_ip_key(request)}:{survey.pk}:{timezone.localdate()}", 1, 86400):
            _bump(survey, "views")
    return _render(request, survey, done=done)


@csrf_exempt  # no cookies or sessions on this origin; protected by the signed, survey-bound form token instead
@require_POST
def answer(request, slug: str):
    survey = _live(slug)
    if survey is None:
        return _not_found(request)
    if survey.status != Survey.Status.PUBLISHED:
        return HttpResponseRedirect(f"/s/{survey.slug}", status=303)
    done = HttpResponseRedirect(f"/s/{survey.slug}?done=1", status=303)
    if request.POST.get("hp_extra"):  # honeypot: look successful, store nothing
        return done
    answers, texts, missing = parse_answers(survey.questions, request.POST)
    values = {**answers, **texts}
    email = (request.POST.get("email") or "").strip() if survey.ask_email else ""

    def again(code: str, field: str = ""):
        return _render(
            request, survey, status=400, values=values, email=email, error=ERRORS[code], error_field=field, missing=set(missing)
        )

    if not _token_ok(request.POST.get("token", ""), survey):
        return again("expired")
    if missing:
        return again("required")
    if email:
        try:
            if len(email) > 254 or not email.isascii():
                raise ValidationError("not allowed")
            validate_email(email)
        except ValidationError:
            return again("email", "email")
    if request.POST.get("consent") != "yes":
        return again("consent", "consent")
    if _rate_limited(request, f"s{survey.pk}"):  # counted once the answers are complete, so fixing a mistake is free
        return again("busy")
    if not _turnstile_ok(request):
        return again("check")
    if _hit(f"lab:rl:survey:{survey.pk}", *SURVEY_LIMIT):
        return again("busy")
    now = timezone.now()
    SurveyResponse.objects.create(
        survey=survey,
        answers=answers,
        text_encrypted=crypto.encrypt_text(json.dumps(texts)) if texts else "",
        email_encrypted=crypto.encrypt(email) if email else "",
        email_hash=crypto.email_hash(email) if email else "",
        consent_version=SURVEY_CONSENT_VERSION,
        submitted_at=now,
        expires_at=now + timedelta(days=survey.retention_days),
    )
    _bump(survey, "responses")
    if any(q.get("assumption_id") is not None for q in survey.questions):
        from lab.tasks import schedule_evaluation

        transaction.on_commit(lambda: schedule_evaluation(survey.project_id))
    return done
