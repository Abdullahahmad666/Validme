"""Monitoring engine: claim due watches, check them politely, store only what changed.

Runs the same way locally (`manage.py monitor`) and in production (Celery beat → tasks).
"""

from __future__ import annotations

import hashlib
import logging
import random
import uuid
from datetime import timedelta
from urllib.parse import urlsplit

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from monitoring.diff import diff_pages
from monitoring.models import Change, Observation, Watch
from research.providers.base import redact
from research.providers.fetch import BlockedURL, FetchError, check_url, extract_blocks, fetch_public_page

logger = logging.getLogger(__name__)

CADENCE = {"daily": timedelta(days=1), "weekly": timedelta(days=7)}
MAX_TEXT = 20000


def next_run(cadence: str, now=None):
    """Next check time, with up to 10% jitter so watches created together don't fire together."""
    base = CADENCE.get(cadence, CADENCE["weekly"])
    return (now or timezone.now()) + base + timedelta(seconds=random.uniform(0, base.total_seconds() * 0.1))


def effective_cadence(watch: Watch) -> str:
    """The plan decides how often a watch may run: a downgraded account's daily watch runs weekly."""
    from billing.plans import monitoring_limits

    allowed = monitoring_limits(watch.project.owner)["cadences"]
    return watch.cadence if watch.cadence in allowed else allowed[-1]


def claim_due(limit: int | None = None) -> tuple[list[int], str]:
    """Lease up to `limit` due watches; returns (ids, lease token).

    skip_locked lets several schedulers claim in parallel without overlap. At most one watch per host is
    claimed per cycle, so a popular host can't fill the batch with deferrals. The lease (next_run_at moved
    forward + a token) means a crashed check is retried later, and a stale or duplicate task can't run it twice.
    """
    limit = limit or settings.MONITORING_BATCH_SIZE
    now = timezone.now()
    token = uuid.uuid4().hex
    with transaction.atomic():
        candidates = (
            Watch.objects.select_for_update(skip_locked=True)
            .filter(active=True, next_run_at__lte=now)
            .order_by("next_run_at")
            .values_list("id", "url")[: limit * 3]
        )
        ids: list[int] = []
        hosts: set[str] = set()
        for watch_id, url in candidates:
            host = (urlsplit(url).hostname or "").lower()
            if host in hosts:
                continue
            hosts.add(host)
            ids.append(watch_id)
            if len(ids) >= limit:
                break
        if ids:
            Watch.objects.filter(pk__in=ids).update(
                next_run_at=now + timedelta(minutes=settings.MONITORING_LEASE_MINUTES), lease_token=token
            )
    return ids, token


def _slot(key: str) -> bool:
    return cache.add(f"monitoring:{key}", 1, timeout=settings.MONITORING_HOST_INTERVAL)


def _polite(url: str) -> bool:
    """At most one request per host *and* per resolved IP every MONITORING_HOST_INTERVAL seconds (shared cache
    = Redis in production). The IP slot stops wildcard DNS (many names, one victim address) from multiplying
    requests. Raises BlockedURL/FetchError for non-public or unresolvable hosts."""
    host = (urlsplit(url).hostname or "").lower()
    ip = check_url(url)
    return _slot(f"host:{host}") and _slot(f"ip:{ip}")


def _normalize(html: str) -> str:
    return "\n".join(extract_blocks(html))[:MAX_TEXT]


def _validator(value: str, limit: int) -> str:
    """Store an ETag/Last-Modified only if it can be sent back safely (printable ASCII, bounded)."""
    return value if value and len(value) <= limit and value.isascii() and value.isprintable() else ""


def _fail(watch: Watch, status: str, message: str, now) -> str:
    watch.consecutive_errors += 1
    watch.last_status = status
    watch.last_error = redact(message)[:200]
    watch.last_checked_at = now
    if watch.consecutive_errors >= settings.MONITORING_MAX_ERRORS:
        watch.active = False
        watch.last_status = Watch.Status.PAUSED
        watch.last_error = f"Paused after {watch.consecutive_errors} failed checks: {watch.last_error}"[:200]
    else:
        # Back off: 1h, 2h, 4h ... never later than the normal cadence.
        backoff = min(timedelta(hours=2 ** (watch.consecutive_errors - 1)), CADENCE[effective_cadence(watch)])
        watch.next_run_at = now + backoff
    watch.save(update_fields=["consecutive_errors", "last_status", "last_error", "last_checked_at", "active", "next_run_at"])
    return watch.last_status


def check_watch(watch_id: int, lease_token: str | None = None) -> str:
    """Check one watch. With a lease token (scheduler), only the holder of that lease may run it."""
    if lease_token is not None and not Watch.objects.filter(pk=watch_id, lease_token=lease_token, active=True).update(
        lease_token=None
    ):
        return "skipped"  # lease expired and re-claimed, or a duplicate delivery
    watch = Watch.objects.filter(pk=watch_id, active=True).select_related("project__owner").first()
    if watch is None:
        return "skipped"
    now = timezone.now()
    try:
        return _check(watch, now)
    except Exception:  # noqa: BLE001 - never leave a watch looping on an unexpected error
        logger.exception("monitoring check failed for watch %s", watch_id)
        return _fail(watch, Watch.Status.ERROR, "Unexpected error while checking this page.", now)


def over_plan_limit(watch: Watch) -> int | None:
    """After a downgrade (e.g. a refunded pack) the oldest watches up to the plan's limit keep running; the rest
    wait. Returns the limit when this watch is beyond it, else None."""
    from billing.plans import monitoring_limits

    limit = monitoring_limits(watch.project.owner)["max_watches"]
    older = Watch.objects.filter(project__owner=watch.project.owner, active=True, created_at__lt=watch.created_at).count()
    return limit if older >= limit else None


