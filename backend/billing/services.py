import hashlib
import hmac
import logging
import uuid

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from analytics.services import track
from billing.models import Purchase, UsageTransaction
from billing.providers import polar as provider

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
    return [p for p in settings.CREDIT_PACKS if p.get("id") and int(p.get("credits", 0)) > 0 and p.get("product_id")]


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
        product_id=str(p["product_id"]),
        metadata={"purchase_id": purchase.id, "user_id": user.pk, "kind": "pack"},
        email=user.email,
        customer_ref=str(user.pk),
        success_url=f"{settings.FRONTEND_URL}/billing?checkout=success",
    )
    purchase.checkout_id = checkout_id[:80]
    purchase.save(update_fields=["checkout_id"])
    track("checkout_started", user=user, props={"pack": p["id"]})
    return url


# --- Subscriptions ------------------------------------------------------------------------------------


def subscription_plans() -> list[dict]:
    return [
        p
        for p in settings.SUBSCRIPTION_PLANS
        if p.get("id") in ("founder", "pro") and (p.get("monthly_product_id") or p.get("yearly_product_id"))
    ]


def plan_for_product(product_id) -> tuple[dict, str] | None:
    """(plan config, "month" | "year") for a Polar product, or None if it isn't one of our plans. Polar products
    have one billing interval each, so every plan has a monthly and a yearly product."""
    v = str(product_id or "")
    for p in subscription_plans():
        if v and v == str(p.get("monthly_product_id", "")):
            return p, "month"
        if v and v == str(p.get("yearly_product_id", "")):
            return p, "year"
    return None


class AlreadySubscribed(Exception):
    pass


def checkout_sig(user_id, plan_id) -> str:
    """Binds a subscription checkout to the user who started it: checkout links and sessions can carry metadata
    from anyone, so without this anyone could attach their subscription to someone else's account."""
    msg = f"subscription|{user_id}|{plan_id}".encode()
    return hmac.new(settings.SECRET_KEY.encode(), msg, hashlib.sha256).hexdigest()[:32]


def start_subscription_checkout(user: User, plan_id: str, interval: str) -> str:
    from billing.plans import active_subscription

    if active_subscription(user):
        raise AlreadySubscribed("You already have a plan. Change or cancel it from the billing portal.")
    p = next((x for x in subscription_plans() if x["id"] == plan_id), None)
    product = p and p.get("monthly_product_id" if interval == "month" else "yearly_product_id")
    if not product:
        raise ValueError("Unknown plan.")
    _, url = provider.create_checkout(
        product_id=str(product),
        metadata={"user_id": user.pk, "kind": "subscription", "plan": plan_id, "sig": checkout_sig(user.pk, plan_id)},
        email=user.email,
        customer_ref=str(user.pk),
        success_url=f"{settings.FRONTEND_URL}/billing?checkout=success",
    )
    track("checkout_started", user=user, props={"plan": plan_id, "interval": interval})
    return url


def _dt(value):
    from django.utils.dateparse import parse_datetime

    return parse_datetime(value) if isinstance(value, str) and value else None


def _subscription_state(data: dict) -> tuple[str, object, object]:
    """Polar's subscription fields -> our (status, renews_at, ends_at). Our statuses stay provider-neutral:
    a subscription set to cancel at period end is "cancelled" with access until ends_at; once it has ended
    (period over, or revoked straight away) it is "expired"."""
    status = str(data.get("status") or "")
    period_end = _dt(data.get("current_period_end"))
    if data.get("ended_at") or status == "incomplete_expired":
        return "expired", None, _dt(data.get("ended_at"))
    if status == "canceled" or (status in ("active", "trialing", "past_due") and data.get("cancel_at_period_end")):
        return "cancelled", None, _dt(data.get("ends_at")) or period_end
    mapped = {"active": "active", "trialing": "on_trial", "past_due": "past_due", "unpaid": "unpaid"}.get(status, status or "unknown")
    return mapped, (period_end if mapped in ("active", "on_trial") else None), None


