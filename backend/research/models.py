import uuid

from django.db import models

from projects.models import Project


class ResearchJob(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING"
        RUNNING = "RUNNING"
        COMPLETED = "COMPLETED"
        PARTIALLY_COMPLETED = "PARTIALLY_COMPLETED"
        FAILED = "FAILED"
        CANCELLED = "CANCELLED"

    class Depth(models.TextChoices):
        QUICK = "quick"
        STANDARD = "standard"
        DEEP = "deep"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="jobs")
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.PENDING)
    depth = models.CharField(max_length=10, choices=Depth.choices, default=Depth.STANDARD)
    idempotency_key = models.CharField(max_length=80)
    config_snapshot = models.JSONField(default=dict)  # exact sources/queries/competitors used
    coverage = models.JSONField(default=dict)  # provider_key -> COMPLETED | FAILED | UNAVAILABLE | SKIPPED
    credits_charged = models.PositiveIntegerField(default=0)
    cost_usd = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["project", "idempotency_key"], name="unique_job_per_idempotency_key")]


class JobStage(models.Model):
    class Status(models.TextChoices):
        QUEUED = "QUEUED"
        PROCESSING = "PROCESSING"
        COMPLETED = "COMPLETED"
        FAILED = "FAILED"
        SKIPPED = "SKIPPED"

    job = models.ForeignKey(ResearchJob, on_delete=models.CASCADE, related_name="stages")
    name = models.CharField(max_length=40)
    order = models.PositiveSmallIntegerField()
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.QUEUED)
    detail = models.CharField(max_length=255, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["order"]


class ResearchQuery(models.Model):
    class Intent(models.TextChoices):
        PROBLEM_DISCOVERY = "problem_discovery"
        BUYING_INTENT = "buying_intent"
        COMPETITOR_GAPS = "competitor_gaps"
        CUSTOMER_ACQUISITION = "customer_acquisition"

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="queries")
    text = models.CharField(max_length=200)
    intent = models.CharField(max_length=24, choices=Intent.choices)
    enabled = models.BooleanField(default=True)
    ai_generated = models.BooleanField(default=True)
    user_modified = models.BooleanField(default=False)


class SearchCache(models.Model):
    provider = models.CharField(max_length=40)
    query_hash = models.CharField(max_length=64)
    payload = models.JSONField()
    fetched_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["provider", "query_hash"], name="unique_cache_entry")]
