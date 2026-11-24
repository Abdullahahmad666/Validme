"""Week 10: weekly digest, unsubscribe, bounce webhook, new-competitor candidates, subscriptions."""

import base64
import hashlib
import hmac
import json
import time
from datetime import timedelta

import pytest
from django.core import mail
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.services import issue_api_key
from billing.models import Subscription, UsageTransaction
from billing.plans import plan_for
from billing.tests.test_billing import order, payments, post_hook  # noqa: F401 (payments is a fixture)
from mailer.digest import send_digest
from mailer.models import DigestLog, EmailPreference
from mailer.tokens import unsubscribe_token
from monitoring import candidates as cand
from monitoring.models import Change, CompetitorCandidate, Watch
from projects.models import Project
from reports.models import Competitor
from research.models import ResearchQuery


@pytest.fixture
def project(user):
    return Project.objects.create(owner=user, name="Monitored", status="COMPLETED")


@pytest.fixture
def verified(user):
    from allauth.account.models import EmailAddress

    return EmailAddress.objects.create(user=user, email=user.email, verified=True, primary=True)


def _change(project, label="Acme", ai="", url="https://acme.test/pricing"):
    n = Watch.objects.filter(project=project).count()
    w = Watch.objects.create(project=project, url=f"{url}?n={n}", label=label, next_run_at=timezone.now())
    return Change.objects.create(
        watch=w,
        project=project,
        kind="pricing",
        significance="high",
        summary="Prices changed (new price: $35/mo)",
        ai_summary=ai,
        details={"prices_added": ["$35/mo"]},
        detected_at=timezone.now(),
    )


# --- digest -------------------------------------------------------------------------------------------


