"""Distribution data v2 (Week 12): where an audience gathers (YouTube) and how many people search (keyword demand).

Kept apart from Evidence and from report snapshots on purpose:
- YouTube API data (titles, statistics) may be stored for at most 30 days (YouTube API Services Developer Policies
  III.E.4), so every row has `expires_at` and is deleted after it. It's never copied into reports or evidence, never
  combined into a score, and always shown as "from YouTube" with the date we read it.
- Keyword metrics come from a licensed provider (DataForSEO); cached 30 days per project, then re-fetched on request.
"""

from django.conf import settings
from django.db import models
from django.utils import timezone

from projects.models import Project


class YouTubeChannel(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="youtube_channels")
    channel_id = models.CharField(max_length=64)
    # From YouTube, as returned (never recomputed):
    title = models.CharField(max_length=200)
    subscriber_count = models.BigIntegerField(null=True, blank=True)  # None = hidden or not given
    subscribers_hidden = models.BooleanField(default=False)  # the channel chose to hide it
    video_count = models.BigIntegerField(null=True, blank=True)
    latest_video_id = models.CharField(max_length=32, blank=True)
    latest_video_title = models.CharField(max_length=300, blank=True)
    latest_video_at = models.DateTimeField(null=True, blank=True)
    # Ours: which of the project's searches surfaced this channel (not YouTube data).
    matched_queries = models.JSONField(default=list)
    fetched_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(db_index=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["project", "channel_id"], name="one_youtube_channel_per_project")]


class KeywordMetric(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="keyword_metrics")
    keyword = models.CharField(max_length=100)
    location_code = models.IntegerField()
    language_code = models.CharField(max_length=8)
    # From the provider, as returned; None = the provider has no figure for this keyword ("unavailable").
    search_volume = models.IntegerField(null=True, blank=True)  # average monthly searches
    cpc = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)  # USD
    competition = models.CharField(max_length=10, blank=True)  # LOW / MEDIUM / HIGH (paid search)
    difficulty = models.IntegerField(null=True, blank=True)  # 0–100 (organic)
    monthly = models.JSONField(default=list)  # [{"year", "month", "volume"}], oldest first
    source = models.CharField(max_length=20, default="dataforseo")
    fetched_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["project", "keyword", "location_code", "language_code"], name="one_keyword_metric")
        ]


class ProviderCall(models.Model):
    """One look-up against a distribution provider: what ran, what it cost and how it went (coverage, rule 4)."""

    class Status(models.TextChoices):
        OK = "OK"
        LIMITED = "LIMITED"  # partly done (allowance, quota or one call failing)
        FAILED = "FAILED"
        REQUIRES_CONNECTION = "REQUIRES_CONNECTION"
        SKIPPED = "SKIPPED"  # nothing to do (checked recently, nothing to look up)

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    # SET_NULL: deleting a project must not erase the usage that allowances and budgets are counted from.
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, related_name="+")
    provider = models.CharField(max_length=20)  # youtube | dataforseo
    status = models.CharField(max_length=20, choices=Status.choices)
    note = models.CharField(max_length=200, blank=True)
    units = models.IntegerField(default=0)  # YouTube quota units, or keywords looked up
    cost_usd = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    details = models.JSONField(default=dict, blank=True)  # e.g. {"searches": [...]} the YouTube searches that ran
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        indexes = [models.Index(fields=["provider", "created_at"]), models.Index(fields=["project", "provider", "-created_at"])]
