import logging
import uuid

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from analytics.services import track
from billing.models import Purchase, UsageTransaction
from billing.providers import lemonsqueezy as provider

logger = logging.getLogger(__name__)


class InsufficientCredits(Exception):
    pass


def credits_for(depth: str) -> int:
    return settings.CREDITS_PER_DEPTH[depth]


@transaction.atomic
def spend_credits(user: User, amount: int, operation: str, job=None) -> None:
    locked = User.objects.select_for_update().get(pk=user.pk)
    if locked.credits < amount:
        raise InsufficientCredits(f"Needs {amount} credits, {locked.credits} available.")
    locked.credits -= amount
    locked.save(update_fields=["credits"])
    UsageTransaction.objects.create(user=locked, operation=operation, credits=-amount, job=job)
    user.credits = locked.credits


@transaction.atomic
def grant_credits(user: User, amount: int, operation: str, idempotency_key: str | None = None, job=None) -> bool:
    """Add credits and record the grant in the ledger. Returns False if this key was already granted."""
    if amount <= 0:
        return False
    locked = User.objects.select_for_update().get(pk=user.pk)
    if idempotency_key and UsageTransaction.objects.filter(idempotency_key=idempotency_key).exists():
        return False
    locked.credits += amount
    locked.save(update_fields=["credits"])
    UsageTransaction.objects.create(user=locked, operation=operation, credits=amount, idempotency_key=idempotency_key, job=job)
    user.credits = locked.credits
    return True


def refund_job(job) -> bool:
    """A job that delivered nothing gives its credits back, once."""
    if not job.credits_charged:
        return False
    refunded = grant_credits(job.project.owner, job.credits_charged, "job_refund", idempotency_key=f"job_refund:{job.id}", job=job)
    if refunded:
        logger.info("refunded %s credits for job %s", job.credits_charged, job.id)
    return refunded


# --- Credit packs -------------------------------------------------------------------------------


def packs() -> list[dict]:
    """Packs come from configuration (CREDIT_PACKS); the price label comes from the payment provider."""
    return [p for p in settings.CREDIT_PACKS if p.get("id") and int(p.get("credits", 0)) > 0 and p.get("variant_id")]


def pack(pack_id: str) -> dict | None:
    return next((p for p in packs() if p["id"] == pack_id), None)


def payments_available() -> bool:
    return provider.is_configured() and bool(packs())


def start_checkout(user: User, pack_id: str) -> str:
    p = pack(pack_id)
    if p is None:
        raise ValueError("Unknown credit pack.")
    purchase = Purchase.objects.create(user=user, provider=provider.NAME, pack_id=p["id"], credits=int(p["credits"]))
    checkout_id, url = provider.create_checkout(
        variant_id=str(p["variant_id"]),
        purchase_id=str(purchase.id),
        user_id=user.pk,
        email=user.email,
        redirect_url=f"{settings.FRONTEND_URL}/billing?checkout=success",
    )
    purchase.checkout_id = checkout_id[:80]
    purchase.save(update_fields=["checkout_id"])
    track("checkout_started", user=user, props={"pack": p["id"]})
    return url


class WebhookRejected(Exception):
    pass


def handle_webhook(payload: dict) -> str:
    """Apply one verified webhook. Returns what happened (for logs). Idempotent: providers retry."""
    meta = payload.get("meta") or {}
    event = meta.get("event_name", "")
    data = payload.get("data") or {}
    attrs = data.get("attributes") or {}
    order_id = str(data.get("id") or "")
    if data.get("type") != "orders" or not order_id:
        return f"ignored {event}"
    if bool(meta.get("test_mode")) != bool(settings.LEMONSQUEEZY_TEST_MODE):
        # A test-mode order must never grant real credits (and vice versa).
        logger.warning("webhook %s for order %s has mismatched test_mode", event, order_id)
        return "ignored test_mode mismatch"
    if event == "order_created" and attrs.get("status") == "paid":
        return _order_paid(order_id, meta.get("custom_data") or {}, attrs)
    if event == "order_refunded":
        return _order_refunded(order_id)
    return f"ignored {event}"


def _order_paid(order_id: str, custom: dict, attrs: dict) -> str:
    try:
        purchase_id = uuid.UUID(str(custom.get("purchase_id", "")))
    except ValueError:
        logger.warning("paid order %s without a known purchase id", order_id)
        return "ignored unknown purchase"
    with transaction.atomic():
        purchase = Purchase.objects.select_for_update().filter(pk=purchase_id).first()
        if purchase is None or str(purchase.user_id) != str(custom.get("user_id")):
            logger.warning("paid order %s doesn't match a purchase", order_id)
            return "ignored mismatched purchase"
        expected = pack(purchase.pack_id)
        variant = str((attrs.get("first_order_item") or {}).get("variant_id", ""))
        if expected is None or str(expected["variant_id"]) != variant:
            logger.warning("paid order %s variant %s doesn't match pack %s", order_id, variant, purchase.pack_id)
            return "ignored variant mismatch"
        if purchase.status != Purchase.Status.PENDING:
            return "already applied"
        grant_credits(purchase.user, purchase.credits, "purchase", idempotency_key=f"purchase:{order_id}")
        purchase.status = Purchase.Status.PAID
        purchase.provider_order_id = order_id
        purchase.paid_at = timezone.now()
        purchase.save(update_fields=["status", "provider_order_id", "paid_at"])
    track("purchase_completed", user=purchase.user, props={"pack": purchase.pack_id, "credits": purchase.credits})
    return "credited"


def _order_refunded(order_id: str) -> str:
    with transaction.atomic():
        purchase = Purchase.objects.select_for_update().filter(provider_order_id=order_id).first()
        if purchase is None or purchase.status != Purchase.Status.PAID:
            return "ignored refund"
        user = User.objects.select_for_update().get(pk=purchase.user_id)
        # Take back what's left of the pack; credits already spent on research stay spent.
        take = min(purchase.credits, user.credits)
        if take and not UsageTransaction.objects.filter(idempotency_key=f"purchase_refund:{order_id}").exists():
            user.credits -= take
            user.save(update_fields=["credits"])
            UsageTransaction.objects.create(
                user=user, operation="purchase_refund", credits=-take, idempotency_key=f"purchase_refund:{order_id}"
            )
        purchase.status = Purchase.Status.REFUNDED
        purchase.refunded_at = timezone.now()
        purchase.save(update_fields=["status", "refunded_at"])
    track("purchase_refunded", user=purchase.user, props={"pack": purchase.pack_id})
    return "refunded"
