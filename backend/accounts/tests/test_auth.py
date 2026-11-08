import json

import pytest
from django.test import Client

from accounts.models import User
from billing.models import UsageTransaction

SIGNUP = "/_allauth/browser/v1/auth/signup"
LOGIN = "/_allauth/browser/v1/auth/login"
SESSION = "/_allauth/browser/v1/auth/session"


def post_json(client: Client, url: str, body: dict):
    return client.post(url, json.dumps(body), content_type="application/json")


@pytest.fixture
def browser(db):
    return Client()


def test_email_signup_creates_user_with_free_credits(browser, settings):
    settings.FREE_SIGNUP_CREDITS = 1
    r = post_json(browser, SIGNUP, {"email": "new@example.com", "password": "a-strong-pass-123"})
    assert r.status_code == 200, r.content
    user = User.objects.get(email="new@example.com")
    assert user.credits == 1
    assert UsageTransaction.objects.filter(user=user, operation="signup_grant", credits=1).count() == 1
    # The session cookie set by allauth authenticates the REST API.
    me = browser.get("/api/me")
    assert me.status_code == 200
    assert me.json()["email"] == "new@example.com"


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
