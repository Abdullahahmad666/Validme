from django.conf import settings
from django.db import models


class Notification(models.Model):
    """In-app notice for one user. Text is built by us from stored data (no third-party HTML);
    `link` is always an internal app path."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, null=True, blank=True, related_name="+")
    kind = models.CharField(max_length=30)  # competitor_change | ...
    title = models.CharField(max_length=160)
    body = models.CharField(max_length=300, blank=True)
    link = models.CharField(max_length=200, blank=True)
    # Dedupe key: one notice per source object (e.g. "change:<id>"), so retries never double-notify.
    source = models.CharField(max_length=60, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["user", "read_at", "-created_at"])]
