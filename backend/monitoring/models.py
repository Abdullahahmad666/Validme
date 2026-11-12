"""Continuous competitor monitoring (v2, ADR-2): watches → observations → changes.

Diff first, AI last: a page is re-fetched on its cadence with conditional requests; nothing is stored or
compared unless the content hash changed; changes are computed deterministically (prices, text blocks).
"""

from django.db import models

from projects.models import Project


class Watch(models.Model):
    class Cadence(models.TextChoices):
        DAILY = "daily"
        WEEKLY = "weekly"

    class Status(models.TextChoices):
        PENDING = "pending"  # never checked
        BASELINE = "baseline"  # first successful read stored
        UNCHANGED = "unchanged"
        CHANGED = "changed"
        ERROR = "error"
        BLOCKED = "blocked"  # robots.txt or non-public address: not fetched on purpose
        PAUSED = "paused"  # too many errors in a row

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="watches")
    competitor = models.ForeignKey("reports.Competitor", on_delete=models.SET_NULL, null=True, blank=True, related_name="watches")
    url = models.URLField(max_length=500)
    label = models.CharField(max_length=120, blank=True)
    cadence = models.CharField(max_length=10, choices=Cadence.choices, default=Cadence.WEEKLY)
    active = models.BooleanField(default=True)
    next_run_at = models.DateTimeField()
    last_checked_at = models.DateTimeField(null=True, blank=True)
    last_status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    last_error = models.CharField(max_length=200, blank=True)  # user-safe text only (no URLs with keys, no traces)
    consecutive_errors = models.PositiveSmallIntegerField(default=0)
    # HTTP validators + content hash of the last stored observation (conditional GET, cheap "unchanged").
    etag = models.CharField(max_length=200, blank=True)
    last_modified = models.CharField(max_length=100, blank=True)
    last_hash = models.CharField(max_length=64, blank=True)
    # Set by the scheduler when it claims the watch; only the task holding it may run the check.
    lease_token = models.CharField(max_length=32, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]
        constraints = [models.UniqueConstraint(fields=["project", "url"], name="unique_watch_url")]
        indexes = [models.Index(fields=["active", "next_run_at"])]  # the scheduler's only query


class Observation(models.Model):
    """A stored read of a watched page. Only written when the content differs from the last one."""

    watch = models.ForeignKey(Watch, on_delete=models.CASCADE, related_name="observations")
    fetched_at = models.DateTimeField()
    final_url = models.URLField(max_length=500)
    content_hash = models.CharField(max_length=64)
    text = models.TextField(max_length=20000)  # visible text blocks, newline-separated, capped

    class Meta:
        ordering = ["-fetched_at", "-id"]
        indexes = [models.Index(fields=["watch", "-fetched_at"])]


class Change(models.Model):
    """What changed between two observations, computed deterministically (no AI)."""

    class Kind(models.TextChoices):
        PRICING = "pricing"
        CONTENT = "content"

    class Significance(models.TextChoices):
        HIGH = "high"
        MEDIUM = "medium"
        LOW = "low"

    watch = models.ForeignKey(Watch, on_delete=models.CASCADE, related_name="changes")
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="changes")  # for project feeds
    before = models.ForeignKey(Observation, on_delete=models.SET_NULL, null=True, related_name="+")
    after = models.ForeignKey(Observation, on_delete=models.SET_NULL, null=True, related_name="+")
    kind = models.CharField(max_length=10, choices=Kind.choices)
    significance = models.CharField(max_length=10, choices=Significance.choices)
    summary = models.CharField(max_length=300)
    details = models.JSONField(default=dict)  # prices_added/removed, blocks_added/removed (capped)
    detected_at = models.DateTimeField()
    seen = models.BooleanField(default=False)

    class Meta:
        ordering = ["-detected_at", "-id"]
        indexes = [models.Index(fields=["project", "-detected_at"])]
