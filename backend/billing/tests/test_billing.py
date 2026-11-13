"""Week 6: purchases via signed webhooks, plan limits, refunds, job recovery, analytics, JSON errors."""

import hashlib
import hmac
import json
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.services import issue_api_key
from analytics.models import AnalyticsEvent
from billing.models import Purchase, UsageTransaction
from billing.providers import lemonsqueezy
from projects.models import Project
from research.models import JobStage, ResearchJob
from research.recovery import recover_stuck_jobs
from research.services import create_stages

SECRET = "whsec-test"
PACK = {"id": "starter", "credits": 6, "variant_id": "111"}
REAL_LIMITS = {
    "free": {"depths": ["quick"], "max_running": 1, "daily_launches": 3},
    "paid": {"depths": ["quick", "standard", "deep"], "max_running": 3, "daily_launches": 20},
}
IDEA = "A stock counting app for small independent restaurants that replaces clipboards and spreadsheets."


@pytest.fixture
def payments(settings):
    settings.LEMONSQUEEZY_API_KEY = "test-api-key"
    settings.LEMONSQUEEZY_STORE_ID = "1"
    settings.LEMONSQUEEZY_WEBHOOK_SECRET = SECRET
    settings.LEMONSQUEEZY_TEST_MODE = True
    settings.CREDIT_PACKS = [PACK]


def post_hook(client, payload, secret=SECRET):
    raw = json.dumps(payload).encode()
    sig = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    return client.post("/api/billing/webhooks/lemonsqueezy", raw, content_type="application/json", HTTP_X_SIGNATURE=sig)


def order(purchase, *, order_id="9001", event="order_created", status="paid", variant="111", user_id=None, test_mode=True):
    return {
        "meta": {
            "event_name": event,
            "test_mode": test_mode,
            "custom_data": {"purchase_id": str(purchase.id), "user_id": str(user_id or purchase.user_id)},
        },
        "data": {
            "type": "orders",
            "id": order_id,
            "attributes": {"status": status, "first_order_item": {"variant_id": int(variant)}},
        },
    }


@pytest.fixture
def purchase(user, payments):
    return Purchase.objects.create(user=user, provider="lemonsqueezy", pack_id="starter", credits=6)


def test_webhook_rejects_bad_signature(client, purchase):
    assert post_hook(client, order(purchase), secret="wrong").status_code == 401
    purchase.refresh_from_db()
    assert purchase.status == "pending"


def test_paid_order_credits_once_even_when_replayed(client, purchase, user):
    before = user.credits
    assert post_hook(client, order(purchase)).status_code == 200
    assert post_hook(client, order(purchase)).status_code == 200  # provider retry
    user.refresh_from_db()
    purchase.refresh_from_db()
    assert user.credits == before + 6 and purchase.status == "paid" and purchase.provider_order_id == "9001"
    assert UsageTransaction.objects.filter(user=user, operation="purchase").count() == 1
    assert AnalyticsEvent.objects.filter(name="purchase_completed", user=user).exists()


@pytest.mark.parametrize(
    "overrides",
    [{"variant": "222"}, {"user_id": "999999"}, {"test_mode": False}, {"status": "pending"}],
)
def test_suspicious_orders_grant_nothing(client, purchase, user, overrides):
    before = user.credits
    assert post_hook(client, order(purchase, **overrides)).status_code == 200
    user.refresh_from_db()
    assert user.credits == before and Purchase.objects.get(pk=purchase.pk).status == "pending"


def test_refund_takes_back_unspent_credits_once(client, purchase, user):
    post_hook(client, order(purchase))
    user.refresh_from_db()
    user.credits = 4  # spent some of the pack
    user.save()
    for _ in range(2):
        post_hook(client, order(purchase, event="order_refunded", status="refunded"))
    user.refresh_from_db()
    assert user.credits == 0 and Purchase.objects.get(pk=purchase.pk).status == "refunded"
    assert UsageTransaction.objects.get(operation="purchase_refund").credits == -4


def test_checkout_closed_without_configuration(api):
    r = api.post("/api/billing/checkout", {"pack": "starter"}, format="json")
    assert r.status_code == 503 and r.json()["error"]["code"] == "payments_unavailable"


def test_checkout_creates_pending_purchase(api, user, payments, monkeypatch):
    seen = {}

    def fake_checkout(**kw):
        seen.update(kw)
        return "chk_1", "https://store.lemonsqueezy.com/checkout/custom/abc"

    monkeypatch.setattr(lemonsqueezy, "create_checkout", fake_checkout)
    r = api.post("/api/billing/checkout", {"pack": "starter"}, format="json")
    assert r.status_code == 200 and r.json()["url"].startswith("https://")
    p = Purchase.objects.get(user=user)
    assert (
        p.status == "pending"
        and seen["custom"]["purchase_id"] == p.id
        and seen["custom"]["kind"] == "pack"
        and seen["variant_id"] == "111"
    )
    assert api.post("/api/billing/checkout", {"pack": "nope"}, format="json").status_code == 400


def test_api_keys_cannot_buy(user, payments):
    _, raw = issue_api_key(user, "mcp")
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Api-Key {raw}")
    assert c.post("/api/billing/checkout", {"pack": "starter"}, format="json").status_code == 403


