"""Public Validation Lab pages (LAB_HOST only): server-rendered, autoescaped, no JavaScript, no cookies.

The waitlist form is a plain HTML POST. Instead of a CSRF cookie (there are no sessions on this origin) it carries a
signed, page-bound form token that must be at least a few seconds old (bots post instantly) and at most two hours old.
Spam and abuse guards: honeypot field, per-IP / per-page rate limits (IP only hashed, only in the cache), optional
Turnstile, and duplicate addresses answered exactly like new ones (no way to test whether someone signed up).
"""

from __future__ import annotations

import hashlib
import logging
import time
from datetime import timedelta

import httpx
from django.conf import settings
from django.core import signing
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.db.models import F
from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST
from rest_framework.throttling import BaseThrottle

from lab import crypto
from lab.blocks import price_test
from lab.models import LabDailyStat, LabPage, LabVariantStat, WaitlistSignup
from lab.surveys import small_int

logger = logging.getLogger(__name__)

TOKEN_SALT = "lab.form.v1"
TOKEN_MAX_AGE = 2 * 3600
TOKEN_MIN_AGE = 3  # seconds: humans need longer than this to read and type
CONSENT_VERSION = "lab-consent-v2"
LIMITS = (  # (scope, max, seconds): per client, counted on every attempt
    ("ip-page", 5, 3600),
    ("ip", 20, 3600),
)
PAGE_LIMIT = (300, 3600)  # per page, counted only for valid sign-ups (so junk can't lock real visitors out)
BOT_UA = ("bot", "crawler", "spider", "preview", "slurp", "facebookexternalhit", "headless")
ERRORS = {
    "email": "Please enter a valid email address.",
    "consent": "Please tick the box to agree before joining.",
    "expired": "The form expired. Please try again.",
    "busy": "Too many sign-ups from here right now. Please try again later.",
    "check": "We couldn't confirm you're human. Please try again.",
}


def _ip_key(request) -> str:
    """Hashed client address for cache keys only (never stored). IPv6 is bucketed by /64: one subscriber usually has a
    whole /64, so per-address limits would otherwise be unlimited."""
    import ipaddress

    ip = BaseThrottle().get_ident(request) or ""
    try:
        addr = ipaddress.ip_address(ip)
        if addr.version == 6:
            ip = str(ipaddress.ip_network(f"{addr}/64", strict=False))
    except ValueError:
        pass
    return hashlib.sha256(f"{settings.SECRET_KEY}|{ip}".encode()).hexdigest()[:32]


def _published(slug: str) -> LabPage | None:
    return LabPage.objects.filter(slug=slug, status=LabPage.Status.PUBLISHED).select_related("project").first()


def _bump(page: LabPage, field: str) -> None:
    today = timezone.localdate()
    LabDailyStat.objects.get_or_create(page=page, day=today)
    LabDailyStat.objects.filter(page=page, day=today).update(**{field: F(field) + 1})


def _token(page: LabPage, variant: int | None = None, test_key: str = "") -> str:
    data = {"p": page.pk, "t": int(time.time())}
    if variant is not None:
        data["v"] = variant  # signed, so a sign-up is counted for the price the person actually saw
        data["k"] = test_key  # ...in the version of the test they saw
    return signing.dumps(data, salt=TOKEN_SALT)


def _token_data(raw: str, page: LabPage, *, min_age: int = TOKEN_MIN_AGE) -> dict | None:
    try:
        data = signing.loads(raw or "", salt=TOKEN_SALT, max_age=TOKEN_MAX_AGE)
    except signing.BadSignature:
        return None
    if not isinstance(data, dict) or data.get("p") != page.pk or time.time() - int(data.get("t", 0)) < min_age:
        return None
    return data


def _token_ok(raw: str, page: LabPage) -> bool:
    return _token_data(raw, page) is not None


def _variant_for(request, page: LabPage, n: int) -> int:
    """Which price variant this visitor sees, without cookies: from the hashed client address (kept only in memory),
    the page and the day. Reloads show the same prices; another network or another day may show another variant."""
    digest = hashlib.sha256(f"{_ip_key(request)}|{page.pk}|{timezone.localdate()}".encode()).digest()
    return int.from_bytes(digest[:8], "big") % n


def _bump_variant(page: LabPage, test_key: str, variant: int, field: str) -> None:
    today = timezone.localdate()
    LabVariantStat.objects.get_or_create(page=page, test_key=test_key, variant=variant, day=today)
    LabVariantStat.objects.filter(page=page, test_key=test_key, variant=variant, day=today).update(**{field: F(field) + 1})


