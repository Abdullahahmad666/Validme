"""Week 13: Validation Lab — structured pages on a separate origin, a guarded waitlist, encrypted emails, retention."""

import time
from datetime import timedelta
from decimal import Decimal

import pytest
from allauth.account.models import EmailAddress
from django.core import signing
from django.core.cache import cache
from django.test import Client
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.services import issue_api_key
from lab import crypto, public
from lab.blocks import publish_problems, slug_problem, validate_blocks
from lab.models import LabDailyStat, LabPage, WaitlistSignup
from projects.models import IdeaDefinition, Project
from research.ai.client import LLMResult

LAB = "127.0.0.1:8000"
BLOCKS = [
    {"type": "hero", "headline": "Count stock in 5 minutes", "subheadline": "For small restaurants.", "cta_label": "Join"},
    {"type": "pricing", "items": [{"name": "Starter", "price": "$19", "period": "/month", "features": ["Unlimited counts"]}]},
    {"type": "faq", "items": [{"q": "When?", "a": "Not decided yet."}]},
    {"type": "waitlist", "heading": "Get early access"},
]


@pytest.fixture(autouse=True)
def _clean_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def project(user):
    p = Project.objects.create(owner=user, name="Stock app", status="COMPLETED")
    IdeaDefinition.objects.create(project=p, original_description="Stock counting for small restaurants.")
    return p


@pytest.fixture
def verified(user):
    return EmailAddress.objects.create(user=user, email=user.email, verified=True, primary=True)


@pytest.fixture
def page(project):
    return LabPage.objects.create(project=project, title="Stock app", slug="stock-app", blocks=BLOCKS, status="published")


def lab_client():
    return Client(HTTP_HOST=LAB, HTTP_USER_AGENT="Mozilla/5.0 (test)")


def old_token(page, seconds=10):
    return signing.dumps({"p": page.pk, "t": int(time.time()) - seconds}, salt=public.TOKEN_SALT)


def join(c, page, **data):
    body = {"email": "ana@example.org", "consent": "yes", "token": old_token(page), "company": "", **data}
    return c.post(f"/p/{page.slug}/join", body)


# --- blocks and publish rules -------------------------------------------------------------------------


def test_blocks_are_plain_text_with_limits_and_no_links(db):
    assert validate_blocks(BLOCKS) == []
    assert validate_blocks([{"type": "hero", "headline": "x" * 91}])
    assert validate_blocks([{"type": "script", "src": "x"}])
    assert validate_blocks([{"type": "hero", "headline": "Hi", "onclick": "alert(1)"}])
    for linky in ["Visit https://evil.test", "go to www.evil.test", "evil.com/login", "mail me@evil.test"]:
        assert validate_blocks([{"type": "hero", "headline": linky}]), linky
    assert slug_problem("stock-app") is None
    for bad in ["ab", "Stock", "-x-", "admin", "a--b", "x" * 60]:
        assert slug_problem(bad), bad


def test_publish_rules(project):
    p = LabPage(project=project, title="", blocks=[{"type": "faq", "items": [{"q": "q", "a": "a"}]}])
    problems = " ".join(publish_problems(p))
    assert "hero" in problems and "waitlist" in problems and "title" in problems and "web address" in problems


def test_publish_needs_a_verified_email_and_a_ready_page(api, project, verified):
    base = f"/api/projects/{project.id}/lab-pages"
    r = api.post(base, {"title": "Stock app", "blocks": [BLOCKS[0]]}, format="json")
    assert r.status_code == 201 and r.json()["status"] == "draft" and r.json()["url"] is None
    pid = r.json()["id"]
    assert api.post(f"{base}/{pid}/publish").json()["error"]["code"] == "not_ready"
    api.patch(f"{base}/{pid}", {"blocks": BLOCKS, "slug": "Stock-App"}, format="json")
    body = api.post(f"{base}/{pid}/publish").json()
    assert body["status"] == "published" and body["url"] == f"http://{LAB}/p/stock-app"
    assert api.patch(f"{base}/{pid}", {"slug": "other-name"}, format="json").status_code == 400  # live links would break
    assert api.post(f"{base}/{pid}/unpublish").json()["status"] == "unpublished"
    verified.delete()
    assert api.post(f"{base}/{pid}/publish").json()["error"]["code"] == "unverified"


def test_saving_links_or_unknown_blocks_is_refused(api, project):
    base = f"/api/projects/{project.id}/lab-pages"
    r = api.post(base, {"title": "x", "blocks": [{"type": "hero", "headline": "Buy at evil.com"}]}, format="json")
    assert r.status_code == 400
    r = api.post(base, {"title": "x", "blocks": [{"type": "hero", "headline": "Hi‮evil"}]}, format="json")
    assert r.status_code == 201 and r.json()["blocks"][0]["headline"] == "Hievil"  # bidi override stripped


