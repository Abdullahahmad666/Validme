"""Serve Validation Lab pages only on their own origin (LAB_HOST), with strict headers and no cookies.

On LAB_HOST the request is routed to lab.public_urls (public pages only; no API, no admin, no auth). On every other host
those routes don't exist, so founder content is never served from the app's origin. Lab responses carry a CSP that
allows no scripts (except the optional Turnstile widget), a nonce for the page's own <style>, and no cookies at all.
"""

from __future__ import annotations

import secrets

from django.conf import settings
from django.http.request import split_domain_port


def _domain(host: str) -> str:
    """Host without port or trailing dot, lowercased: the same normalisation Django uses for ALLOWED_HOSTS."""
    domain, _port = split_domain_port((host or "").strip().lower())
    return domain.rstrip(".")


def is_lab_host(request) -> bool:
    """Any request whose Host names the pages domain (with any port, with or without a trailing dot) is a Lab
    request and only ever sees lab.public_urls. X-Forwarded-Host is ignored here on purpose."""
    lab = _domain(settings.LAB_HOST)
    return bool(lab) and _domain(request.META.get("HTTP_HOST", "")) == lab


TURNSTILE_ORIGIN = "https://challenges.cloudflare.com"


def csp(nonce: str) -> str:
    """No scripts at all unless the optional Turnstile widget is configured (then only it, by nonce + origin)."""
    if settings.TURNSTILE_SITE_KEY:
        scripts, frames = f"'nonce-{nonce}' {TURNSTILE_ORIGIN}", TURNSTILE_ORIGIN
    else:
        scripts, frames = "'none'", "'none'"
    return "; ".join(
        [
            "default-src 'none'",
            f"style-src 'nonce-{nonce}'",
            f"script-src {scripts}",
            f"frame-src {frames}",
            "img-src 'self' data:",
            "form-action 'self'",
            "base-uri 'none'",
            "frame-ancestors 'none'",
        ]
    )


class LabHostMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not is_lab_host(request):
            return self.get_response(request)
        request.urlconf = "lab.public_urls"
        request.csp_nonce = secrets.token_urlsafe(16)
        response = self.get_response(request)
        response["Content-Security-Policy"] = csp(request.csp_nonce)
        response["X-Robots-Tag"] = "noindex, nofollow"
        response["Referrer-Policy"] = "no-referrer"
        response["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
        response["Cross-Origin-Opener-Policy"] = "same-origin"
        response["Cross-Origin-Resource-Policy"] = "same-origin"
        response["X-Frame-Options"] = "DENY"
        response["Cache-Control"] = "no-store"
        # No cookies on the pages origin, whatever a middleware may have tried to set (session, CSRF, messages).
        for name in list(response.cookies.keys()):
            del response.cookies[name]
        return response
