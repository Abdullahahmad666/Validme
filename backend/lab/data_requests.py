"""Respondent data requests (LAB_HOST only, Week 14): /data-request and /data-request/confirm.

A person enters their email and picks "send me a copy" or "delete everything". The answer on screen is always the same
("if we hold anything, we've emailed you"), and the email is sent from a background task whether or not anything
matches, so neither the page nor its timing reveals whether an address is on a waitlist. The emailed link is signed,
bound to the address's keyed hash and the request kind, and valid for 24 hours. Opening it shows a confirm button
(a POST), so mail scanners that follow links can't delete anything.

What's covered: waitlist sign-ups and survey responses that carry this email. Survey answers given without an email
can't be linked to anyone, which the survey's consent text says. Founders are told (DataRequestNotice) when a deletion
removes something from their project, so they can also delete any CSV they exported.
"""

from __future__ import annotations

import json
import time

from django.conf import settings
from django.core import signing
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.db import transaction
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from lab import crypto
from lab.models import DataRequest, DataRequestNotice, SurveyResponse, WaitlistSignup
from lab.public import TOKEN_MAX_AGE, TOKEN_MIN_AGE, _hit, _ip_key, base_context

FORM_SALT = "lab.dr.form.v1"
LINK_SALT = "lab.dr.link.v1"
LINK_MAX_AGE = 24 * 3600
KINDS = {"copy": "a copy of", "delete": "deletion of"}
LIMITS = ((5, 3600),)  # per hashed client address
PER_ADDRESS = 3600  # at most one email per address per hour, so the form can't be used to flood someone's inbox


def _form_token() -> str:
    return signing.dumps({"t": int(time.time())}, salt=FORM_SALT)


def _form_token_ok(raw: str) -> bool:
    try:
        data = signing.loads(raw or "", salt=FORM_SALT, max_age=TOKEN_MAX_AGE)
    except signing.BadSignature:
        return False
    return isinstance(data, dict) and time.time() - int(data.get("t", 0)) >= TOKEN_MIN_AGE


def link_token(email_hash: str, kind: str) -> str:
    return signing.dumps({"h": email_hash, "k": kind}, salt=LINK_SALT)


def _link_data(raw: str) -> dict | None:
    try:
        data = signing.loads(raw or "", salt=LINK_SALT, max_age=LINK_MAX_AGE)
    except signing.BadSignature:
        return None
    if not isinstance(data, dict) or data.get("k") not in KINDS or not isinstance(data.get("h"), str):
        return None
    return data


def _held(email_hash: str):
    now = timezone.now()
    signups = WaitlistSignup.objects.filter(email_hash=email_hash, expires_at__gt=now).select_related("page__project")
    responses = SurveyResponse.objects.filter(email_hash=email_hash, expires_at__gt=now).select_related("survey__project")
    return signups, responses


def send_link(encrypted_email: str, kind: str) -> bool:
    """Called from the background task. Emails the confirm link only when something is held for the address."""
    email = crypto.decrypt(encrypted_email)
    if not email or kind not in KINDS:
        return False
    h = crypto.email_hash(email)
    signups, responses = _held(h)
    if not signups.exists() and not responses.exists():
        return False
    link = f"{settings.LAB_ORIGIN.rstrip('/')}/data-request/confirm?t={link_token(h, kind)}"
    brand = settings.VALIDME_BRAND
    body = (
        f"Someone (hopefully you) asked {brand} for {KINDS[kind]} what founders' test pages and surveys hold for this "
        f"email address.\n\nTo confirm, open this link within 24 hours:\n{link}\n\n"
        "If it wasn't you, ignore this email: nothing happens without the link.\n"
    )
    send_mail(f"Confirm your data request ({brand})", body, settings.DEFAULT_FROM_EMAIL, [email])
    return True


def _render(request, template: str, status: int = 200, **extra):
    return render(request, template, {**base_context(request), **extra}, status=status)