def _subscription_event(sub_id: str, data: dict) -> str:
    from billing.models import Subscription

    mapped = plan_for_product(data.get("product_id"))
    meta = data.get("metadata") if isinstance(data.get("metadata"), dict) else {}
    with transaction.atomic():
        sub = Subscription.objects.select_for_update().filter(provider_subscription_id=sub_id).first()
        if mapped is None and sub is None:
            logger.warning("subscription %s has a product that isn't one of our plans", sub_id)
            return "ignored unknown product"
        if sub is None:
            # First sight: the user comes from our own checkout's signed metadata and must exist.
            expected = checkout_sig(meta.get("user_id", ""), meta.get("plan", ""))
            if not hmac.compare_digest(str(meta.get("sig", "")).encode(), expected.encode()):
                logger.warning("subscription %s without a valid checkout signature", sub_id)
                return "ignored unsigned subscription"
            try:
                user = User.objects.get(pk=int(meta.get("user_id", "")))
            except (User.DoesNotExist, ValueError, TypeError):
                logger.warning("subscription %s without a known user", sub_id)
                return "ignored unknown user"
            sub = Subscription(user=user, provider=provider.NAME, provider_subscription_id=sub_id)
        event_at = _dt(data.get("modified_at")) or _dt(data.get("created_at"))
        if event_at and sub.provider_updated_at and event_at < sub.provider_updated_at:
            return "ignored stale event"  # a retried or out-of-order delivery must not undo a newer state
        if mapped is not None:
            sub.plan, sub.interval = mapped[0]["id"], mapped[1]
            sub.variant_id = str(data.get("product_id"))[:40]
        else:
            # Moved to a product we don't sell (any more): keep the last known plan, but still follow its status so
            # a cancellation or revocation always ends access.
            logger.warning("subscription %s moved to a product that isn't one of our plans", sub_id)
        status, sub.renews_at, sub.ends_at = _subscription_state(data)
        sub.status = status[:20]
        sub.provider_updated_at = event_at or sub.provider_updated_at
        sub.save()
    track("subscription_updated", user=sub.user, props={"plan": sub.plan, "status": sub.status})
    return f"subscription {sub.status}"


def _invoice_paid(invoice_id: str, attrs: dict) -> str:
    """Each paid subscription order grants that plan's credits once (yearly orders grant 12 months at once)."""
    from billing.models import Subscription

    if attrs.get("status") != "paid":
        return "ignored unpaid invoice"
    # Plan or interval changes create prorated "subscription_update" orders: they must not grant another period.
    if attrs.get("billing_reason") not in GRANTING_REASONS:
        return f"ignored {attrs.get('billing_reason') or 'unknown'} invoice"
    try:
        if int(attrs.get("total_amount") or 0) <= 0:
            return "ignored zero invoice"
    except (TypeError, ValueError):
        return "ignored invoice without total"
    sub = Subscription.objects.filter(provider_subscription_id=str(attrs.get("subscription_id", ""))).first()
    if sub is None:
        raise WebhookRetry(f"invoice {invoice_id} for a subscription we haven't seen yet")
    # The order's own product says what was paid for (a renewal can arrive before the plan-change event).
    plan, interval = plan_for_product(attrs.get("product_id")) or (
        next((p for p in subscription_plans() if p["id"] == sub.plan), None),
        sub.interval,
    )
    credits = int((plan or {}).get("monthly_credits", 0)) * (12 if interval == "year" else 1)
    # A refund delivered before this paid event: grant only the part that wasn't refunded.
    early = UsageTransaction.objects.filter(idempotency_key__startswith=f"{EARLY_REFUND}{invoice_id}:").values_list(
        "idempotency_key", flat=True
    )
    early_share = max((int(k.rsplit(":", 1)[1]) for k in early), default=0) / 10000
    credits -= int(credits * early_share)
    if credits > 0:
        grant_credits(sub.user, credits, "subscription_credits", idempotency_key=f"sub_credits:{invoice_id}")
    return f"granted {credits}"


EARLY_REFUND = "sub_refund_early:"


GRANTING_REASONS = ("subscription_create", "subscription_cycle")


