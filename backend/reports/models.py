from django.db import models
from django.utils import timezone

from evidence.models import Evidence
from projects.models import Project


class Competitor(models.Model):
    """A competitor profile. Facts come from the competitor's own page (dated) or from cited evidence."""

    class Kind(models.TextChoices):
        LISTED = "listed"  # the founder gave us its website
        MENTIONED = "mentioned"  # named in the collected evidence

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="competitors")
    job = models.ForeignKey("research.ResearchJob", on_delete=models.CASCADE, null=True, related_name="competitors")
    name = models.CharField(max_length=160)
    website = models.URLField(blank=True)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.LISTED)
    positioning = models.TextField(blank=True)  # the page's own words (meta description / excerpt)
    audience = models.CharField(max_length=200, blank=True)  # AI-extracted from the page
    features = models.JSONField(default=list, blank=True)  # AI-extracted from the page
    # {"status": "verified" | "unavailable", "plans": [{"name", "price", "period"}], "source_url", "retrieved_at"}
    # A plan is kept only if its price text appears verbatim on the fetched page.
    pricing = models.JSONField(default=dict, blank=True)
    complaints = models.JSONField(default=list, blank=True)  # [evidence_id] of pain-type evidence naming it
    identified_gap = models.TextField(blank=True)  # AI summary of cited complaints only; "" = unavailable
    evidence = models.ManyToManyField(Evidence, blank=True, related_name="competitors")
    extraction_version = models.CharField(max_length=60, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["kind", "name"]


class Opportunity(models.Model):
    project = models.OneToOneField(Project, on_delete=models.CASCADE, related_name="opportunity")
    score = models.PositiveSmallIntegerField(null=True)  # null = not enough evidence to score at all
    confidence = models.CharField(max_length=10)  # low | medium | high
    dimensions = models.JSONField(default=list)  # [{key, label, weight, score|null, confidence, evidence_ids, explanation}]
    assumptions = models.JSONField(default=list)  # [{text, source: "founder" | "ai"}]
    risks = models.JSONField(default=list)
    market_size = models.JSONField(default=dict)  # calculation + sources, or {"status": "unavailable", "reason"}
    recommendation = models.CharField(max_length=20)  # build | research_more | pivot
    what_would_change = models.JSONField(default=list)
    scoring_version = models.CharField(max_length=20, blank=True)
    updated_at = models.DateTimeField(auto_now=True)


class ChannelRecommendation(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="channels")
    channel = models.CharField(max_length=160)
    audience = models.CharField(max_length=160, blank=True)
    recommendation = models.TextField()
    relevance = models.CharField(max_length=12, blank=True)
    is_hypothesis = models.BooleanField(default=False)
    evidence = models.ManyToManyField(Evidence, blank=True, related_name="channels")


class Report(models.Model):
    """Snapshot of everything a report shows, built when a job finishes, so history stays stable."""

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="reports")
    job = models.OneToOneField("research.ResearchJob", on_delete=models.SET_NULL, null=True)
    content = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