def test_page_cap_owner_isolation_and_read_only_keys(api, other_api, user, project, settings):
    settings.LAB_PAGES = {"free": 1, "paid": 1}
    base = f"/api/projects/{project.id}/lab-pages"
    assert api.post(base, {"title": "One", "blocks": []}, format="json").status_code == 201
    r = api.post(base, {"title": "Two", "blocks": []}, format="json")
    assert r.status_code == 403 and "Founder and Pro" in r.json()["error"]["message"]
    assert other_api.get(base).status_code == 404
    _, raw = issue_api_key(user, "mcp")
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Api-Key {raw}")
    assert c.get(base).status_code == 200 and c.post(base, {"title": "x", "blocks": []}, format="json").status_code == 403


# --- origin isolation -------------------------------------------------------------------------------------


def test_pages_only_on_the_lab_origin_with_strict_headers(client, page):
    c = lab_client()
    r = c.get("/p/stock-app")
    assert r.status_code == 200
    html = r.content.decode()
    assert "Count stock in 5 minutes" in html and "Not available yet" in html  # honest pricing note
    csp = r["Content-Security-Policy"]
    assert "script-src 'none'" in csp and "default-src 'none'" in csp and "frame-ancestors 'none'" in csp
    assert "<script" not in html and r["X-Robots-Tag"] == "noindex, nofollow" and not r.cookies
    assert c.get("/api/me").status_code == 404 and c.get("/admin/").status_code == 404  # nothing of the app here
    assert client.get("/p/stock-app").status_code == 404  # and no founder content on the app origin
    page.status = "unpublished"
    page.save()
    assert c.get("/p/stock-app").status_code == 404


def test_founder_text_is_escaped(page):
    page.blocks = [{"type": "hero", "headline": "<img src=x onerror=alert(1)>"}, {"type": "waitlist"}]
    page.save()
    html = lab_client().get("/p/stock-app").content.decode()
    assert "<img src=x" not in html and "&lt;img src=x" in html


# --- waitlist ---------------------------------------------------------------------------------------------


def test_signup_is_encrypted_counted_and_never_reveals_duplicates(page):
    c = lab_client()
    r = join(c, page)
    assert r.status_code == 303 and r["Location"].endswith("?joined=1#join") and not r.cookies
    s = WaitlistSignup.objects.get()
    assert "ana@example.org" not in s.email_encrypted and crypto.decrypt(s.email_encrypted) == "ana@example.org"
    assert s.email_hash == crypto.email_hash("ANA@example.org ") and s.consent_version == public.CONSENT_VERSION
    assert abs((s.expires_at - s.consented_at) - timedelta(days=180)) < timedelta(seconds=1)
    r2 = join(c, page, email="Ana@Example.org")
    assert r2["Location"] == r["Location"] and WaitlistSignup.objects.count() == 1  # same answer for a duplicate
    assert LabDailyStat.objects.get(page=page).signups == 1


@pytest.mark.parametrize(
    ("data", "code"),
    [
        ({"consent": ""}, "consent"),
        ({"email": "not-an-email"}, "email"),
        ({"email": "a" * 250 + "@x.org"}, "email"),
        ({"token": "forged"}, "expired"),
    ],
)
def test_signup_validation(page, data, code):
    r = join(lab_client(), page, **data)
    assert r["Location"].endswith(f"?error={code}#join") and not WaitlistSignup.objects.exists()


def test_bots_are_turned_away_quietly(page):
    c = lab_client()
    assert join(c, page, company="ACME")["Location"].endswith("joined=1#join")  # honeypot: looks fine, stores nothing
    fresh = signing.dumps({"p": page.pk, "t": int(time.time())}, salt=public.TOKEN_SALT)
    assert join(c, page, token=fresh)["Location"].endswith("error=expired#join")  # posted instantly
    other = LabPage.objects.create(project=page.project, title="Other", slug="other-page", blocks=BLOCKS, status="published")
    assert join(c, page, token=old_token(other))["Location"].endswith("error=expired#join")  # token for another page
    assert not WaitlistSignup.objects.exists()


def test_rate_limits(page):
    c = lab_client()
    for i in range(5):
        assert join(c, page, email=f"p{i}@example.org")["Location"].endswith("joined=1#join")
    assert join(c, page, email="p6@example.org")["Location"].endswith("error=busy#join")
    assert WaitlistSignup.objects.count() == 5


