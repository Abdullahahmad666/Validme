"""Opportunity Radar (Week 11): signals found in data we already store, plus score snapshots over time.

A Signal is never invented: every one points at its sources (evidence records, a detected competitor change, or a
competitor candidate the founder confirmed). Relevance, impact and confidence are computed from those sources by
fixed rules (radar/generators.py). The AI writes only `ai_rationale` / `ai_action`, kept apart and labelled.
"""

from django.db import models
from django.utils import timezone

from evidence.models import Evidence
from projects.models import Project


class Signal(models.Model):
    class Kind(models.TextChoices):
        COMPLAINT_THEME = "complaint_theme"
        COMPETITOR_CHANGE = "competitor_change"
        DISCUSSION_TREND = "discussion_trend"
        NEW_COMPETITOR = "new_competitor"

    class Type(models.TextChoices):
        OPPORTUNITY = "opportunity"
        RISK = "risk"
        TREND = "trend"

    class Status(models.TextChoices):
        NEW = "new"
        SEEN = "seen"
        DISMISSED = "dismissed"
        ACTED = "acted"

    class Feedback(models.TextChoices):
        NONE = ""
        USEFUL = "useful"
        NOT_USEFUL = "not_useful"

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="signals")
    kind = models.CharField(max_length=24, choices=Kind.choices)
    type = models.CharField(max_length=12, choices=Type.choices)
    # Stable identity of what was found (e.g. "theme:manual stock counts", "change:42"): never suggested twice,
    # even after a dismissal or a re-run that rebuilds clusters with new ids.
    key = models.CharField(max_length=160)
    title = models.CharField(max_length=200)
    facts = models.JSONField(default=dict)  # deterministic: counts, windows, dates, what the source says
    # Sources (at least one is always set; a signal disappears with its change or candidate).
    evidence = models.ManyToManyField(Evidence, blank=True, related_name="signals")
    change = models.ForeignKey("monitoring.Change", on_delete=models.CASCADE, null=True, blank=True, related_name="signals")
    candidate = models.ForeignKey(
        "monitoring.CompetitorCandidate", on_delete=models.CASCADE, null=True, blank=True, related_name="signals"
    )
    # Computed by rules, 0..1 (relevance, impact) and low/medium/high (confidence). Never by AI.
    relevance = models.FloatField()
    impact = models.FloatField()
    confidence = models.CharField(max_length=8)
    rank = models.FloatField(db_index=True)  # relevance × impact
    # AI conclusion (optional, labelled): why it may matter and one suggested action.
    ai_rationale = models.CharField(max_length=400, blank=True)
    ai_action = models.CharField(max_length=240, blank=True)
    ai_version = models.CharField(max_length=60, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.NEW)
    feedback = models.CharField(max_length=12, choices=Feedback.choices, blank=True, default="")
    discovered_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-rank", "-discovered_at"]
        constraints = [models.UniqueConstraint(fields=["project", "key"], name="one_signal_per_key")]
        indexes = [models.Index(fields=["project", "status", "-rank"], name="signal_feed_idx")]


class ScoreSnapshot(models.Model):
    """The opportunity score at a point in time: from a report, or from a revalidation of stored evidence."""

    class Source(models.TextChoices):
        REPORT = "report"
        REVALIDATION = "revalidation"

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="score_snapshots")
    report = models.ForeignKey("reports.Report", on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    source = models.CharField(max_length=14, choices=Source.choices)
    score = models.IntegerField(null=True, blank=True)  # None = not enough evidence to score (never 0)
    confidence = models.CharField(max_length=8, blank=True)
    recommendation = models.CharField(max_length=20, blank=True)
    dimensions = models.JSONField(default=dict)  # {key: score | None}
    evidence_count = models.IntegerField(default=0)
    scoring_version = models.CharField(max_length=20, blank=True)  # points from different rules aren't comparable
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["project", "-created_at"], name="snapshot_history_idx")]
