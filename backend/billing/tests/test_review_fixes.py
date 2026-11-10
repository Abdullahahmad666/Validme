"""Regression tests for the Week 6 security review findings."""

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.services import issue_api_key
from analytics.models import AnalyticsEvent
from billing.models import Purchase
from billing.tests.test_billing import order, payments, post_hook  # noqa: F401 (payments is a fixture)
from projects.models import Project
from research.models import ResearchJob
from research.services import create_stages


@pytest.fixture
def pending(user, payments):  # noqa: F811
    return Purchase.objects.create(user=user, provider="lemonsqueezy", pack_id="starter", credits=6)


def refund_payload(p, refunded, status="refunded"):
    payload = order(p, order_id="55", event="order_refunded", status=status)
    payload["data"]["attributes"].update({"total": 1900, "refunded_amount": refunded})
    return payload


def test_full_refund_before_paid_event_grants_nothing(client, user, pending):
    before = user.credits
    assert post_hook(client, refund_payload(pending, 1900)).status_code == 200
    assert post_hook(client, order(pending, order_id="55")).status_code == 200  # late paid delivery
    user.refresh_from_db()
    pending.refresh_from_db()
    assert user.credits == before and pending.status == "refunded"


def test_partial_refund_before_paid_grants_only_the_rest(client, user, pending):
    before = user.credits
    post_hook(client, refund_payload(pending, 950, status="partial_refund"))
    post_hook(client, order(pending, order_id="55"))
    user.refresh_from_db()
    assert user.credits == before + 3


def test_paid_delivery_that_is_already_refunded_grants_nothing(client, user, pending):
    payload = order(pending, order_id="56", status="refunded")
    payload["data"]["attributes"].update({"total": 1900, "refunded_amount": 1900})
    before = user.credits
    post_hook(client, payload)
    user.refresh_from_db()
    assert user.credits == before


def test_refund_for_unknown_order_asks_for_retry(client, pending):
    payload = refund_payload(pending, 1900)
    payload["meta"]["custom_data"] = {}
    assert post_hook(client, payload).status_code == 409


def test_status_refunded_counts_as_full_even_if_amounts_differ(client, user, pending):
    post_hook(client, order(pending, order_id="57"))
    payload = order(pending, order_id="57", event="order_refunded", status="refunded")
    payload["data"]["attributes"].update({"total": 1900, "refunded_amount": 1800})
    post_hook(client, payload)
    pending.refresh_from_db()
    assert pending.status == "refunded" and pending.credits_refunded == 6


def test_non_ascii_signature_is_rejected_not_500(client, pending):
    r = client.post("/api/billing/webhooks/lemonsqueezy", b"{}", content_type="application/json", HTTP_X_SIGNATURE="éé")
    assert r.status_code == 401


def test_inactive_user_api_key_is_rejected(user):
    _, raw = issue_api_key(user, "mcp")
    user.is_active = False
    user.save()
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Api-Key {raw}")
    assert c.get("/api/projects").status_code in (401, 403)


def test_long_idempotency_key_is_400(api, user):
    p = Project.objects.create(owner=user, name="P")
    r = api.post("/api/research/jobs", {"project": str(p.id)}, format="json", HTTP_IDEMPOTENCY_KEY="k" * 81)
    assert r.status_code == 400


def test_recovered_job_is_not_overwritten_by_a_late_worker(user, monkeypatch):
    """Recovery fails + refunds a job; the still-running worker finishing later must not mark it completed."""
    from research import services, tasks
    from research.recovery import recover_stuck_jobs

    project = Project.objects.create(owner=user, name="P", status="RESEARCHING")
    job = ResearchJob.objects.create(project=project, idempotency_key="z", credits_charged=1, config_snapshot={})
    create_stages(job)

    def slow_collect(j):
        # Worker is mid-run when recovery fires.
        ResearchJob.objects.filter(pk=j.pk).update(started_at=timezone.now() - timedelta(hours=2))
        recover_stuck_jobs()
        assert not services._still_running(j)
        return j

    monkeypatch.setattr(tasks, "collect_evidence", slow_collect)
    tasks.run_research_job.apply(args=[str(job.id)])
    job.refresh_from_db()
    assert job.status == "FAILED"
    # A recovered job is never restarted by a redelivered task.
    tasks.run_research_job.apply(args=[str(job.id)])
    job.refresh_from_db()
    assert job.status == "FAILED"


def test_anonymous_analytics_daily_cap(client, db, settings):
    settings.ANALYTICS_ANON_DAILY_CAP = 2
    from django.core.cache import cache

    cache.clear()
    for _ in range(4):
        client.post("/api/analytics/events", {"event": "pricing_viewed"}, content_type="application/json")
    assert AnalyticsEvent.objects.count() == 2