def _seen_variant(token: dict, test: dict | None) -> int | None:
    """The variant a signed token says was shown, if it belongs to the current version of the test."""
    v = token.get("v")
    if test is None or not isinstance(v, int) or not 0 <= v < len(test["variants"]) or token.get("k") != test["key"]:
        return None
    return v


def _with_variant(blocks: list, test: dict | None, variant: int | None) -> list:
    """The page's blocks with the price-test block showing one variant's prices (and no variant data leaked)."""
    if test is None or variant is None:
        return blocks
    out = list(blocks)
    shown = {k: v for k, v in out[test["index"]].items() if k != "test_variants"}
    shown["items"] = test["variants"][variant]
    shown["choosable"] = True
    out[test["index"]] = shown
    return out


def _hit(key: str, limit: int, seconds: int) -> bool:
    cache.add(key, 0, seconds)
    try:
        n = cache.incr(key)
    except ValueError:  # expired between add and incr
        cache.add(key, 1, seconds)
        n = 1
    return n > limit


def _rate_limited(request, page: LabPage | str) -> bool:
    """Per client per page/survey, and per client overall. `page` is a page, or a key such as "s12" for a survey."""
    ip = _ip_key(request)
    scope = page if isinstance(page, str) else page.pk
    keys = {"ip-page": f"lab:rl:{ip}:{scope}", "ip": f"lab:rl:{ip}"}
    return any(_hit(keys[scope], limit, seconds) for scope, limit, seconds in LIMITS)


def _turnstile_ok(request) -> bool:
    if not settings.TURNSTILE_SECRET_KEY:
        return True
    token = request.POST.get("cf-turnstile-response", "")
    if not token:
        return False
    try:
        resp = httpx.post(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            data={"secret": settings.TURNSTILE_SECRET_KEY, "response": token[:2048]},
            timeout=5,
            trust_env=False,
        )
        return bool(resp.json().get("success"))
    except (httpx.HTTPError, ValueError):
        logger.warning("turnstile verification unavailable")
        return False


CONSENT_TEMPLATE = (
    "I'd like to hear about this product. The person behind this page can see and download my email to tell me "
    "about it. {brand} stores it encrypted, never sells it, and deletes its copy after {days} days or sooner if I ask."
)


def consent_text(retention_days: int) -> str:
    return CONSENT_TEMPLATE.format(brand=settings.VALIDME_BRAND, days=retention_days)


FOOTER_TEXT = (
    "This is an early test page made by an independent founder with {brand}. The product may not exist yet, and "
    "nothing here is sold. {brand} doesn't vouch for the founder or the product."
)


def footer_text() -> str:
    return FOOTER_TEXT.format(brand=settings.VALIDME_BRAND)


def deletion_link(_page=None) -> str:
    """Where a respondent asks for a copy or deletion of their data: the self-serve form on this origin (Week 14)."""
    return "/data-request"


def base_context(request, slug: str = "") -> dict:
    """What every page on this origin needs: nonce, footer, privacy / data-request / report links."""
    app = settings.FRONTEND_URL.rstrip("/")
    subject = f"Report%20{slug}" if slug else "Report%20a%20page"
    return {
        "nonce": getattr(request, "csp_nonce", ""),
        "footer": footer_text(),
        "brand": settings.VALIDME_BRAND,
        "privacy_url": f"{app}/privacy",
        "delete_url": deletion_link(),
        "report_url": f"mailto:{settings.CONTACT_EMAIL}?subject={subject}" if settings.CONTACT_EMAIL else f"{app}/contact",
        "turnstile_site_key": settings.TURNSTILE_SITE_KEY,
    }


def _context(request, page: LabPage, *, variant: int | None = None, **extra) -> dict:
    test = price_test(page.blocks)
    return {
        **base_context(request, page.slug or ""),
        "page": page,
        "blocks": _with_variant(page.blocks, test, variant),
        "token": _token(page, variant, test["key"] if test else ""),
        "consent": consent_text(page.retention_days),
        "uses_form": True,
        **extra,
    }


def _not_found(request):
    return render(request, "lab/not_found.html", {"nonce": getattr(request, "csp_nonce", "")}, status=404)