def _invoice_refunded(invoice_id: str, attrs: dict) -> str:
    """Take back the refunded share of what this invoice granted (never more than the balance), once per level."""
    share = refunded_share(attrs)
    if share <= 0:
        return "ignored refund without amount"
    with transaction.atomic():
        grant = UsageTransaction.objects.filter(idempotency_key=f"sub_credits:{invoice_id}").first()
        if grant is None:
            return _record_early_refund(invoice_id, attrs, share)
        user = User.objects.select_for_update().get(pk=grant.user_id)
        target = int(grant.credits * share)
        prefix = f"sub_refund:{invoice_id}:"
        if UsageTransaction.objects.filter(idempotency_key=f"{prefix}{target}").exists():
            return "already refunded"
        taken = -sum(UsageTransaction.objects.filter(idempotency_key__startswith=prefix).values_list("credits", flat=True))
        take = min(max(0, target - taken), user.credits)
        user.credits -= take
        user.save(update_fields=["credits"])
        UsageTransaction.objects.create(user=user, operation="subscription_refund", credits=-take, idempotency_key=f"{prefix}{target}")
    return f"took back {take}"


def _record_early_refund(invoice_id: str, attrs: dict, share: float) -> str:
    """A refund for a subscription order whose paid event hasn't been applied yet (it may be waiting on a retry):
    remember the refunded share (zero-credit ledger row, hidden from usage) so the paid event grants only the rest."""
    from billing.models import Subscription

    sub = Subscription.objects.filter(provider_subscription_id=str(attrs.get("subscription_id", ""))).first()
    if sub is None:
        raise WebhookRetry(f"refund for order {invoice_id} of a subscription we haven't seen yet")
    key = f"{EARLY_REFUND}{invoice_id}:{int(share * 10000)}"
    if not UsageTransaction.objects.filter(idempotency_key=key).exists():
        UsageTransaction.objects.create(user=sub.user, operation="subscription_refund", credits=0, idempotency_key=key)
    return "refund recorded before payment"


class WebhookRetry(Exception):
    """Return non-2xx so the provider redelivers (e.g. a refund for an order we haven't linked yet)."""


def handle_webhook(payload: dict) -> str:
    """Apply one verified Polar webhook ({"type": "order.paid", "data": {...}}). Returns what happened (for logs).
    Idempotent: providers retry, and deliveries can arrive out of order."""
    if not isinstance(payload, dict):
        return "ignored non-object payload"
    event = str(payload.get("type") or "")
    data = payload.get("data")
    if not isinstance(data, dict) or not data.get("id"):
        return f"ignored {event}"
    obj_id = str(data["id"])
    if event.startswith("subscription."):
        return _subscription_event(obj_id, data)
    if event not in ("order.paid", "order.refunded"):
        return f"ignored {event}"
    meta = data.get("metadata") if isinstance(data.get("metadata"), dict) else {}
    if data.get("subscription_id"):
        # Subscription orders: the first payment, renewals and plan-change prorations.
        if event == "order.paid":
            return _invoice_paid(obj_id, data)
        return _invoice_refunded(obj_id, data)
    if meta.get("kind") == "subscription":
        return f"ignored {event} for a subscription order without a subscription"
    if (
        event == "order.paid"
        and data.get("billing_reason") == "purchase"
        and data.get("status")
        in (
            "paid",
            "refunded",
            "partially_refunded",
        )
    ):
        return _order_paid(obj_id, meta, data)
    if event == "order.refunded":
        return _order_refunded(obj_id, data, meta)
    return f"ignored {event}"


def _order_paid(order_id: str, custom: dict, attrs: dict) -> str:
    try:
        if int(attrs.get("total_amount") or 0) <= 0:
            # e.g. a 100%-off discount code: packs are only granted for money actually paid.
            logger.warning("paid order %s for a pack has no amount", order_id)
            return "ignored zero order"
    except (TypeError, ValueError):
        return "ignored order without total"
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
        product = str(attrs.get("product_id") or "")
        if expected is None or str(expected["product_id"]) != product:
            logger.warning("paid order %s product %s doesn't match pack %s", order_id, product, purchase.pack_id)
            return "ignored product mismatch"
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
    """Fraction of the order refunded so far (0..1). Polar sends the cumulative refunded cents on each refund."""
    try:
        total = int(attrs.get("total_amount") or 0)
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
