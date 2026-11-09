from django.db import models
from django.utils import timezone

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
    # Attribution, where the source's licence requires it (e.g. Stack Exchange, CC BY-SA).
    license = models.CharField(max_length=40, blank=True)
    author_name = models.CharField(max_length=120, blank=True)
    author_url = models.URLField(max_length=500, blank=True)
    content_hash = models.CharField(max_length=64, db_index=True)
    simhash = models.CharField(max_length=16, blank=True)  # 64-bit near-duplicate fingerprint (hex)
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
    job = models.ForeignKey(ResearchJob, on_delete=models.CASCADE, null=True, related_name="clusters")
    severity = models.CharField(max_length=10, blank=True)  # AI judgement, labelled as such in the UI
    confidence = models.CharField(max_length=10, blank=True)  # computed from evidence volume/diversity, not by AI
    ai_summary = models.TextField(blank=True)
    prompt_version = models.CharField(max_length=60, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    def distinct_sources(self) -> int:
        return self.evidence.filter(duplicate_of__isnull=True).values("source_url").distinct().count()
