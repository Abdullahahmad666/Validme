"""Record product events. Analytics must never break the product: failures are logged and swallowed."""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# Events the browser may send. Anything else from a client is dropped.
CLIENT_EVENTS = {
    "hero_cta_clicked",
    "sample_report_opened",
    "pricing_viewed",
    "signup_started",
    "signup_completed",
    "report_viewed",
    "report_exported",
    "checkout_clicked",
}
MAX_PROPS = 8


def clean_props(props: object) -> dict:
    """Keep up to 8 flat, short, non-personal values."""
    if not isinstance(props, dict):
        return {}
    out: dict = {}
    for k, v in list(props.items())[:MAX_PROPS]:
        if not isinstance(k, str) or len(k) > 40:
            continue
        if isinstance(v, bool) or v is None or (isinstance(v, (int, float)) and abs(v) < 1e12):
            out[k] = v
        elif isinstance(v, str):
            out[k] = v[:100]
    return out


def track(name: str, *, user=None, props: dict | None = None, source: str = "server", path: str = "") -> None:
    from analytics.models import AnalyticsEvent

    try:
        AnalyticsEvent.objects.create(
            name=name[:40],
            source=source,
            user=user if getattr(user, "is_authenticated", False) else None,
            path=path[:200],
            props=clean_props(props or {}),
        )
    except Exception:  # noqa: BLE001 - analytics is best-effort
        logger.exception("analytics event %s not recorded", name)
