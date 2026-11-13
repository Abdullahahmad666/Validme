"""Lemon Squeezy (merchant of record): hosted checkout + signed webhooks.

Docs: https://docs.lemonsqueezy.com/api. Nothing here runs in the browser; the API key and webhook
secret come from env and never leave the server.
"""

from __future__ import annotations

import hashlib
import hmac
import logging

import httpx
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

API = "https://api.lemonsqueezy.com/v1"
NAME = "lemonsqueezy"


class ProviderUnavailable(Exception):
    pass


def is_configured() -> bool:
    return bool(settings.LEMONSQUEEZY_API_KEY and settings.LEMONSQUEEZY_STORE_ID and settings.LEMONSQUEEZY_WEBHOOK_SECRET)


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.LEMONSQUEEZY_API_KEY}",
        "Accept": "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
    }


def create_checkout(*, variant_id: str, custom: dict, email: str, redirect_url: str) -> tuple[str, str]:
    """Returns (checkout_id, hosted checkout URL). `custom` (our ids, as strings) travels with the checkout and
    comes back on webhooks; the webhook still re-checks the variant and user before granting anything."""
    if not is_configured():
        raise ProviderUnavailable("Payments aren't configured.")
    body = {
        "data": {
            "type": "checkouts",
            "attributes": {
                "checkout_data": {"email": email, "custom": {k: str(v) for k, v in custom.items()}},
                "product_options": {"redirect_url": redirect_url, "enabled_variants": [int(variant_id)]},
                "test_mode": settings.LEMONSQUEEZY_TEST_MODE,
            },
            "relationships": {
                "store": {"data": {"type": "stores", "id": str(settings.LEMONSQUEEZY_STORE_ID)}},
                "variant": {"data": {"type": "variants", "id": str(variant_id)}},
            },
        }
    }
    try:
        resp = httpx.post(f"{API}/checkouts", json=body, headers=_headers(), timeout=15, trust_env=False)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        # Log the status only: the request carries the API key in a header, never echo it.
        status = exc.response.status_code if isinstance(exc, httpx.HTTPStatusError) else "network"
        logger.warning("lemonsqueezy checkout failed: %s", status)
        raise ProviderUnavailable("The payment provider didn't respond. Please try again.") from exc
    data = resp.json()["data"]
    url = data["attributes"]["url"]
    if not url.startswith("https://"):
        raise ProviderUnavailable("Unexpected checkout URL.")
    return data["id"], url


def price_label(variant_id: str) -> str | None:
    """Display price straight from the provider (never hard-coded here). Cached for an hour."""
    if not is_configured():
        return None
    key = f"ls:price:{variant_id}"
    cached = cache.get(key)
    if cached is not None:
        return cached or None
    label = ""
    try:
        currency = _store_currency()
        v = httpx.get(f"{API}/variants/{variant_id}", headers=_headers(), timeout=3, trust_env=False)
        v.raise_for_status()
        cents = int(v.json()["data"]["attributes"]["price"])
        label = f"{cents / 100:,.2f} {currency}"
    except (httpx.HTTPError, KeyError, ValueError, TypeError):
        logger.warning("lemonsqueezy price lookup failed for variant %s", variant_id)
    cache.set(key, label, 3600 if label else 300)
    return label or None


def _store_currency() -> str:
    """Store currency, cached for a day (one lookup for every pack)."""
    key = f"ls:currency:{settings.LEMONSQUEEZY_STORE_ID}"
    currency = cache.get(key)
    if not currency:
        s = httpx.get(f"{API}/stores/{settings.LEMONSQUEEZY_STORE_ID}", headers=_headers(), timeout=3, trust_env=False)
        s.raise_for_status()
        currency = s.json()["data"]["attributes"]["currency"]
        cache.set(key, currency, 86400)
    return currency


def verify_signature(raw_body: bytes, signature: str) -> bool:
    """X-Signature = hex HMAC-SHA256 of the raw body with the webhook signing secret."""
    secret = settings.LEMONSQUEEZY_WEBHOOK_SECRET
    if not secret or not signature:
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    # Compare bytes: str compare_digest raises on non-ASCII input (an unauthenticated 500).
    return hmac.compare_digest(expected.encode(), signature.encode("latin-1", "replace"))


def customer_portal_url(subscription_id: str) -> str:
    """A fresh, signed customer-portal link for one subscription (update card, change plan, cancel).
    Fetched on demand: the provider's links expire, so we never store them."""
    if not is_configured():
        raise ProviderUnavailable("Payments aren't configured.")
    try:
        resp = httpx.get(f"{API}/subscriptions/{subscription_id}", headers=_headers(), timeout=10, trust_env=False)
        resp.raise_for_status()
        url = resp.json()["data"]["attributes"]["urls"]["customer_portal"]
    except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
        status = exc.response.status_code if isinstance(exc, httpx.HTTPStatusError) else type(exc).__name__
        logger.warning("lemonsqueezy portal lookup failed: %s", status)
        raise ProviderUnavailable("Couldn't open the billing portal. Please try again.") from exc
    if not isinstance(url, str) or not url.startswith("https://"):
        raise ProviderUnavailable("Unexpected portal URL.")
    return url