def test_turnstile_when_configured(page, settings, monkeypatch):
    settings.TURNSTILE_SITE_KEY = "site"
    settings.TURNSTILE_SECRET_KEY = "secret"
    html = lab_client().get("/p/stock-app")
    assert "challenges.cloudflare.com" in html["Content-Security-Policy"] and "cf-turnstile" in html.content.decode()

    class R:
        def __init__(self, ok):
            self.ok = ok

        def json(self):
            return {"success": self.ok}

    monkeypatch.setattr(public.httpx, "post", lambda *a, **k: R(False))
    assert join(lab_client(), page, **{"cf-turnstile-response": "t"})["Location"].endswith("error=check#join")
    monkeypatch.setattr(public.httpx, "post", lambda *a, **k: R(True))
    assert join(lab_client(), page, **{"cf-turnstile-response": "t"})["Location"].endswith("joined=1#join")


def test_views_are_first_party_counts_without_bots(page):
    c = lab_client()
    c.get("/p/stock-app")
    c.get("/p/stock-app", HTTP_USER_AGENT="Googlebot/2.1")
    c.get("/p/stock-app?joined=1")
    assert LabDailyStat.objects.get(page=page).views == 1


# --- founder side: stats, sign-ups, export, delete, retention -------------------------------------------


def test_stats_signups_export_and_delete(api, other_api, page):
    c = lab_client()
    c.get("/p/stock-app")
    join(c, page, email="=cmd@example.org")  # a valid address that a spreadsheet would read as a formula
    join(c, page, email="bo@example.org")
    base = f"/api/projects/{page.project_id}/lab-pages/{page.pk}"
    stats = api.get(f"{base}/stats").json()
    assert stats["views"] == 1 and stats["signups"] == 2 and stats["conversion"] == 2.0
    rows = api.get(f"{base}/signups").json()["results"]
    assert {r["email"] for r in rows} == {"bo@example.org", "=cmd@example.org"}
    csv = api.get(f"{base}/signups-export").content.decode()
    assert "'=cmd" in csv and "\n=cmd" not in csv  # formula neutralised
    assert other_api.get(f"{base}/signups").status_code == 404 and other_api.get(f"{base}/signups-export").status_code == 404
    one = rows[0]["id"]
    assert other_api.post(f"{base}/signups/delete", {"ids": [one]}, format="json").status_code == 404
    assert api.post(f"{base}/signups/delete", {"ids": [one]}, format="json").json()["deleted"] == 1
    assert api.post(f"{base}/signups/delete", {"all": True}, format="json").json()["deleted"] == 1


def test_no_views_means_conversion_unavailable(api, page):
    assert api.get(f"/api/projects/{page.project_id}/lab-pages/{page.pk}/stats").json()["conversion"] is None


def test_retention_purge(page):
    from lab.tasks import purge_expired_signups

    join(lab_client(), page)
    WaitlistSignup.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
    assert purge_expired_signups() == 1 and not WaitlistSignup.objects.exists()


def test_slug_check(api, page):
    assert api.get("/api/lab/slug?slug=stock-app").json()["available"] is False
    assert api.get(f"/api/lab/slug?slug=stock-app&page={page.pk}").json()["available"] is True  # its own address
    assert api.get("/api/lab/slug?slug=admin").json()["available"] is False
    assert api.get("/api/lab/slug?slug=fresh-name&page=abc").json()["available"] is True


# --- AI copy ----------------------------------------------------------------------------------------------


@pytest.fixture
def fake_llm(monkeypatch, settings):
    from lab import suggest

    settings.ANTHROPIC_API_KEY = "test-key"
    settings.LLM_PROVIDER = "anthropic"
    reply = {
        "headline": "Count restaurant stock without clipboards",
        "subheadline": "A simple way to count stock on your phone.",
        "problem": "Counting stock by hand takes a long evening every week.",
        "benefits": [{"title": "Count on your phone", "body": "Walk the shelves and tap."}],
        "faq": [{"q": "What will it cost?", "a": "Pricing isn't decided yet."}],
    }
    box = {"reply": reply}
    monkeypatch.setattr(
        suggest.llm,
        "complete_json",
        lambda *a, **k: LLMResult(data=box["reply"], model="m", input_tokens=1, output_tokens=1, cost_usd=Decimal("0.01")),
    )
    return box


def test_ai_copy_is_labelled_and_cannot_invent_facts(api, project, fake_llm):
    url = f"/api/projects/{project.id}/lab-suggest"
    body = api.post(url).json()
    assert body["ai"] is True and [b["type"] for b in body["blocks"]] == ["hero", "problem", "benefits", "faq"]
    for bad in ["Trusted by 500 restaurants", "Saves 3 hours a week", "Loved by chefs", "See stockly.com"]:
        fake_llm["reply"] = {**fake_llm["reply"], "subheadline": bad}
        r = api.post(url)
        assert r.status_code == 503, bad
