from django.conf import settings
from django.db import models


class UsageTransaction(models.Model):
    """Ledger of credit changes and real provider cost. Positive credits = grant, negative = spend."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="usage")
    operation = models.CharField(max_length=40)  # signup_grant | purchase | research_job | refund
    credits = models.IntegerField()
    cost_usd = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    job = models.ForeignKey("research.ResearchJob", on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
