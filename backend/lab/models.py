"""Validation Lab (Week 13): a founder's landing page with a waitlist, served from a separate origin.

Pages are structured blocks only (lab/blocks.py): no HTML, no scripts, no links from the founder, so a published page
can't carry stored XSS or phishing links. Respondents' emails are encrypted at the field level (lab/crypto.py), kept
for a fixed retention period and deleted after it. No IP addresses or cookies are stored; analytics are daily counts.
"""

from django.db import models
from django.utils import timezone

from projects.models import Project


class LabPage(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft"
        PUBLISHED = "published"
        UNPUBLISHED = "unpublished"

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="lab_pages")
    slug = models.SlugField(max_length=48, unique=True, null=True, blank=True)  # set when first published
    title = models.CharField(max_length=80)  # browser tab title and the founder's own label
    blocks = models.JSONField(default=list)  # validated by lab.blocks.validate_blocks
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT)
    retention_days = models.PositiveSmallIntegerField(default=180)  # sign-ups are deleted this long after joining
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]


class RetiredSlug(models.Model):
    """Addresses that were once live: never handed to anyone else, so links people kept can't be taken over."""

    slug = models.SlugField(max_length=48, unique=True)
    retired_at = models.DateTimeField(default=timezone.now)


class WaitlistSignup(models.Model):
    page = models.ForeignKey(LabPage, on_delete=models.CASCADE, related_name="signups")
    email_encrypted = models.TextField()  # Fernet token (never the plain address)
    email_hash = models.CharField(max_length=64)  # keyed HMAC of the normalised address, for dedupe only
    consent_version = models.CharField(max_length=20)
    consented_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(db_index=True)

    class Meta:
        ordering = ["-consented_at"]
        constraints = [models.UniqueConstraint(fields=["page", "email_hash"], name="one_signup_per_email_per_page")]


class LabDailyStat(models.Model):
    """First-party analytics: counts per page per day. No visitor ids, cookies or IPs."""

    page = models.ForeignKey(LabPage, on_delete=models.CASCADE, related_name="daily_stats")
    day = models.DateField()
    views = models.PositiveIntegerField(default=0)
    signups = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["day"]
        constraints = [models.UniqueConstraint(fields=["page", "day"], name="one_stat_row_per_page_day")]
