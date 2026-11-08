import json
import re
from urllib.parse import unquote

import pytest
from allauth.account.models import EmailAddress
from allauth.account.signals import email_confirmed, user_signed_up
from django.core import mail
from django.test import Client

from accounts.models import User
from billing.models import UsageTransaction

SIGNUP = "/_allauth/browser/v1/auth/signup"
LOGIN = "/_allauth/browser/v1/auth/login"
SESSION = "/_allauth/browser/v1/auth/session"
VERIFY = "/_allauth/browser/v1/auth/email/verify"


def post_json(client: Client, url: str, body: dict):
    return client.post(url, json.dumps(body), content_type="application/json")


@pytest.fixture
def browser(db):
    return Client()


def verification_key_from_outbox() -> str:
    body = mail.outbox[-1].body
    match = re.search(r"/verify-email/([^\s/]+)", body)
    assert match, body
    return unquote(match.group(1))  # link carries the key URL-encoded; the frontend decodes it too


def test_email_signup_grants_credits_only_after_verification(browser, settings):
    settings.FREE_SIGNUP_CREDITS = 1
    r = post_json(browser, SIGNUP, {"email": "new@example.com", "password": "a-strong-pass-123"})
    assert r.status_code == 200, r.content
    user = User.objects.get(email="new@example.com")
    assert user.credits == 0  # unverified: no free credits yet
    # The session cookie set by allauth authenticates the REST API.
    me = browser.get("/api/me")
    assert me.status_code == 200
    assert me.json()["email"] == "new@example.com"

    key = verification_key_from_outbox()
    assert post_json(browser, VERIFY, {"key": key}).status_code == 200
    user.refresh_from_db()
    assert user.credits == 1
    assert UsageTransaction.objects.filter(user=user, operation="signup_grant").count() == 1

    # Re-confirming (e.g. second email address or replayed link) never grants again.
    email_confirmed.send(sender=None, request=None, email_address=EmailAddress.objects.get(user=user))
    user.refresh_from_db()
    assert user.credits == 1


def test_google_signup_with_verified_email_grants_once(user):
    user.credits = 0
    user.save()
    EmailAddress.objects.create(user=user, email=user.email, verified=True, primary=True)
    user_signed_up.send(sender=None, request=None, user=user, sociallogin=object())
    user_signed_up.send(sender=None, request=None, user=user, sociallogin=object())
    user.refresh_from_db()
    assert user.credits == 1
    assert UsageTransaction.objects.filter(user=user, idempotency_key=f"signup_grant:{user.pk}").count() == 1


def test_signup_rejects_duplicate_email(browser, user):
    r = post_json(browser, SIGNUP, {"email": user.email, "password": "a-strong-pass-123"})
    assert r.status_code == 400


def test_login_does_not_grant_credits_again(browser, user):
    before = user.credits
    r = post_json(browser, LOGIN, {"email": user.email, "password": "pw-12345678"})
    assert r.status_code == 200, r.content
    user.refresh_from_db()
    assert user.credits == before
    assert browser.get(SESSION).status_code == 200


def test_login_wrong_password(browser, user):
    r = post_json(browser, LOGIN, {"email": user.email, "password": "nope-nope-nope"})
    assert r.status_code == 400


def test_session_api_requires_csrf(user):
    c = Client(enforce_csrf_checks=True)
    c.force_login(user)
    r = c.post("/api/projects", json.dumps({"name": "abc"}), content_type="application/json")
    assert r.status_code == 403


def test_me_requires_auth(browser):
    r = browser.get("/api/me")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "not_authenticated"


def test_me_cannot_change_credits(api, user):
    r = api.patch("/api/me", {"credits": 999, "first_name": "Ana"}, format="json")
    assert r.status_code == 200
    user.refresh_from_db()
    assert user.credits == 5
    assert user.first_name == "Ana"