def _check(watch: Watch, now) -> str:
    limit = over_plan_limit(watch)
    if limit is not None:
        watch.last_status = Watch.Status.PAUSED
        watch.last_error = f"Waiting: your plan watches {limit} page{'s' if limit != 1 else ''}. A credit pack resumes this one."
        watch.next_run_at = now + CADENCE["weekly"]
        watch.save(update_fields=["last_status", "last_error", "next_run_at"])
        return watch.last_status
    try:
        if not _polite(watch.url):
            # Spread retries so many watches on one host don't all come back at the same moment.
            delay = settings.MONITORING_HOST_INTERVAL * random.uniform(1, 6)
            Watch.objects.filter(pk=watch.pk).update(next_run_at=now + timedelta(seconds=delay))
            return "deferred"
        page = fetch_public_page(watch.url, conditional={"etag": watch.etag, "last_modified": watch.last_modified})
    except BlockedURL as exc:
        return _fail(watch, Watch.Status.BLOCKED, str(exc), now)
    except FetchError as exc:
        return _fail(watch, Watch.Status.ERROR, str(exc), now)

    watch.consecutive_errors = 0
    watch.last_error = ""
    watch.last_checked_at = now
    watch.next_run_at = next_run(effective_cadence(watch), now)
    fields = [
        "consecutive_errors",
        "last_error",
        "last_checked_at",
        "next_run_at",
        "last_status",
        "etag",
        "last_modified",
        "last_hash",
    ]
    if page.status == 304:
        watch.last_status = Watch.Status.UNCHANGED
        watch.save(update_fields=fields)
        return watch.last_status

    text = _normalize(page.text)
    digest = hashlib.sha256(text.encode()).hexdigest()
    # Validators only when the page wasn't redirected elsewhere, and only safe-to-resend values.
    same_url = page.url == watch.url
    watch.etag = _validator(page.etag, 200) if same_url else ""
    watch.last_modified = _validator(page.last_modified, 100) if same_url else ""
    if digest == watch.last_hash:
        watch.last_status = Watch.Status.UNCHANGED  # served again, but the visible text is identical
        watch.save(update_fields=fields)
        return watch.last_status

    # Diff before opening a transaction (linear time, see diff.py), then write everything at once.
    previous = watch.observations.order_by("-fetched_at", "-id").first()
    d = diff_pages(previous.text, text) if previous else None
    with transaction.atomic():
        obs = Observation.objects.create(watch=watch, fetched_at=now, final_url=redact(page.url)[:500], content_hash=digest, text=text)
        watch.last_hash = digest
        change = None
        if d is None:
            watch.last_status = Watch.Status.BASELINE
        elif d["details"]["blocks_added_total"] or d["details"]["blocks_removed_total"] or d["kind"] == "pricing":
            change = Change.objects.create(
                watch=watch,
                project=watch.project,
                before=previous,
                after=obs,
                detected_at=now,
                kind=d["kind"],
                significance=d["significance"],
                summary=d["summary"],
                details=d["details"],
            )
            watch.last_status = Watch.Status.CHANGED
        else:
            watch.last_status = Watch.Status.UNCHANGED  # only whitespace/ordering noise
        watch.save(update_fields=fields)
    prune(watch)
    if change is not None:
        _after_change(change)
    return watch.last_status


def _after_change(change: Change) -> None:
    """Outside the transaction: optional AI summary of the diff, then an in-app notice. Never fails the check."""
    from monitoring.summarize import summarize_change
    from notifications.services import notify

    # Notice first (cheap, never delayed by the AI call); each step isolated so neither can fail the check.
    if change.significance in (Change.Significance.HIGH, Change.Significance.MEDIUM):
        watch = change.watch
        try:
            notify(
                change.project.owner,
                kind="competitor_change",
                title=f"{watch.label or 'A watched page'}: {'prices changed' if change.kind == 'pricing' else 'page changed'}",
                body=change.summary,
                link=f"/projects/{change.project_id}/monitoring?change={change.pk}",
                project=change.project,
                source=f"change:{change.pk}",
            )
        except Exception:  # noqa: BLE001
            logger.exception("notification failed for change %s", change.pk)
    try:
        summarize_change(change)
    except Exception:  # noqa: BLE001 - a summary is optional
        logger.exception("summary failed for change %s", change.pk)


def prune(watch: Watch) -> int:
    """Keep the newest N changes, the newest N observations and any a kept change points at; delete the rest.
    Bounded: a page whose text rotates on every visit can't grow storage forever."""
    old_changes = list(
        Change.objects.filter(watch=watch)
        .order_by("-detected_at", "-id")
        .values_list("id", flat=True)[settings.MONITORING_KEEP_CHANGES :]
    )
    if old_changes:
        Change.objects.filter(pk__in=old_changes).delete()
    keep = set(watch.observations.order_by("-fetched_at", "-id").values_list("id", flat=True)[: settings.MONITORING_KEEP_OBSERVATIONS])
    for before_id, after_id in Change.objects.filter(watch=watch).values_list("before_id", "after_id"):
        keep.update(i for i in (before_id, after_id) if i)
    deleted, _ = watch.observations.exclude(pk__in=keep).delete()
    return deleted


def run_cycle(limit: int | None = None, check=check_watch) -> dict:
    """One scheduler cycle, inline (local runner and tests). Production fans out to Celery instead."""
    counts: dict[str, int] = {}
    ids, token = claim_due(limit)
    for watch_id in ids:
        try:
            status = check(watch_id, token)
        except Exception:  # noqa: BLE001 - one bad watch never stops the cycle
            logger.exception("monitoring check crashed for watch %s", watch_id)
            status = "crashed"
        status = str(status)  # plain value for logs and counters
        counts[status] = counts.get(status, 0) + 1
    return counts
