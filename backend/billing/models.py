import uuid

from django.conf import settings
from django.db import models


class UsageTransaction(models.Model):
    """Ledger of credit changes and real provider cost. Positive credits = grant, negative = spend."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="usage")
    # signup_grant | purchase | research_job | job_refund | purchase_refund | ai_* (0 credits, cost only)
    operation = models.CharField(max_length=40)
    credits = models.IntegerField()
    cost_usd = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    job = models.ForeignKey("research.ResearchJob", on_delete=models.SET_NULL, null=True, blank=True)
    # Set for grants that must happen at most once (e.g. "signup_grant:<user id>").
    idempotency_key = models.CharField(max_length=80, null=True, blank=True, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["user", "-created_at"])]


class Purchase(models.Model):
    """A credit-pack checkout. Credits are granted only by the payment provider's signed webhook."""

    class Status(models.TextChoices):
        PENDING = "pending"
        PAID = "paid"
        REFUNDED = "refunded"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="purchases")
    provider = models.CharField(max_length=20)
    pack_id = models.CharField(max_length=40)
    credits = models.PositiveIntegerField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    checkout_id = models.CharField(max_length=80, blank=True)
    # Set from the webhook; unique so one order can never be credited twice.
    provider_order_id = models.CharField(max_length=80, null=True, blank=True, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    refunded_at = models.DateTimeField(null=True, blank=True)
    # Credits covered by refunds so far (partial refunds take back a matching share of the pack).
    credits_refunded = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-created_at"]


class Subscription(models.Model):
    """A Lemon Squeezy subscription (Founder / Pro). Created and updated only by signed webhooks."""

    ENTITLED = ("on_trial", "active", "past_due")  # past_due: the provider is retrying payment

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="subscriptions")
    provider = models.CharField(max_length=20)
    provider_subscription_id = models.CharField(max_length=80, unique=True)
    plan = models.CharField(max_length=20)  # founder | pro
    interval = models.CharField(max_length=10, blank=True)  # month | year
    variant_id = models.CharField(max_length=40)
    status = models.CharField(max_length=20)  # on_trial | active | past_due | paused | unpaid | cancelled | expired
    renews_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)  # set when cancelled: access continues until then
    # The provider's updated_at of the last applied event: older (retried, out-of-order) events are ignored.
    provider_updated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