@require_GET
def page_view(request, slug: str):
    page = _published(slug)
    if page is None:
        return _not_found(request)
    joined = request.GET.get("joined") == "1"
    code = request.GET.get("error", "")
    error = ERRORS.get(code, "")
    test = price_test(page.blocks)
    variant = _variant_for(request, page, len(test["variants"])) if test else None
    picked = None
    pick = small_int(request.GET.get("picked", ""))
    if test and pick is not None and pick < len(test["variants"][variant]):
        picked = test["variants"][variant][pick].get("name")
    ua = (request.META.get("HTTP_USER_AGENT") or "").lower()
    if not joined and not error and picked is None and ua and not any(b in ua for b in BOT_UA):
        # First-party count only: no cookie, no stored IP, no visitor id. One view per client per page per day (the
        # hashed address lives only in the cache), so reloads and scripted hits don't inflate the numbers.
        if cache.add(f"lab:v:{_ip_key(request)}:{page.pk}:{timezone.localdate()}", 1, 86400):
            _bump(page, "views")
            if variant is not None:
                _bump_variant(page, test["key"], variant, "views")
    # Which field the error is about, so the form can mark it (aria-invalid) and point to the message.
    field = {"email": "email", "consent": "consent"}.get(code, "") if error else ""
    ctx = _context(request, page, variant=variant, joined=joined, error=error, error_field=field, picked=picked)
    return render(request, "lab/page.html", ctx)


@csrf_exempt  # no cookies on this origin; the signed, page-bound token says which variant the person saw
@require_POST
def choose(request, slug: str):
    """A visitor pressed "Choose" on a price being tested. Counted once per client per variant per day, then sent to the
    waitlist with an honest note: it isn't available and nothing is charged."""
    page = _published(slug)
    if page is None:
        return _not_found(request)
    back = f"/p/{page.slug}"
    test = price_test(page.blocks)
    data = _token_data(request.POST.get("token", ""), page, min_age=1)
    option = small_int(request.POST.get("option", ""))
    variant = _seen_variant(data, test) if data is not None else None
    if variant is None:
        return HttpResponseRedirect(f"{back}#join", status=303)
    if option is None or option >= len(test["variants"][variant]):
        return HttpResponseRedirect(f"{back}#join", status=303)
    ua = (request.META.get("HTTP_USER_AGENT") or "").lower()
    once = f"lab:c:{_ip_key(request)}:{page.pk}:{variant}:{timezone.localdate()}"
    if ua and not any(b in ua for b in BOT_UA) and cache.add(once, 1, 86400):
        _bump_variant(page, test["key"], variant, "clicks")
    return HttpResponseRedirect(f"{back}?picked={option}#join", status=303)


@csrf_exempt  # no cookies or sessions on this origin; protected by the signed, page-bound form token instead
@require_POST
def join(request, slug: str):
    page = _published(slug)
    if page is None:
        return _not_found(request)
    back = f"/p/{page.slug}"
    if request.POST.get("hp_extra"):  # honeypot: invisible to people, filled by bots. Look successful, store nothing.
        return HttpResponseRedirect(f"{back}?joined=1#join", status=303)
    token = _token_data(request.POST.get("token", ""), page)
    if token is None:
        return HttpResponseRedirect(f"{back}?error=expired#join", status=303)
    test = price_test(page.blocks)
    variant = _seen_variant(token, test)
    if _rate_limited(request, page):
        return HttpResponseRedirect(f"{back}?error=busy#join", status=303)
    email = (request.POST.get("email") or "").strip()
    try:
        if len(email) > 254 or not email.isascii():  # no look-alike or bidi characters in stored addresses
            raise ValidationError("not allowed")
        validate_email(email)
    except ValidationError:
        return HttpResponseRedirect(f"{back}?error=email#join", status=303)
    if request.POST.get("consent") != "yes":
        return HttpResponseRedirect(f"{back}?error=consent#join", status=303)
    if not _turnstile_ok(request):
        return HttpResponseRedirect(f"{back}?error=check#join", status=303)
    if _hit(f"lab:rl:page:{page.pk}", *PAGE_LIMIT):
        return HttpResponseRedirect(f"{back}?error=busy#join", status=303)
    now = timezone.now()
    try:
        with transaction.atomic():
            WaitlistSignup.objects.create(
                page=page,
                email_encrypted=crypto.encrypt(email),
                email_hash=crypto.email_hash(email),
                consent_version=CONSENT_VERSION,
                consented_at=now,
                expires_at=now + timedelta(days=page.retention_days),
                variant=variant,
            )
        _bump(page, "signups")
        if variant is not None:
            _bump_variant(page, test["key"], variant, "signups")
    except IntegrityError:
        pass  # already on the list: same answer as a new sign-up, so nobody can test whether an address joined
    return HttpResponseRedirect(f"{back}?joined=1#join", status=303)


def robots(_request):
    return HttpResponse("User-agent: *\nDisallow: /\n", content_type="text/plain")


def root(request, exception=None):  # also the 404 handler for this URL map
    return _not_found(request)
