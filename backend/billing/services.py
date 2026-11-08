from django.conf import settings
from django.db import transaction

from accounts.models import User
from billing.models import UsageTransaction


class InsufficientCredits(Exception):
    pass


def credits_for(depth: str) -> int:
    return settings.CREDITS_PER_DEPTH[depth]


@transaction.atomic
def spend_credits(user: User, amount: int, operation: str, job=None) -> None:
    locked = User.objects.select_for_update().get(pk=user.pk)
    if locked.credits < amount:
        raise InsufficientCredits(f"Needs {amount} credits, {locked.credits} available.")
    locked.credits -= amount
    locked.save(update_fields=["credits"])
    UsageTransaction.objects.create(user=locked, operation=operation, credits=-amount, job=job)
    user.credits = locked.credits


@transaction.atomic
def grant_credits(user: User, amount: int, operation: str) -> None:
    """Add credits and record the grant in the ledger (signup_grant, purchase, refund)."""
    if amount <= 0:
        return
    locked = User.objects.select_for_update().get(pk=user.pk)
    locked.credits += amount
    locked.save(update_fields=["credits"])
    UsageTransaction.objects.create(user=locked, operation=operation, credits=amount)
    user.credits = locked.credits
