from django.db import models

from evidence.models import Evidence
from projects.models import Project


class Competitor(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="competitors")
    name = models.CharField(max_length=160)
    website = models.URLField()
    kind = models.CharField(max_length=10, default="direct")  # direct | indirect | alternative
    positioning = models.TextField(blank=True)
    pricing = models.JSONField(default=dict, blank=True)  # {"plans": [...], "verified": bool, "source_url", "retrieved_at"}
    features = models.JSONField(default=list, blank=True)
    identified_gap = models.TextField(blank=True)
    evidence = models.ManyToManyField(Evidence, blank=True, related_name="competitors")


class Opportunity(models.Model):
    project = models.OneToOneField(Project, on_delete=models.CASCADE, related_name="opportunity")
    score = models.PositiveSmallIntegerField()
    confidence = models.CharField(max_length=10)  # low | medium | high
    dimensions = models.JSONField(default=list)  # [{key, weight, score, confidence, evidence_ids, explanation}]
    assumptions = models.JSONField(default=list)
    risks = models.JSONField(default=list)
    market_size = models.JSONField(default=dict)  # calculation + sources, or {"status": "unavailable"}
    recommendation = models.CharField(max_length=20)  # build | research_more | pivot | stop


class ChannelRecommendation(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="channels")
    channel = models.CharField(max_length=160)
    audience = models.CharField(max_length=160, blank=True)
    recommendation = models.TextField()
    relevance = models.CharField(max_length=12, blank=True)
    is_hypothesis = models.BooleanField(default=False)
    evidence = models.ManyToManyField(Evidence, blank=True, related_name="channels")


class Report(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="reports")
    job = models.OneToOneField("research.ResearchJob", on_delete=models.SET_NULL, null=True)
    content = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