def test_packs_hide_provider_ids(api, payments, monkeypatch):
    monkeypatch.setattr(lemonsqueezy, "price_label", lambda v: "19.00 USD")
    body = api.get("/api/billing/packs").json()
    assert body["payments_available"] and body["packs"] == [{"id": "starter", "credits": 6, "price": "19.00 USD"}]
    assert "111" not in json.dumps(body) and body["limits"]["plan"] == "free"


def test_usage_is_own_and_has_no_costs(api, other_api, user):
    UsageTransaction.objects.create(user=user, operation="signup_grant", credits=1)
    UsageTransaction.objects.create(user=user, operation="ai_interpret", credits=0, cost_usd="0.0300")
    body = api.get("/api/billing/usage").json()
    assert [r["operation"] for r in body["results"]] == ["signup_grant"]
    assert "cost_usd" not in json.dumps(body)
    assert other_api.get("/api/billing/usage").json()["count"] == 0


# --- Plan limits ---------------------------------------------------------------------------------


def make_project(api):
    r = api.post("/api/projects", {"name": "Restaurant inventory", "description": IDEA, "audiences": ["owners"]}, format="json")
    return r.json()["id"]


def launch(api, pid, depth, key):
    return api.post("/api/research/jobs", {"project": pid, "depth": depth}, format="json", HTTP_IDEMPOTENCY_KEY=key)


def test_free_plan_is_quick_only_and_capped(api, user, settings):
    settings.PLAN_LIMITS = REAL_LIMITS
    user.credits = 20
    user.save()
    r = launch(api, make_project(api), "standard", "a")
    assert r.status_code == 403 and r.json()["error"]["code"] == "plan_depth"
    assert UsageTransaction.objects.filter(user=user, operation="research_job").count() == 0  # nothing charged
    assert api.get("/api/research/estimate?depth=standard").json()["allowed"] is False
    assert launch(api, make_project(api), "quick", "b").status_code == 201
    r = launch(api, make_project(api), "quick", "c")  # one already running
    assert r.status_code == 429 and r.json()["error"]["code"] == "too_many_running"
    assert api.get("/api/me").json()["allowed_depths"] == ["quick"]


def test_paid_plan_unlocks_depths(api, user, settings):
    settings.PLAN_LIMITS = REAL_LIMITS
    Purchase.objects.create(user=user, provider="lemonsqueezy", pack_id="starter", credits=6, status="paid")
    assert launch(api, make_project(api), "standard", "p").status_code == 201
    assert api.get("/api/me").json()["plan"] == "paid"


# --- Recovery ------------------------------------------------------------------------------------


def test_stuck_job_is_failed_and_refunded_once(user):
    project = Project.objects.create(owner=user, name="P", status="RESEARCHING")
    job = ResearchJob.objects.create(
        project=project, idempotency_key="s", depth="standard", credits_charged=2, status="RUNNING", config_snapshot={}
    )
    create_stages(job)
    ResearchJob.objects.filter(pk=job.pk).update(started_at=timezone.now() - timedelta(hours=2))
    before = user.credits
    assert recover_stuck_jobs() == 1
    assert recover_stuck_jobs() == 0
    job.refresh_from_db()
    user.refresh_from_db()
    project.refresh_from_db()
    assert job.status == "FAILED" and user.credits == before + 2 and project.status == "DRAFT"
    assert not JobStage.objects.filter(job=job, status__in=("QUEUED", "PROCESSING")).exists()


def test_fresh_running_job_is_left_alone(user):
    project = Project.objects.create(owner=user, name="P", status="RESEARCHING")
    ResearchJob.objects.create(project=project, idempotency_key="f", status="RUNNING", started_at=timezone.now(), config_snapshot={})
    assert recover_stuck_jobs() == 0


def test_crashed_job_is_refunded(user, monkeypatch):
    from research import tasks

    project = Project.objects.create(owner=user, name="P", status="RESEARCHING")
    job = ResearchJob.objects.create(project=project, idempotency_key="c", credits_charged=1, config_snapshot={})
    create_stages(job)

    def boom(j):
        raise RuntimeError("provider exploded")

    monkeypatch.setattr(tasks, "collect_evidence", boom)
    before = user.credits
    with pytest.raises(RuntimeError):
        tasks.run_research_job.apply(args=[str(job.id)], throw=True)
    user.refresh_from_db()
    assert ResearchJob.objects.get(pk=job.pk).status == "FAILED" and user.credits == before + 1


# --- Errors + analytics --------------------------------------------------------------------------


def test_unknown_api_path_is_json_404(api, db):
    r = api.get("/api/does-not-exist")
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"


def test_client_analytics_whitelist_and_cleaning(client, db):
    r = client.post(
        "/api/analytics/events",
        {
            "event": "pricing_viewed",
            "path": "/pricing?email=a@b.c",
            "props": {"source": "landing", "email": "a@b.c", "nested": {"x": 1}},
        },
        content_type="application/json",
    )
    assert r.status_code == 204
    e = AnalyticsEvent.objects.get()
    assert e.path == "/pricing" and e.props == {"source": "landing"} and e.user is None
    client.post("/api/analytics/events", {"event": "made_up"}, content_type="application/json")
    assert AnalyticsEvent.objects.count() == 1
