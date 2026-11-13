from django.conf import settings
from django.db import models


class EmailPreference(models.Model):
    """Per-user email choices. Absent row = defaults (weekly digest on)."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="email_preference")
    weekly_digest = models.BooleanField(default=True)
    # Set by a bounce/complaint webhook: we stop sending until the address is fixed.
    bounced = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)


class DigestLog(models.Model):
    """One row per user per ISO week: the idempotency key for digest sends (retries never double-send)."""

    class Status(models.TextChoices):
        SENDING = "sending"
        SENT = "sent"
        SKIPPED = "skipped"  # nothing new, digest off, or bounced
        FAILED = "failed"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="digests")
    period = models.CharField(max_length=10)  # e.g. 2026-W46
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.SENDING)
    items = models.PositiveIntegerField(default=0)
    detail = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "period"], name="one_digest_per_week")]