def test_digest_sends_once_per_week_with_safe_content(user, verified, project, settings):
    settings.FRONTEND_URL = "https://app.validme.test"
    _change(project, label="<script>alert(1)</script>", ai="Starter rose to $35/mo.")
    assert send_digest(user) == "sent"
    assert send_digest(user) == "already_sent"  # idempotent per ISO week
    assert len(mail.outbox) == 1
    m = mail.outbox[0]
    html = m.alternatives[0][0]
    assert "<script>alert(1)</script>" not in html and "&lt;script&gt;" in html  # page text escaped
    assert "AI SUMMARY" in html and "Starter rose to $35/mo." in html
    assert "https://app.validme.test/projects/" in m.body  # every item links into the app
    assert m.extra_headers["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"
    assert "/api/email/unsubscribe?token=" in m.extra_headers["List-Unsubscribe"]
    assert "<img" not in html  # no tracking pixels
    assert DigestLog.objects.get(user=user).status == "sent"


def test_digest_queries_dont_grow_with_changes(user, project, django_assert_max_num_queries):
    from mailer.digest import build_digest

    for i in range(12):
        _change(project, label=f"Page {i}")
    with django_assert_max_num_queries(3):  # changes + signals + candidates, whatever the count
        assert len(build_digest(user)["changes"]) == 12


def test_unverified_addresses_get_no_digest(user, project):
    from mailer.digest import recipients

    _change(project)
    assert send_digest(user) == "skipped"  # someone could have signed up with a stranger's address
    assert user not in recipients()


def test_quiet_weeks_and_opt_outs_send_nothing(user, verified, project):
    assert send_digest(user) == "skipped"  # nothing changed
    _change(project)
    EmailPreference.objects.create(user=user, weekly_digest=False)
    assert send_digest(user) == "skipped"
    assert len(mail.outbox) == 0


def test_unsubscribe_link_asks_first_and_post_applies(client, user):
    token = unsubscribe_token(user.pk)
    r = client.get(f"/api/email/unsubscribe?token={token}")
    assert r.status_code == 302 and "/unsubscribed?token=" in r["Location"]
    assert not EmailPreference.objects.filter(user=user).exists()  # link scanners can't unsubscribe anyone
    assert client.post(f"/api/email/unsubscribe?token={token}").status_code == 200  # page confirm / RFC 8058 one-click
    assert EmailPreference.objects.get(user=user).weekly_digest is False
    forged = token[:-2] + ("AA" if not token.endswith("AA") else "BB")
    assert client.get(f"/api/email/unsubscribe?token={forged}")["Location"].endswith("error=1")
    assert client.post(f"/api/email/unsubscribe?token={forged}").status_code == 400


def test_preferences_api(api, user):
    assert api.get("/api/email/preferences").json()["weekly_digest"] is True
    assert api.patch("/api/email/preferences", {"weekly_digest": False}, format="json").json()["weekly_digest"] is False
    _, raw = issue_api_key(user, "mcp")
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Api-Key {raw}")
    assert c.patch("/api/email/preferences", {"weekly_digest": True}, format="json").status_code == 403


def _svix(secret_b64: str, body: bytes, ts: int | None = None):
    ts = ts or int(time.time())
    sig = base64.b64encode(hmac.new(base64.b64decode(secret_b64), f"msg_1.{ts}.".encode() + body, hashlib.sha256).digest()).decode()
    return {"HTTP_SVIX_ID": "msg_1", "HTTP_SVIX_TIMESTAMP": str(ts), "HTTP_SVIX_SIGNATURE": f"v1,{sig}"}


def test_resend_bounce_webhook(client, user, settings):
    secret = base64.b64encode(b"x" * 24).decode()
    settings.RESEND_WEBHOOK_SECRET = f"whsec_{secret}"
    body = json.dumps({"type": "email.bounced", "data": {"to": [user.email]}}).encode()
    url = "/api/email/webhooks/resend"
    assert (
        client.post(
            url, body, content_type="application/json", HTTP_SVIX_ID="msg_1", HTTP_SVIX_TIMESTAMP="1", HTTP_SVIX_SIGNATURE="v1,bad"
        ).status_code
        == 401
    )
    old = _svix(secret, body, ts=int(time.time()) - 3600)
    assert client.post(url, body, content_type="application/json", **old).status_code == 401  # replay window
    assert client.post(url, body, content_type="application/json", **_svix(secret, body)).status_code == 200
    pref = EmailPreference.objects.get(user=user)
    assert pref.bounced and not pref.weekly_digest


# --- candidates ---------------------------------------------------------------------------------------


def test_detect_filters_known_generic_and_unsafe(project):
    Competitor.objects.create(project=project, name="Known", website="https://www.known.test")
    ResearchQuery.objects.create(project=project, text="restaurant pain", intent="problem_discovery")
    ResearchQuery.objects.create(project=project, text="stock count app", intent="competitor_gaps")
    seen = []
    hits = [
        {"objectID": "1", "title": "Show HN: Known thing", "url": "https://known.test/x"},
        {"objectID": "2", "title": "Show HN: Code", "url": "https://github.com/a/b"},
        {"objectID": "3", "title": "Show HN: Bad", "url": "javascript:alert(1)"},
        {"objectID": "4", "title": "Show HN: Stockly – counts for cafes", "url": "https://stockly.test/"},
        {"objectID": "5", "title": "Show HN: Stockly again", "url": "https://www.stockly.test/pricing"},
    ]
    assert cand.detect(project, search=lambda q: seen.append(q) or hits) == 1
    assert seen[0] == "stock count app"  # competitor-gap queries first
    c = CompetitorCandidate.objects.get()
    assert c.domain == "stockly.test" and c.name == "Stockly – counts for cafes"
    assert c.source_url == "https://news.ycombinator.com/item?id=4"
    assert cand.detect(project, search=lambda q: hits) == 0  # never suggested twice


def test_candidate_accept_dismiss_and_isolation(api, other_api, project, monkeypatch):
    from monitoring import views as mviews

    monkeypatch.setattr(mviews, "check_url", lambda url: "93.184.216.34")
    a = CompetitorCandidate.objects.create(
        project=project,
        domain="a.test",
        name="A",
        url="https://a.test/",
        source_url="https://news.ycombinator.com/item?id=1",
        source="hackernews",
        found_at=timezone.now(),
    )
    b = CompetitorCandidate.objects.create(
        project=project,
        domain="b.test",
        name="B",
        url="https://b.test/",
        source_url="https://news.ycombinator.com/item?id=2",
        source="hackernews",
        found_at=timezone.now(),
    )
    base = f"/api/projects/{project.id}/candidates"
    assert [c["id"] for c in api.get(base).json()] == [b.pk, a.pk]
    assert other_api.get(base).status_code == 404
    assert other_api.post(f"{base}/{a.pk}/accept").status_code == 404
    assert api.post(f"{base}/{a.pk}/accept").json()["status"] == "accepted"
    assert Watch.objects.filter(project=project, url="https://a.test/").exists()
    assert api.post(f"{base}/{a.pk}/accept").status_code == 400  # already decided
    assert api.post(f"{base}/{b.pk}/dismiss").json()["status"] == "dismissed"
    assert api.get(base).json() == []


def test_new_candidates_notify_once_a_week(project, user, monkeypatch):
    from monitoring.tasks import detect_candidates_task
    from notifications.models import Notification

    monkeypatch.setattr(cand, "detect", lambda p: 2)
    assert detect_candidates_task(str(project.pk)) == 2
    assert detect_candidates_task(str(project.pk)) == 2
    n = Notification.objects.get(user=user)
    assert n.title == "Monitored: 2 possible new competitors" and n.link.endswith("/monitoring#candidates")


# --- subscriptions (Polar) ----------------------------------------------------------------------------

PLANS = [{"id": "founder", "monthly_product_id": "prod-founder-m", "yearly_product_id": "prod-founder-y", "monthly_credits": 4}]


def _sub_event(
    user,
    event="subscription.created",
    status="active",
    product="prod-founder-m",
    sub_id="sub_1",
    at=0,
    sig=None,
    cancel_at_period_end=False,
    ends_at=None,
    ended_at=None,
):
    from billing.services import checkout_sig

    meta = {"user_id": str(user.pk), "kind": "subscription", "plan": "founder"}
    meta["sig"] = checkout_sig(user.pk, "founder") if sig is None else sig
    modified = (timezone.now() - timedelta(days=30) + timedelta(minutes=at)).isoformat()
    period_end = (timezone.now() + timedelta(days=20)).isoformat()
    return {
        "type": event,
        "data": {
            "id": sub_id,
            "status": status,
            "product_id": product,
            "recurring_interval": "month",
            "current_period_end": period_end,
            "cancel_at_period_end": cancel_at_period_end,
            "ends_at": ends_at,
            "ended_at": ended_at,
            "created_at": modified,
            "modified_at": modified,
            "metadata": meta,
        },
    }


def _invoice(order_id="ord_1", sub_id="sub_1", status="paid", reason="subscription_create", total=1900, event="order.paid", **extra):
    return {
        "type": event,
        "data": {
            "id": order_id,
            "status": status,
            "subscription_id": sub_id,
            "billing_reason": reason,
            "product_id": "prod-founder-m",
            "total_amount": total,
            "refunded_amount": 0,
            "metadata": {},
            **extra,
        },
    }


@pytest.fixture
def plans(payments, settings):  # noqa: F811
    settings.SUBSCRIPTION_PLANS = PLANS


def test_subscription_lifecycle_sets_the_plan(client, user, plans):
    assert plan_for(user) == "free"
    assert post_hook(client, _sub_event(user)).status_code == 200
    assert plan_for(user) == "founder"
    sub = Subscription.objects.get()
    assert sub.status == "active" and sub.renews_at is not None and sub.provider == "polar"
    # Cancelled from the portal: Polar keeps it active until the period ends.
    post_hook(client, _sub_event(user, event="subscription.canceled", cancel_at_period_end=True, at=1))
    sub.refresh_from_db()
    assert plan_for(user) == "founder" and sub.status == "cancelled" and sub.ends_at > timezone.now()
    ended = timezone.now().isoformat()
    post_hook(client, _sub_event(user, event="subscription.revoked", status="canceled", ended_at=ended, at=2))
    assert plan_for(user) == "free"
    post_hook(client, _sub_event(user, event="subscription.updated", status="active", at=1))  # late retry
    assert plan_for(user) == "free"  # an older event never revives an ended plan


def test_uncancel_and_past_due_keep_access(client, user, plans):
    post_hook(client, _sub_event(user))
    post_hook(client, _sub_event(user, event="subscription.canceled", cancel_at_period_end=True, at=1))
    post_hook(client, _sub_event(user, event="subscription.uncanceled", at=2))
    assert Subscription.objects.get().status == "active"
    post_hook(client, _sub_event(user, event="subscription.updated", status="past_due", at=3))
    assert Subscription.objects.get().status == "past_due" and plan_for(user) == "founder"  # Polar is retrying payment
    post_hook(client, _sub_event(user, event="subscription.updated", status="unpaid", at=4))
    assert plan_for(user) == "free"


def test_spoofed_checkout_data_cant_attach_a_subscription(client, user, plans):
    post_hook(client, _sub_event(user, sig="0" * 32))  # e.g. a checkout link created with someone else's user id
    assert not Subscription.objects.exists() and plan_for(user) == "free"


def test_plan_changes_and_zero_invoices_grant_nothing(client, user, plans):
    post_hook(client, _sub_event(user))
    before = user.credits
    post_hook(client, _invoice(order_id="ord_u", reason="subscription_update"))  # proration on a plan switch
    post_hook(client, _invoice(order_id="ord_0", reason="subscription_cycle", total=0))
    user.refresh_from_db()
    assert user.credits == before
    post_hook(client, _invoice(order_id="ord_r", reason="subscription_cycle"))
    user.refresh_from_db()
    assert user.credits == before + 4


def test_invoice_refund_takes_back_credits_once(client, user, plans):
    post_hook(client, _sub_event(user))
    before = user.credits
    post_hook(client, _invoice())
    user.refresh_from_db()
    user.credits -= 1  # spent one
    user.save()
    refund = _invoice(event="order.refunded", status="refunded", refunded_amount=1900)
    for _ in range(2):
        assert post_hook(client, refund).status_code == 200
    user.refresh_from_db()
    assert UsageTransaction.objects.get(operation="subscription_refund").credits == -4
    assert user.credits == before - 1  # the 4 granted come back out; the one spent stays spent


def test_refund_of_an_ungranted_subscription_order_is_recorded_not_retried(client, user, plans):
    post_hook(client, _sub_event(user))
    event = _invoice(order_id="ord_x", event="order.refunded", status="refunded", refunded_amount=1900)
    assert post_hook(client, event).status_code == 200


def test_invoices_grant_monthly_credits_once(client, user, plans):
    post_hook(client, _sub_event(user))
    before = user.credits
    for _ in range(2):
        assert post_hook(client, _invoice()).status_code == 200
    user.refresh_from_db()
    assert user.credits == before + 4
    assert UsageTransaction.objects.filter(operation="subscription_credits").count() == 1


def test_yearly_invoice_grants_a_year(client, user, plans):
    post_hook(client, _sub_event(user, product="prod-founder-y", sub_id="sub_y"))
    before = user.credits
    post_hook(client, _invoice(order_id="ord_y", sub_id="sub_y", product_id="prod-founder-y"))
    user.refresh_from_db()
    assert user.credits == before + 48


def test_unknown_product_and_early_invoice(client, user, plans):
    post_hook(client, _sub_event(user, product="prod-unknown"))
    assert not Subscription.objects.exists()
    assert post_hook(client, _invoice(sub_id="sub_unknown")).status_code == 409  # retried until the subscription exists


def test_subscribe_and_portal_endpoints(api, user, plans, monkeypatch):
    from billing.providers import polar

    seen = {}

    def fake_checkout(**kw):
        seen.update(kw)
        return "chk", "https://sandbox.polar.sh/checkout/x"

    monkeypatch.setattr(polar, "create_checkout", fake_checkout)
    assert api.post("/api/billing/portal").status_code == 404
    r = api.post("/api/billing/subscribe", {"plan": "founder", "interval": "month"}, format="json")
    assert r.status_code == 200 and r.json()["url"].startswith("https://")
    assert seen["product_id"] == "prod-founder-m" and seen["metadata"]["plan"] == "founder" and seen["metadata"]["sig"]
    Subscription.objects.create(
        user=user, provider="polar", provider_subscription_id="s1", plan="founder", variant_id="prod-founder-m", status="active"
    )
    assert api.post("/api/billing/subscribe", {"plan": "founder", "interval": "year"}, format="json").status_code == 409
    monkeypatch.setattr(polar, "customer_portal_url", lambda sid: "https://sandbox.polar.sh/portal?session=1")
    assert api.post("/api/billing/portal").json()["url"].startswith("https://")
    body = api.get("/api/billing/packs").json()
    assert body["subscription"]["plan"] == "founder" and body["limits"]["plan"] == "founder"


def test_refund_before_the_paid_order_grants_only_the_rest(client, user, plans):
    post_hook(client, _sub_event(user))
    before = user.credits
    refund = _invoice(order_id="ord_e", event="order.refunded", status="refunded", refunded_amount=1900)
    assert post_hook(client, refund).status_code == 200
    assert post_hook(client, _invoice(order_id="ord_e")).status_code == 200  # the paid event, retried late
    user.refresh_from_db()
    assert user.credits == before  # fully refunded: nothing granted
    half = _invoice(order_id="ord_h", event="order.refunded", status="partially_refunded", refunded_amount=950)
    post_hook(client, half)
    post_hook(client, _invoice(order_id="ord_h", reason="subscription_cycle"))
    user.refresh_from_db()
    assert user.credits == before + 2
    # Usage history doesn't show the bookkeeping rows.
    assert all(t.credits != 0 for t in UsageTransaction.objects.filter(user=user).exclude(credits=0))


def test_early_refund_for_an_unknown_subscription_is_retried(client, user, plans):
    refund = _invoice(order_id="ord_z", sub_id="sub_later", event="order.refunded", status="refunded", refunded_amount=1900)
    assert post_hook(client, refund).status_code == 409


def test_product_we_dont_sell_still_follows_status(client, user, plans):
    post_hook(client, _sub_event(user))
    post_hook(client, _sub_event(user, event="subscription.updated", product="prod-retired", at=1))
    sub = Subscription.objects.get()
    assert sub.plan == "founder" and sub.status == "active"  # last known plan kept
    ended = timezone.now().isoformat()
    post_hook(client, _sub_event(user, event="subscription.revoked", product="prod-retired", status="canceled", ended_at=ended, at=2))
    assert plan_for(user) == "free"  # a revocation always ends access


def test_cancelled_while_past_due_ends_at_period_end(client, user, plans):
    post_hook(client, _sub_event(user))
    post_hook(client, _sub_event(user, event="subscription.updated", status="past_due", cancel_at_period_end=True, at=1))
    sub = Subscription.objects.get()
    assert sub.status == "cancelled" and sub.ends_at is not None


def test_renewal_after_a_plan_change_grants_the_new_plans_credits(client, user, plans, settings):
    settings.SUBSCRIPTION_PLANS = [*PLANS, {"id": "pro", "monthly_product_id": "prod-pro-m", "monthly_credits": 10}]
    post_hook(client, _sub_event(user))
    before = user.credits
    post_hook(client, _invoice(order_id="ord_p", reason="subscription_cycle", product_id="prod-pro-m"))
    user.refresh_from_db()
    assert user.credits == before + 10
