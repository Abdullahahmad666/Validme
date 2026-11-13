"""Weekly market digest: what changed on the pages you watch and which new competitors appeared.

Every item links to its evidence (the change in the app, the competitor's page). Built from stored data only:
no AI calls here (summaries were made when the change was detected). Sent at most once per user per ISO week.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from urllib.parse import urlsplit

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import IntegrityError, transaction
from django.template.loader import render_to_string
from django.utils import timezone

from mailer.models import DigestLog, EmailPreference
from mailer.tokens import unsubscribe_token

logger = logging.getLogger(__name__)
MAX_CHANGES = 15
MAX_CANDIDATES = 10
SIGNIFICANCE_ORDER = {"high": 0, "medium": 1, "low": 2}


def period_for(now=None) -> str:
    y, w, _ = (now or timezone.now()).isocalendar()
    return f"{y}-W{w:02d}"


def _safe_url(url: str) -> str:
    """Only http(s) links go into an email."""
    return url if urlsplit(url).scheme in ("http", "https") else ""


def build_digest(user, now=None) -> dict | None:
    """The digest content for one user, or None when there's nothing worth sending."""
    from monitoring.models import Change, CompetitorCandidate

    now = now or timezone.now()
    since = now - timedelta(days=7)
    app = settings.FRONTEND_URL.rstrip("/")
    changes = list(
        Change.objects.filter(project__owner=user, detected_at__gte=since, significance__in=("high", "medium"))
        .select_related("watch", "project")
        .defer("before__text", "after__text")
        .order_by("-detected_at")[:200]
    )
    changes.sort(key=lambda c: (SIGNIFICANCE_ORDER.get(c.significance, 3), -c.detected_at.timestamp()))
    candidates = list(
        CompetitorCandidate.objects.filter(project__owner=user, status="new", found_at__gte=since)
        .select_related("project")
        .order_by("-found_at")[:MAX_CANDIDATES]
    )
    if not changes and not candidates:
        return None
    return {
        "app_url": app,
        "period": period_for(now),
        "changes_total": len(changes),
        "changes": [
            {
                "label": c.watch.label or c.watch.url,
                "project": c.project.name,
                "significance": c.significance,
                "summary": c.summary,
                "ai_summary": c.ai_summary,
                "detected_at": c.detected_at,
                "prices_added": (c.details or {}).get("prices_added", [])[:5],
                "prices_removed": (c.details or {}).get("prices_removed", [])[:5],
                "link": f"{app}/projects/{c.project_id}/monitoring?change={c.pk}",
                "page": _safe_url(c.watch.url),
            }
            for c in changes[:MAX_CHANGES]
        ],
        "candidates": [
            {
                "name": k.name,
                "domain": k.domain,
                "project": k.project.name,
                "url": _safe_url(k.url),
                "source_url": _safe_url(k.source_url),
                "link": f"{app}/projects/{k.project_id}/monitoring#candidates",
            }
            for k in candidates
        ],
    }


def send_digest(user, *, now=None, dry_run: bool = False) -> str:
    """Send this week's digest once. Returns the resulting status (or the would-be status for a dry run)."""
    now = now or timezone.now()
    pref = EmailPreference.objects.filter(user=user).first()
    if pref and (not pref.weekly_digest or pref.bounced) or not user.email or not user.is_active:
        return DigestLog.Status.SKIPPED
    if not _verified(user, user.email).exists():
        return DigestLog.Status.SKIPPED
    content = build_digest(user, now)
    if content is None:
        return DigestLog.Status.SKIPPED
    if dry_run:
        return "would_send"
    period = period_for(now)
    try:
        with transaction.atomic():
            log = DigestLog.objects.create(user=user, period=period, items=len(content["changes"]) + len(content["candidates"]))
    except IntegrityError:
        return "already_sent"  # another worker (or a retry) owns this week's send

    token = unsubscribe_token(user.pk)
    # Through the app's own origin (/api is proxied to Django), so the link works wherever the app is hosted.
    unsubscribe = f"{content['app_url']}/api/email/unsubscribe?token={token}"
    ctx = {
        **content,
        "unsubscribe_url": unsubscribe,
        "settings_url": f"{content['app_url']}/settings",
        "brand": settings.VALIDME_BRAND,
    }
    count = content["changes_total"]
    subject = (
        f"{settings.VALIDME_BRAND} weekly: {count} competitor change{'s' if count != 1 else ''}"
        if count
        else f"{settings.VALIDME_BRAND} weekly: new competitors to review"
    )
    msg = EmailMultiAlternatives(
        subject=subject,
        body=render_to_string("mailer/digest.txt", ctx),
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user.email],
        headers={
            # One-click unsubscribe (RFC 8058): mail apps show their own unsubscribe button.
            "List-Unsubscribe": f"<{unsubscribe}>",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
    )
    msg.attach_alternative(render_to_string("mailer/digest.html", ctx), "text/html")
    try:
        msg.send(fail_silently=False)
    except Exception as exc:  # noqa: BLE001 - provider/SMTP errors vary; record and move on
        logger.warning("digest send failed for user %s: %s", user.pk, type(exc).__name__)
        log.status, log.detail = DigestLog.Status.FAILED, type(exc).__name__[:200]
        log.save(update_fields=["status", "detail"])
        return log.status
    log.status = DigestLog.Status.SENT
    log.save(update_fields=["status"])
    return log.status


def recipients():
    """Active users with at least one watch, digest not turned off, address not bounced."""
    from django.contrib.auth import get_user_model
    from django.db.models import Exists, OuterRef, Q

    from monitoring.models import Watch

    off = EmailPreference.objects.filter(user=OuterRef("pk")).filter(Q(weekly_digest=False) | Q(bounced=True))
    return (
        get_user_model()
        .objects.filter(is_active=True)
        .filter(Exists(Watch.objects.filter(project__owner=OuterRef("pk"))))
        .filter(Exists(_verified(OuterRef("pk"), OuterRef("email"))))
        .exclude(Exists(off))
    )


def _verified(user, email):
    """Only addresses the owner has confirmed: a stranger signing up with someone's address can't mail them."""
    from allauth.account.models import EmailAddress

    return EmailAddress.objects.filter(user=user, email__iexact=email, verified=True)
