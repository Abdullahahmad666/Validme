"""Polar (merchant of record): hosted checkout, customer portal and signed webhooks.

Docs: https://polar.sh/docs. Nothing here runs in the browser; the access token and webhook secret come from env and
never leave the server. Sandbox and production are separate Polar environments (separate tokens, products and webhook
secrets), chosen with POLAR_SERVER, so a sandbox order can never be verified, or credited, by a production server.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import logging
import time

import httpx
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

NAME = "polar"
API = {"sandbox": "https://sandbox-api.polar.sh/v1", "production": "https://api.polar.sh/v1"}
WEBHOOK_TOLERANCE_SECONDS = 300  # older (or future-dated) deliveries are rejected as replays


class ProviderUnavailable(Exception):
    pass


def is_configured() -> bool:
    return bool(settings.POLAR_ACCESS_TOKEN and settings.POLAR_WEBHOOK_SECRET and settings.POLAR_SERVER in API)


def _api() -> str:
    return API[settings.POLAR_SERVER]


def _headers() -> dict:
    return {"Authorization": f"Bearer {settings.POLAR_ACCESS_TOKEN}", "Accept": "application/json"}


def _status_of(exc: Exception) -> str:
    # Log the status only: requests carry the token in a header, never echo them.
    return str(exc.response.status_code) if isinstance(exc, httpx.HTTPStatusError) else type(exc).__name__


def create_checkout(*, product_id: str, metadata: dict, email: str, customer_ref: str, success_url: str) -> tuple[str, str]:
    """Returns (checkout_id, hosted checkout URL). `metadata` (our ids, as strings) is copied by Polar onto the
    resulting order and subscription and comes back on webhooks; the webhook still re-checks product and user."""
    if not is_configured():
        raise ProviderUnavailable("Payments aren't configured.")
    body = {
        "products": [product_id],
        "metadata": {k: str(v) for k, v in metadata.items()},
        "customer_email": email,
        "external_customer_id": customer_ref,
        "success_url": success_url,
    }
    try:
        resp = httpx.post(f"{_api()}/checkouts/", json=body, headers=_headers(), timeout=15, trust_env=False)
        resp.raise_for_status()
        data = resp.json()
        checkout_id, url = str(data["id"]), data["url"]
    except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
        logger.warning("polar checkout failed: %s", _status_of(exc))
        raise ProviderUnavailable("The payment provider didn't respond. Please try again.") from exc
    if not isinstance(url, str) or not url.startswith("https://"):
        raise ProviderUnavailable("Unexpected checkout URL.")
    return checkout_id, url


def price_label(product_id: str) -> str | None:
    """Display price straight from the provider (never hard-coded here). Cached for an hour."""
    if not is_configured():
        return None
    key = f"polar:{settings.POLAR_SERVER}:price:{product_id}"
    cached = cache.get(key)
    if cached is not None:
        return cached or None
    label = ""
    try:
        resp = httpx.get(f"{_api()}/products/{product_id}", headers=_headers(), timeout=3, trust_env=False)
        resp.raise_for_status()
        price = next(p for p in resp.json()["prices"] if p.get("amount_type") == "fixed" and not p.get("is_archived"))
        label = f"{int(price['price_amount']) / 100:,.2f} {str(price['price_currency']).upper()}"
    except (httpx.HTTPError, KeyError, ValueError, TypeError, StopIteration):
        logger.warning("polar price lookup failed for product %s", product_id)
    cache.set(key, label, 3600 if label else 300)
    return label or None


def _secret_keys(secret: str) -> list[bytes]:
    """Polar signs with Standard Webhooks. Secrets created from Sep 2026 are standard `whsec_<base64>` keys; older
    ones use the whole secret string as the key. Try both, as Polar's own SDKs do."""
    keys = [secret.encode()]
    if secret.startswith("whsec_"):
        try:
            keys.insert(0, base64.b64decode(secret[len("whsec_") :], validate=True))
        except (binascii.Error, ValueError):
            pass
    return keys


def verify_signature(raw_body: bytes, headers) -> bool:
    """Standard Webhooks: base64 HMAC-SHA256 of "{webhook-id}.{webhook-timestamp}.{body}", sent as one or more
    space-separated "v1,<signature>" entries. Stale timestamps are rejected so captured deliveries can't be replayed."""
    secret = settings.POLAR_WEBHOOK_SECRET
    msg_id, ts, sig_header = headers.get("webhook-id", ""), headers.get("webhook-timestamp", ""), headers.get("webhook-signature", "")
    if not (secret and msg_id and ts and sig_header):
        return False
    try:
        if abs(time.time() - int(ts)) > WEBHOOK_TOLERANCE_SECONDS:
            return False
    except ValueError:
        return False
    signed = f"{msg_id}.{ts}.".encode() + raw_body
    given = [part.split(",", 1)[1] for part in sig_header.split() if part.startswith("v1,")]
    for key in _secret_keys(secret):
        expected = base64.b64encode(hmac.new(key, signed, hashlib.sha256).digest())
        # Compare bytes: str compare_digest raises on non-ASCII input (an unauthenticated 500).
        if any(hmac.compare_digest(expected, g.encode("latin-1", "replace")) for g in given):
            return True
    return False


def customer_portal_url(subscription_id: str) -> str:
    """A fresh, signed customer-portal link (update card, change plan, cancel, invoices). Fetched on demand: portal
    sessions expire, so we never store them."""
    if not is_configured():
        raise ProviderUnavailable("Payments aren't configured.")
    try:
        sub = httpx.get(f"{_api()}/subscriptions/{subscription_id}", headers=_headers(), timeout=10, trust_env=False)
        sub.raise_for_status()
        customer_id = sub.json()["customer_id"]
        resp = httpx.post(
            f"{_api()}/customer-sessions/", json={"customer_id": customer_id}, headers=_headers(), timeout=10, trust_env=False
        )
        resp.raise_for_status()
        url = resp.json()["customer_portal_url"]
    except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
        logger.warning("polar portal lookup failed: %s", _status_of(exc))
        raise ProviderUnavailable("Couldn't open the billing portal. Please try again.") from exc
    if not isinstance(url, str) or not url.startswith("https://"):
        raise ProviderUnavailable("Unexpected portal URL.")
    return url
