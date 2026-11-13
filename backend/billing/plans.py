"""Plan limits, enforced server-side at launch. The frontend only mirrors them for display."""

from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from billing.models import Purchase


class PlanLimit(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def active_subscription(user):
    """The subscription that currently grants access, if any (cancelled ones keep access until ends_at)."""
    from django.db.models import Q

    from billing.models import Subscription

    now = timezone.now()
    return (
        Subscription.objects.filter(user=user)
        .filter(Q(status__in=Subscription.ENTITLED) | Q(status="cancelled", ends_at__gt=now))
        .order_by("-updated_at")
        .first()
    )


def plan_for(user) -> str:
    """founder / pro with an entitling subscription; "paid" with a paid (not refunded) credit pack; else "free"."""
    sub = active_subscription(user)
    if sub and sub.plan in settings.PLAN_LIMITS:
        return sub.plan
    return "paid" if Purchase.objects.filter(user=user, status=Purchase.Status.PAID).exists() else "free"


def limits_for(user) -> dict:
    plan = plan_for(user)
    return {"plan": plan, **settings.PLAN_LIMITS[plan]}


def monitoring_limits(user) -> dict:
    """Watches per account and allowed cadences, by plan (Week 9 entitlements v1, subscriptions in Week 10)."""
    lim = settings.PLAN_LIMITS[plan_for(user)]
    return {"max_watches": lim.get("max_watches", 3), "cadences": lim.get("cadences", ["weekly"])}


def check_launch(user, depth: str) -> None:
    """Raise PlanLimit when this user can't start a job at this depth right now."""
    from research.models import ResearchJob  # local: research imports billing

    lim = limits_for(user)
    if depth not in lim["depths"]:
        raise PlanLimit(
            "plan_depth",
            f"{depth.capitalize()} depth needs a credit pack or a paid plan. Free accounts can run Quick research.",
        )
    running = ResearchJob.objects.filter(
        project__owner=user, status__in=(ResearchJob.Status.PENDING, ResearchJob.Status.RUNNING)
    ).count()
    if running >= lim["max_running"]:
        raise PlanLimit(
            "too_many_running",
            f"You already have {running} research job{'s' if running != 1 else ''} running. Wait for one to finish.",
        )
    today = ResearchJob.objects.filter(project__owner=user, created_at__gte=timezone.now() - timedelta(days=1)).count()
    if today >= lim["daily_launches"]:
        raise PlanLimit("daily_limit", "You've reached today's research limit. Try again tomorrow.")
