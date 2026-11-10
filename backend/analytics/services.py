"""Record product events. Analytics must never break the product: failures are logged and swallowed."""

from __future__ import annotations

import logging
import re

from django.db import transaction

logger = logging.getLogger(__name__)

# Events the browser may send, with the only prop keys each may carry. Anything else is dropped.
CLIENT_EVENTS: dict[str, set[str]] = {
    "hero_cta_clicked": {"cta"},
    "sample_report_opened": {"source"},
    "pricing_viewed": {"source"},
    "signup_started": {"method"},
    "signup_completed": {"method", "verification"},
    "report_viewed": {"tab"},
    "report_exported": {"format"},
    "checkout_clicked": {"pack"},
}
# Short slugs only: no "@", no free text, so personal data can't ride along in props.
_SAFE_VALUE = re.compile(r"^[A-Za-z0-9_.-]{1,40}$")
MAX_PROPS = 8


def clean_props(props: object, allowed: set[str] | None = None) -> dict:
    """Keep up to 8 flat values: numbers, booleans and short slugs. `allowed` limits the keys (client events)."""
    if not isinstance(props, dict):
        return {}
    out: dict = {}
    for k, v in list(props.items())[:MAX_PROPS]:
        if not isinstance(k, str) or len(k) > 40 or (allowed is not None and k not in allowed):
            continue
        if isinstance(v, bool) or v is None or (isinstance(v, (int, float)) and abs(v) < 1e12):
            out[k] = v
        elif isinstance(v, str) and _SAFE_VALUE.match(v):
            out[k] = v
    return out


def track(name: str, *, user=None, props: dict | None = None, source: str = "server", path: str = "") -> None:
    from analytics.models import AnalyticsEvent

    try:
        # Savepoint: a failed insert must not poison the caller's transaction (e.g. a refund).
        with transaction.atomic():
            AnalyticsEvent.objects.create(
                name=name[:40],
                source=source,
                user=user if getattr(user, "is_authenticated", False) else None,
                path=path[:200],
                props=clean_props(props or {}, CLIENT_EVENTS.get(name) if source == "client" else None),
            )
    except Exception:  # noqa: BLE001 - analytics is best-effort
        logger.exception("analytics event %s not recorded", name)