@csrf_exempt  # no cookies or sessions on this origin; protected by the signed form token
@require_http_methods(["GET", "POST"])
def request_form(request):
    if request.method == "GET":
        return _render(request, "lab/data_request.html", token=_form_token())
    kind = request.POST.get("kind", "")
    email = (request.POST.get("email") or "").strip()
    sent = _render(request, "lab/data_request.html", sent=True)

    def again(message: str, field: str = ""):
        return _render(
            request, "lab/data_request.html", status=400, token=_form_token(), error=message, error_field=field, email=email, kind=kind
        )

    if request.POST.get("hp_extra"):
        return sent
    if not _form_token_ok(request.POST.get("token", "")):
        return again("The form expired. Please try again.")
    if any(_hit(f"lab:dr:{_ip_key(request)}", n, sec) for n, sec in LIMITS):
        return again("Too many requests from here right now. Please try again later.")
    if kind not in KINDS:
        return again("Choose whether you want a copy or deletion.", "kind")
    try:
        if len(email) > 254 or not email.isascii():
            raise ValidationError("not allowed")
        validate_email(email)
    except ValidationError:
        return again("Please enter a valid email address.", "email")
    if cache.add(f"lab:dr:addr:{crypto.email_hash(email)}", 1, PER_ADDRESS):
        from lab.tasks import send_data_request_link

        # Always queued (match or not) and only encrypted in the queue: same response and timing either way.
        send_data_request_link.delay(crypto.encrypt(email), kind)
    return sent


@csrf_exempt  # the signed link token is the credential; GET only shows a confirm button
@require_http_methods(["GET", "POST"])
def confirm(request):
    raw = request.POST.get("t") if request.method == "POST" else request.GET.get("t")
    data = _link_data(raw or "")
    if data is None:
        return _render(request, "lab/data_request_done.html", status=400, invalid=True)
    kind, h = data["k"], data["h"]
    if request.method == "GET":
        return _render(request, "lab/data_request_done.html", confirm=True, kind=kind, token=raw)
    signups, responses = _held(h)
    if kind == "copy":
        items = [
            {"what": "Waitlist sign-up", "where": s.page.title, "when": s.consented_at, "until": s.expires_at, "answers": []}
            for s in signups
        ]
        for r in responses:
            typed = json.loads(crypto.decrypt(r.text_encrypted) or "{}") if r.text_encrypted else {}
            items.append(
                {
                    "what": "Survey answers",
                    "where": r.survey.title,
                    "when": r.submitted_at,
                    "until": r.expires_at,
                    "answers": _readable(r, typed),
                }
            )
        DataRequest.objects.create(kind=DataRequest.Kind.COPY, signups=len(signups), responses=len(responses))
        return _render(request, "lab/data_request_done.html", copy=True, items=items)
    with transaction.atomic():
        notices: dict[tuple[int, str], int] = {}
        for s in signups:
            key = (s.page.project_id, s.page.title)
            notices[key] = notices.get(key, 0) + 1
        for r in responses:
            key = (r.survey.project_id, r.survey.title)
            notices[key] = notices.get(key, 0) + 1
        n_signups, _ = WaitlistSignup.objects.filter(pk__in=[s.pk for s in signups]).delete()
        n_responses, _ = SurveyResponse.objects.filter(pk__in=[r.pk for r in responses]).delete()
        DataRequestNotice.objects.bulk_create(
            DataRequestNotice(project_id=pid, source=title[:80], removed=n) for (pid, title), n in notices.items()
        )
        DataRequest.objects.create(kind=DataRequest.Kind.DELETE, signups=n_signups, responses=n_responses)
    return _render(request, "lab/data_request_done.html", deleted=n_signups + n_responses)


def _readable(response: SurveyResponse, typed: dict) -> list[dict]:
    """Answers as the person saw them: question wording and the chosen option text."""
    out = []
    for q in response.survey.questions:
        qid, opts = q["id"], q.get("options") or []
        v = typed.get(qid) if q["type"] == "text" else response.answers.get(qid)
        if v is None:
            shown = "(no answer)"
        elif q["type"] == "single":
            shown = opts[v] if isinstance(v, int) and v < len(opts) else "(no answer)"
        elif q["type"] == "multi":
            shown = ", ".join(opts[i] for i in v if isinstance(i, int) and i < len(opts)) or "(no answer)"
        else:
            shown = str(v)
        out.append({"q": q["prompt"], "a": shown})
    return out
