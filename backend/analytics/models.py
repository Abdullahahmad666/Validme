from django.conf import settings
from django.db import models


class AnalyticsEvent(models.Model):
    """First-party product analytics. No third-party tracker, no IP or user agent stored.

    `props` holds small, non-personal values only (ids of our own objects, plan, depth, counts).
    """

    name = models.CharField(max_length=40)
    source = models.CharField(max_length=10)  # server | client
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    path = models.CharField(max_length=200, blank=True)
    props = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["name", "-created_at"])]
