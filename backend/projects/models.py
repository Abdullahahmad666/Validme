import uuid

from django.conf import settings
from django.db import models


class Project(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT"
        RESEARCHING = "RESEARCHING"
        COMPLETED = "COMPLETED"
        ARCHIVED = "ARCHIVED"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="projects")
    name = models.CharField(max_length=80)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self) -> str:
        return self.name


class IdeaDefinition(models.Model):
    """The founder's original words are never overwritten; AI interpretation is stored separately."""

    project = models.OneToOneField(Project, on_delete=models.CASCADE, related_name="idea")
    original_description = models.TextField()
    objectives = models.JSONField(default=list)
    existing_product_url = models.URLField(blank=True)
    additional_context = models.TextField(blank=True)
    ai_interpretation = models.JSONField(default=dict, blank=True)  # problem, solution, customers, assumptions
    ai_prompt_version = models.CharField(max_length=40, blank=True)
    user_confirmed = models.BooleanField(default=False)


class MarketProfile(models.Model):
    class CustomerType(models.TextChoices):
        B2B = "B2B"
        B2C = "B2C"
        B2B2C = "B2B2C"

    project = models.OneToOneField(Project, on_delete=models.CASCADE, related_name="market")
    industry = models.CharField(max_length=120, blank=True)
    customer_type = models.CharField(max_length=6, choices=CustomerType.choices, blank=True)
    audiences = models.JSONField(default=list)
    geographies = models.JSONField(default=list)
    business_stage = models.CharField(max_length=20, blank=True)
    current_alternatives = models.TextField(blank=True)
    price_hypothesis = models.CharField(max_length=120, blank=True)
    ai_suggested_fields = models.JSONField(default=list)  # names of fields still unconfirmed AI suggestions


class ResearchConfig(models.Model):
    """Wizard step 3: what to research. Snapshotted onto the ResearchJob when it's submitted."""

    project = models.OneToOneField(Project, on_delete=models.CASCADE, related_name="config")
    sources = models.JSONField(default=list, blank=True)  # provider keys; empty = all available
    depth = models.CharField(max_length=10, default="standard")
    competitor_discovery = models.BooleanField(default=True)
    competitor_urls = models.JSONField(default=list, blank=True)  # ≤ 10 user-provided competitor sites
    evidence_urls = models.JSONField(default=list, blank=True)  # ≤ 10 threads/reviews the user found
    competitor_aspects = models.JSONField(default=list, blank=True)  # features, pricing, audience, ...
    exclude_terms = models.JSONField(default=list, blank=True)  # appended as -term to search queries
    updated_at = models.DateTimeField(auto_now=True)
