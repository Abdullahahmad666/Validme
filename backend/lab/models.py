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
    variant = models.PositiveSmallIntegerField(null=True, blank=True)  # price-test variant the person saw (0 = A)

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


class LabVariantStat(models.Model):
    """Price test (Week 14): counts per pricing variant per day. Views and sign-ups are attributed to the variant the
    visitor was shown; clicks are "choose this price" presses. No visitor ids."""

    page = models.ForeignKey(LabPage, on_delete=models.CASCADE, related_name="variant_stats")
    # Fingerprint of the variants' prices (lab.blocks.price_test). Changing, adding or removing a variant starts a new
    # test, so counts are never shown next to prices other than the ones people saw.
    test_key = models.CharField(max_length=16, default="")
    variant = models.PositiveSmallIntegerField()  # 0 = A (the pricing block's own items), 1 = B, 2 = C
    day = models.DateField()
    views = models.PositiveIntegerField(default=0)
    clicks = models.PositiveIntegerField(default=0)
    signups = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["variant", "day"]
        constraints = [models.UniqueConstraint(fields=["page", "test_key", "variant", "day"], name="one_variant_row_per_day")]


class Survey(models.Model):
    """Week 14: a short survey on the pages origin. Questions are structured (lab/surveys.py), never HTML."""

    class Status(models.TextChoices):
        DRAFT = "draft"
        PUBLISHED = "published"
        CLOSED = "closed"  # still at its address, says it's closed, takes no answers
        UNPUBLISHED = "unpublished"

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="lab_surveys")
    slug = models.SlugField(max_length=48, unique=True, null=True, blank=True)
    title = models.CharField(max_length=80)
    intro = models.CharField(max_length=400, blank=True)
    questions = models.JSONField(default=list)  # validated by lab.surveys.validate_questions
    ask_email = models.BooleanField(default=False)  # optional email field (encrypted), e.g. for follow-up interviews
    # Week 15: question ids whose "supporting answers" rule was set or changed after people had answered. The verdict
    # says so, because a rule chosen after seeing results is weaker evidence.
    late_rules = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT)
    retention_days = models.PositiveSmallIntegerField(default=180)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]


class SurveyResponse(models.Model):
    """One person's answers. Choice and scale answers are stored as option indexes / numbers; anything typed (free text,
    email) is encrypted because people may write personal details there."""

    survey = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name="responses")
    answers = models.JSONField(default=dict)  # {question_id: int | [int] | null} for choice and scale questions
    text_encrypted = models.TextField(blank=True)  # Fernet token of JSON {question_id: text}
    email_encrypted = models.TextField(blank=True)
    email_hash = models.CharField(max_length=64, blank=True, db_index=True)  # only when an email was given
    consent_version = models.CharField(max_length=20)
    submitted_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(db_index=True)

    class Meta:
        ordering = ["-submitted_at"]


class SurveyDailyStat(models.Model):
    survey = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name="daily_stats")
    day = models.DateField()
    views = models.PositiveIntegerField(default=0)
    responses = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["day"]
        constraints = [models.UniqueConstraint(fields=["survey", "day"], name="one_stat_row_per_survey_day")]


class DataRequest(models.Model):
    """A respondent's confirmed request (copy or delete) for what Lab holds under their email. Stores no address:
    only what was done and when, so we can show it was handled."""

    class Kind(models.TextChoices):
        COPY = "copy"
        DELETE = "delete"

    kind = models.CharField(max_length=10, choices=Kind.choices)
    signups = models.PositiveIntegerField(default=0)
    responses = models.PositiveIntegerField(default=0)
    completed_at = models.DateTimeField(default=timezone.now)


class DataRequestNotice(models.Model):
    """Tells a founder that a respondent had their data deleted, so they also delete it from any export they made."""

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="lab_data_notices")
    source = models.CharField(max_length=80)  # the page or survey title at the time
    removed = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(default=timezone.now)
    seen = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
