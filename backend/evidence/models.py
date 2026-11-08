from django.db import models

from projects.models import Project
from research.models import ResearchJob


class Category(models.TextChoices):
    PAIN_POINT = "pain_point"
    FEATURE_REQUEST = "feature_request"
    ALTERNATIVE_SEEKING = "alternative_seeking"
    PRICING_OBJECTION = "pricing_objection"
    BUYING_INTENT = "buying_intent"
    WORKAROUND = "workaround"
    POSITIVE_FEEDBACK = "positive_feedback"
    IRRELEVANT = "irrelevant"
    UNCLASSIFIED = "unclassified"


class Evidence(models.Model):
    """A verbatim record from a source. Never store LLM-written text in `excerpt`."""

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="evidence")
    job = models.ForeignKey(ResearchJob, on_delete=models.SET_NULL, null=True, related_name="evidence")
    provider = models.CharField(max_length=40)
    source_url = models.URLField(max_length=1000)
    title = models.CharField(max_length=300, blank=True)
    excerpt = models.TextField(max_length=1000)
    published_at = models.DateField(null=True, blank=True)
    retrieved_at = models.DateTimeField()
    author_hash = models.CharField(max_length=64, blank=True)
    content_hash = models.CharField(max_length=64, db_index=True)
    duplicate_of = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True)
    # classification (AI) — kept separate from the source fields above
    category = models.CharField(max_length=24, choices=Category.choices, default=Category.UNCLASSIFIED)
    relevance = models.FloatField(null=True, blank=True)
    classifier_version = models.CharField(max_length=40, blank=True)
    saved_by_user = models.BooleanField(default=False)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["project", "source_url", "content_hash"], name="unique_evidence")]


class EvidenceCluster(models.Model):
    """A pain point / theme supported by one or more evidence records."""

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="clusters")
    name = models.CharField(max_length=160)
    category = models.CharField(max_length=24, choices=Category.choices)
    evidence = models.ManyToManyField(Evidence, related_name="clusters")
    severity = models.CharField(max_length=10, blank=True)
    confidence = models.CharField(max_length=10, blank=True)
    ai_summary = models.TextField(blank=True)

    def distinct_sources(self) -> int:
        return self.evidence.filter(duplicate_of__isnull=True).values("source_url").distinct().count()
