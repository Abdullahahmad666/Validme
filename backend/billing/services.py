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


class WebhookRetry(Exception):
    """Return non-2xx so the provider redelivers (e.g. a refund for an order we haven't linked yet)."""


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
        # A test-mode order must never grant real credits (and vice versa). Error level: in production this
        # means LEMONSQUEEZY_TEST_MODE is wrong and paying customers aren't being credited.
        logger.error("webhook %s for order %s has mismatched test_mode", event, order_id)
        return "ignored test_mode mismatch"
    custom = meta.get("custom_data") or {}
    if event == "order_created" and attrs.get("status") in ("paid", "refunded", "partial_refund"):
        return _order_paid(order_id, custom, attrs)
    if event == "order_refunded":
        return _order_refunded(order_id, attrs, custom)
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
        # A refund may have been delivered first (or be included in this delivery): never grant refunded credits.
        refunded = max(purchase.credits_refunded, int(purchase.credits * refunded_share(attrs)))
        grant = purchase.credits - refunded
        if grant > 0:
            grant_credits(purchase.user, grant, "purchase", idempotency_key=f"purchase:{order_id}")
        purchase.credits_refunded = refunded
        purchase.status = Purchase.Status.PAID if grant > 0 else Purchase.Status.REFUNDED
        purchase.provider_order_id = order_id
        purchase.paid_at = timezone.now()
        purchase.save(update_fields=["status", "provider_order_id", "paid_at", "credits_refunded"])
    track("purchase_completed", user=purchase.user, props={"pack": purchase.pack_id, "credits": purchase.credits})
    return "credited"


def refunded_share(attrs: dict) -> float:
    """Fraction of the order refunded so far (0..1). Lemon Squeezy sends cumulative cents on each refund."""
    try:
        total = int(attrs.get("total") or 0)
        refunded = int(attrs.get("refunded_amount") or 0)
    except (TypeError, ValueError):
        return 0.0
    if attrs.get("status") == "refunded":
        return 1.0  # the provider says it's fully refunded (amounts can differ by tax or rounding)
    if total <= 0:
        return 0.0
    return max(0.0, min(1.0, refunded / total))


def _purchase_for_refund(order_id: str, custom: dict) -> Purchase | None:
    """Locked purchase for a refund: by order id, or by our purchase id when the paid event hasn't arrived."""
    purchase = Purchase.objects.select_for_update().filter(provider_order_id=order_id).first()
    if purchase is not None:
        return purchase
    try:
        purchase_id = uuid.UUID(str(custom.get("purchase_id", "")))
    except ValueError:
        return None
    purchase = Purchase.objects.select_for_update().filter(pk=purchase_id).first()
    if purchase is None or str(purchase.user_id) != str(custom.get("user_id")) or purchase.provider_order_id:
        return None
    return purchase


def _order_refunded(order_id: str, attrs: dict, custom: dict) -> str:
    """Full or partial refund: take back the matching share of the pack's credits (rounded down, in the
    customer's favour), never more than the balance. Credits already spent on research stay spent."""
    share = refunded_share(attrs)
    if share <= 0:
        return "ignored refund without amount"
    with transaction.atomic():
        purchase = _purchase_for_refund(order_id, custom)
        if purchase is None:
            # Not linked yet (or a concurrent paid delivery hasn't committed): ask the provider to retry.
            raise WebhookRetry(f"refund for unknown order {order_id}")
        if purchase.status == Purchase.Status.PENDING:
            # Refund before the paid event: remember it; the paid event then grants only the unrefunded part.
            purchase.provider_order_id = order_id
            purchase.credits_refunded = max(purchase.credits_refunded, int(purchase.credits * share))
            if share >= 1:
                purchase.status = Purchase.Status.REFUNDED
                purchase.refunded_at = timezone.now()
            purchase.save(update_fields=["provider_order_id", "credits_refunded", "status", "refunded_at"])
            return "refund recorded before payment"
        if purchase.status != Purchase.Status.PAID:
            return "ignored refund"
        target = int(purchase.credits * share)  # credits this cumulative refund covers
        delta = target - purchase.credits_refunded
        if delta > 0:
            user = User.objects.select_for_update().get(pk=purchase.user_id)
            take = min(delta, user.credits)
            key = f"purchase_refund:{order_id}:{target}"  # one ledger row per refund level, so replays are no-ops
            if take and not UsageTransaction.objects.filter(idempotency_key=key).exists():
                user.credits -= take
                user.save(update_fields=["credits"])
                UsageTransaction.objects.create(user=user, operation="purchase_refund", credits=-take, idempotency_key=key)
            purchase.credits_refunded = target
        if share >= 1:
            purchase.status = Purchase.Status.REFUNDED
            purchase.refunded_at = timezone.now()
        purchase.save(update_fields=["credits_refunded", "status", "refunded_at"])
    track("purchase_refunded", user=purchase.user, props={"pack": purchase.pack_id, "full": share >= 1})
    return "refunded" if share >= 1 else "partially refunded"
