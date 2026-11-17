"""Week 14: surveys, price tests, results with sample-size warnings, export/deletion and respondent data requests."""

import json
import time
from decimal import Decimal

import pytest
from allauth.account.models import EmailAddress
from django.core import mail, signing
from django.core.cache import cache
from django.test import Client
from rest_framework.test import APIClient

from accounts.services import issue_api_key
from lab import crypto, public, public_surveys
from lab.blocks import price_test, validate_blocks
from lab.data_requests import link_token
from lab.models import DataRequest, DataRequestNotice, LabPage, LabVariantStat, Survey, SurveyResponse, WaitlistSignup
from lab.surveys import compare_rates, margin_of_error, sample_note, validate_questions
from projects.models import Assumption, IdeaDefinition, Project
from research.ai.client import LLMResult

LAB = "127.0.0.1:8000"
QUESTIONS = [
    {
        "id": "q1",
        "type": "single",
        "prompt": "How do you count stock today?",
        "options": ["Paper", "Spreadsheet", "An app"],
        "required": True,
    },
    {"id": "q2", "type": "multi", "prompt": "Which parts are slow?", "options": ["Counting", "Ordering", "Reports"]},
    {"id": "q3", "type": "scale", "prompt": "How painful is it?", "low_label": "Not at all", "high_label": "Very"},
    {"id": "q4", "type": "text", "prompt": "What did you try?"},
]
PRICED = [
    {"type": "hero", "headline": "Count stock faster"},
    {
        "type": "pricing",
        "items": [{"name": "Basic", "price": "$9", "period": "/month"}],
        "test_variants": [
            [{"name": "Basic", "price": "$19", "period": "/month"}],
            [{"name": "Basic", "price": "$29", "period": "/month"}],
        ],
    },
    {"type": "waitlist"},
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
def survey(project):
    return Survey.objects.create(project=project, title="Stock counting", slug="stock-survey", questions=QUESTIONS, status="published")


def lab_client(ua="Mozilla/5.0 (test)", ip="203.0.113.7"):
    return Client(HTTP_HOST=LAB, HTTP_USER_AGENT=ua, REMOTE_ADDR=ip)


def survey_token(s, seconds=10):
    return signing.dumps({"s": s.pk, "t": int(time.time()) - seconds}, salt=public_surveys.SURVEY_SALT)


def answer(c, s, **data):
    body = {"q1": "1", "q2": ["0", "2"], "q3": "4", "q4": "A notebook", "consent": "yes", "token": survey_token(s), **data}
    return c.post(f"/s/{s.slug}/answer", {k: v for k, v in body.items() if v is not None})


# --- questions -----------------------------------------------------------------------------------------------


def test_question_rules():
    assert validate_questions(QUESTIONS) == []
    assert validate_questions([{"id": "q1", "type": "single", "prompt": "Pick", "options": ["Only one"]}])
    assert validate_questions([{"id": "q1", "type": "single", "prompt": "Pick", "options": ["A", "a"]}])
    assert validate_questions([{"id": "q1", "type": "text", "prompt": "Visit evil.com"}])
    assert validate_questions([{"id": "q1", "type": "html", "prompt": "x"}])
    assert validate_questions([{"id": "q1", "type": "text", "prompt": "x", "onclick": "y"}])
    assert validate_questions([QUESTIONS[0], {**QUESTIONS[1], "id": "q1"}])  # duplicate ids
    assert validate_questions([{**QUESTIONS[3], "assumption_id": 99}], {1, 2})


def test_survey_crud_cap_owner_isolation_and_keys(api, other_api, user, project, settings):
    settings.LAB_SURVEYS = {"free": 1, "paid": 1}
    base = f"/api/projects/{project.id}/lab-surveys"
    r = api.post(base, {"title": "One", "questions": QUESTIONS}, format="json")
    assert r.status_code == 201 and r.json()["url"] is None and "deletes them after 180 days" in r.json()["consent_preview"]
    r2 = api.post(base, {"title": "Two", "questions": []}, format="json")
    assert r2.status_code == 403 and "Founder and Pro" in r2.json()["error"]["message"]
    assert other_api.get(base).status_code == 404
    assert other_api.get(f"{base}/{r.json()['id']}/results").status_code == 404
    _, raw = issue_api_key(user, "mcp")
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Api-Key {raw}")
    assert c.get(base).status_code == 200 and c.post(base, {"title": "x"}, format="json").status_code == 403
    assert c.get(f"{base}/{r.json()['id']}/responses").status_code == 403  # answers only in the web app
    a = Assumption.objects.create(project=project, text="Owners count by hand")
    bad = [{**QUESTIONS[0], "assumption_id": a.id + 1000}]
    assert api.patch(f"{base}/{r.json()['id']}", {"questions": bad}, format="json").status_code == 400
    ok = [{**QUESTIONS[0], "assumption_id": a.id}]
    assert api.patch(f"{base}/{r.json()['id']}", {"questions": ok}, format="json").status_code == 200


def test_survey_publish_close_unpublish(api, project, verified):
    base = f"/api/projects/{project.id}/lab-surveys"
    sid = api.post(base, {"title": "Stock", "questions": []}, format="json").json()["id"]
    r = api.post(f"{base}/{sid}/publish")
    assert r.status_code == 400 and r.json()["error"]["code"] == "not_ready"
    api.patch(f"{base}/{sid}", {"questions": QUESTIONS, "slug": "stock-q"}, format="json")
    r = api.post(f"{base}/{sid}/publish")
    assert r.status_code == 200 and r.json()["url"].endswith("/s/stock-q")
    assert lab_client().get("/s/stock-q").status_code == 200
    assert api.post(f"{base}/{sid}/close").json()["status"] == "closed"
    html = lab_client().get("/s/stock-q").content.decode()
    assert "This survey is closed" in html and "<form" not in html.split("<main>")[1].split("</main>")[0]
    assert api.post(f"{base}/{sid}/unpublish").json()["status"] == "unpublished"
    assert lab_client().get("/s/stock-q").status_code == 404


def test_publish_survey_needs_verified_email(api, project):
    base = f"/api/projects/{project.id}/lab-surveys"
    sid = api.post(base, {"title": "Stock", "questions": QUESTIONS, "slug": "stock-q"}, format="json").json()["id"]
    assert api.post(f"{base}/{sid}/publish").status_code == 403


def test_pages_and_surveys_share_addresses(api, project, survey):
    r = api.post(f"/api/projects/{project.id}/lab-pages", {"title": "x", "blocks": [], "slug": "stock-survey"}, format="json")
    assert r.status_code == 400 and "taken" in json.dumps(r.json())
    assert api.get("/api/lab/slug", {"slug": "stock-survey"}).json()["available"] is False
    assert api.get("/api/lab/slug", {"slug": "stock-survey", "survey": survey.id}).json()["available"] is True


# --- public survey -----------------------------------------------------------------------------------------------


def test_survey_only_on_the_lab_origin_and_escaped(client, survey):
    survey.questions = [{"id": "q1", "type": "text", "prompt": "<script>alert(1)</script>"}]
    survey.save()
    r = lab_client().get("/s/stock-survey")
    html = r.content.decode()
    assert r.status_code == 200 and "<script>alert" not in html and "&lt;script&gt;" in html
    assert "script-src 'none'" in r["Content-Security-Policy"] and not r.cookies
    assert client.get("/s/stock-survey").status_code == 404


def test_answers_are_stored_with_typed_text_encrypted(survey):
    survey.ask_email = True
    survey.save()
    r = answer(lab_client(), survey, email="Ana@Example.org")
    assert r.status_code == 303 and r["Location"].endswith("?done=1")
    resp = SurveyResponse.objects.get()
    assert resp.answers == {"q1": 1, "q2": [0, 2], "q3": 4}
    assert "notebook" not in resp.text_encrypted and json.loads(crypto.decrypt(resp.text_encrypted)) == {"q4": "A notebook"}
    assert "ana@" not in resp.email_encrypted.lower() and resp.email_hash == crypto.email_hash("ana@example.org")
    assert resp.consent_version == public_surveys.SURVEY_CONSENT_VERSION


def test_answers_outside_the_options_are_ignored(survey):
    answer(lab_client(), survey, q2=["1", "9", "x"], q3="6")
    assert SurveyResponse.objects.get().answers == {"q1": 1, "q2": [1], "q3": None}  # 9, "x" and 6 weren't offered
    r = answer(lab_client(ip="198.51.100.3"), survey, q1="7")  # q1 is required: an option that doesn't exist isn't an answer
    assert r.status_code == 400 and SurveyResponse.objects.count() == 1


def test_mistakes_show_the_form_again_with_answers_kept(survey):
    r = answer(lab_client(), survey, q1=None)
    html = r.content.decode()
    assert r.status_code == 400 and "Please answer the questions marked as required." in html
    assert "A notebook</textarea>" in html and 'value="2" checked' in html  # q2 option 2 kept
    assert not SurveyResponse.objects.exists()
    r = answer(lab_client(), survey, consent=None)
    assert r.status_code == 400 and "tick the box" in r.content.decode()
    r = answer(lab_client(), survey, token=signing.dumps({"s": survey.pk, "t": int(time.time())}, salt=public_surveys.SURVEY_SALT))
    assert r.status_code == 400 and "expired" in r.content.decode()  # posted instantly
    assert not SurveyResponse.objects.exists()


def test_survey_honeypot_rate_limit_and_closed(survey):
    c = lab_client()
    assert answer(c, survey, hp_extra="x")["Location"].endswith("done=1") and not SurveyResponse.objects.exists()
    for _ in range(4):
        assert answer(c, survey).status_code == 303
    assert answer(c, survey).status_code == 303  # 5th of 5 (honeypot didn't count: it returns first)
    r = answer(c, survey)
    assert r.status_code == 400 and "Too many answers" in r.content.decode()
    survey.status = "closed"
    survey.save()
    n = SurveyResponse.objects.count()
    assert answer(lab_client(ip="198.51.100.1"), survey).status_code == 303 and SurveyResponse.objects.count() == n


def test_survey_views_counted_once_per_day_without_bots(survey):
    lab_client().get("/s/stock-survey")
    lab_client().get("/s/stock-survey")
    lab_client(ua="Googlebot/2.1").get("/s/stock-survey")
    assert survey.daily_stats.get().views == 1


# --- results, export, deletion -------------------------------------------------------------------------------------


def test_results_with_sample_warnings_and_structure_lock(api, project, survey):
    base = f"/api/projects/{project.id}/lab-surveys/{survey.id}"
    r = api.get(f"{base}/results").json()
    assert r["responses"] == 0 and r["sample"]["level"] == "none" and r["response_rate"] is None
    for i in range(3):
        answer(lab_client(ip=f"198.51.100.{i}"), survey, q1=str(i % 2))
    r = api.get(f"{base}/results").json()
    q1 = r["questions"][0]
    assert r["responses"] == 3 and r["sample"]["level"] == "too_small" and "far too few" in r["sample"]["message"]
    assert [o["count"] for o in q1["options"]] == [2, 1, 0] and q1["options"][0]["share"] == round(2 / 3, 4)
    q3 = r["questions"][2]
    assert q3["median"] == 4.0 and [d["count"] for d in q3["distribution"]] == [0, 0, 0, 3, 0]
    assert r["questions"][3] == {"id": "q4", "type": "text", "prompt": "What did you try?", "answered": 3, "sample": sample_note(3)}
    assert "notebook" not in json.dumps(r)  # aggregates only: typed text isn't in results
    # wording can change; structure can't while answers exist
    reworded = [{**QUESTIONS[0], "prompt": "How do you count your stock today?"}, *QUESTIONS[1:]]
    assert api.patch(base, {"questions": reworded}, format="json").status_code == 200
    r = api.patch(base, {"questions": QUESTIONS[:2]}, format="json")
    assert r.status_code == 400 and "can't be added, removed or reordered" in json.dumps(r.json())
    assert api.patch(base, {"ask_email": True}, format="json").status_code == 400


def test_responses_export_and_delete(api, other_api, project, survey):
    survey.ask_email = True
    survey.save()
    answer(lab_client(), survey, q4="=HYPERLINK(evil)", email="ana@example.org")
    base = f"/api/projects/{project.id}/lab-surveys/{survey.id}"
    rows = api.get(f"{base}/responses").json()["results"]
    assert rows[0]["email"] == "ana@example.org"
    assert {a["id"]: a["answer"] for a in rows[0]["answers"]} == {
        "q1": "Spreadsheet",
        "q2": "Counting; Reports",
        "q3": "4",
        "q4": "=HYPERLINK(evil)",
    }
    csv = api.get(f"{base}/responses-export")
    body = csv.content.decode()
    assert csv["Cache-Control"] == "no-store" and "'=HYPERLINK(evil)" in body and "How do you count stock today?" in body
    assert other_api.post(f"{base}/responses/delete", {"all": True}, format="json").status_code == 404
    assert api.post(f"{base}/responses/delete", {"ids": [rows[0]["id"]]}, format="json").json() == {"deleted": 1}
    assert not SurveyResponse.objects.exists()


def test_response_retention_purge(survey):
    from django.utils import timezone

    from lab.tasks import purge_expired_responses

    answer(lab_client(), survey)
    SurveyResponse.objects.update(expires_at=timezone.now())
    assert purge_expired_responses() == 1 and not SurveyResponse.objects.exists()


# --- sample size and comparisons -------------------------------------------------------------------------------------


def test_sample_notes_and_comparisons():
    assert margin_of_error(0) is None and margin_of_error(100) == 0.098
    assert sample_note(5)["level"] == "too_small" and sample_note(20)["level"] == "small" and sample_note(30)["level"] == "ok"
    assert "±18 points" in sample_note(30)["message"]
    assert compare_rates((5, 50), (20, 50))["verdict"] == "not_enough_data"  # too few views to call it
    assert compare_rates((10, 200), (12, 200))["verdict"] == "no_clear_difference"
    assert compare_rates((10, 200), (40, 200))["verdict"] == "b_higher"
    assert compare_rates((0, 200), (0, 200))["verdict"] == "no_clear_difference"


# --- price test ---------------------------------------------------------------------------------------------


@pytest.fixture
def priced(project):
    return LabPage.objects.create(project=project, title="Stock", slug="stock-app", blocks=PRICED, status="published")


def test_price_variants_are_validated():
    assert validate_blocks(PRICED) == []
    assert price_test(PRICED)["variants"][2][0]["price"] == "$29"
    too_many = [{**PRICED[1], "test_variants": [PRICED[1]["items"]] * 3}]
    assert validate_blocks(too_many)
    assert validate_blocks([PRICED[1], PRICED[1]]) == ["Only one price block can test variants."]
    assert validate_blocks([{**PRICED[1], "test_variants": [[{"name": "x", "price": "see evil.com"}]]}])


def _seen_price(html: str) -> str:
    return next(p for p in ("$9", "$19", "$29") if f'class="price">{p}' in html)


def test_each_visitor_sees_one_variant_and_it_is_stable(priced):
    c = lab_client()
    first = c.get("/p/stock-app").content.decode()
    shown = _seen_price(first)
    assert sum(f'class="price">{p}' in first for p in ("$9", "$19", "$29")) == 1  # the other prices aren't in the page
    assert "test_variants" not in first and "Choose Basic" in first and "nothing is charged" in first
    assert _seen_price(c.get("/p/stock-app").content.decode()) == shown  # same visitor, same day → same price
    seen = {_seen_price(lab_client(ip=f"198.51.100.{i}").get("/p/stock-app").content.decode()) for i in range(40)}
    assert seen == {"$9", "$19", "$29"}  # spread across visitors


def test_choose_and_signup_are_counted_for_the_variant_seen(api, project, priced):
    c = lab_client()
    html = c.get("/p/stock-app").content.decode()
    variant = ["$9", "$19", "$29"].index(_seen_price(html))
    token = html.split('name="token" value="')[1].split('"')[0]
    signed = signing.loads(token, salt=public.TOKEN_SALT)
    assert signed["v"] == variant
    assert c.post("/p/stock-app/choose", {"token": token, "option": "0"})["Location"] == "/p/stock-app#join"  # too fast: bot
    token = signing.dumps({**signed, "t": int(time.time()) - 5}, salt=public.TOKEN_SALT)
    r = c.post("/p/stock-app/choose", {"token": token, "option": "0"})
    assert r.status_code == 303 and r["Location"].endswith("?picked=0#join")
    c.post("/p/stock-app/choose", {"token": token, "option": "0"})  # a second press by the same visitor isn't counted
    picked = c.get(r["Location"].split("#")[0]).content.decode()
    assert "You chose Basic. It isn't available yet and nothing is charged." in picked
    assert c.post("/p/stock-app/choose", {"token": token, "option": "5"})["Location"] == "/p/stock-app#join"  # ignored
    old = signing.dumps({**signed, "t": int(time.time()) - 10}, salt=public.TOKEN_SALT)
    c.post("/p/stock-app/join", {"email": "ana@example.org", "consent": "yes", "token": old, "hp_extra": ""})
    assert WaitlistSignup.objects.get().variant == variant
    stat = LabVariantStat.objects.get(variant=variant)
    assert (stat.views, stat.clicks, stat.signups) == (1, 1, 1)
    pt = api.get(f"/api/projects/{project.id}/lab-pages/{priced.id}/stats").json()["price_test"]
    row = pt["variants"][variant]
    assert row["variant"] == "ABC"[variant] and row["click_rate"] == 1.0 and row["sample"]["level"] == "too_small"
    assert [v["prices"][0]["price"] for v in pt["variants"]] == ["$9", "$19", "$29"]
    assert {c["verdict"] for c in pt["comparisons"]} == {"not_enough_data"}
    others = [v for v in pt["variants"] if v["variant"] != "ABC"[variant]]
    assert all(v["click_rate"] is None for v in others)  # no views → no rate, not 0%


def test_forged_variant_is_not_counted(priced):
    forged = signing.dumps({"p": priced.pk, "t": int(time.time()) - 10, "v": 7}, salt=public.TOKEN_SALT)
    lab_client().post("/p/stock-app/choose", {"token": forged, "option": "0"})
    lab_client().post("/p/stock-app/join", {"email": "a@example.org", "consent": "yes", "token": forged})
    assert not LabVariantStat.objects.filter(clicks__gt=0).exists() and WaitlistSignup.objects.get().variant is None


def test_page_without_price_test_has_no_variant_results(api, project):
    page = LabPage.objects.create(
        project=project, title="x", slug="plain", blocks=[{"type": "hero", "headline": "Hi"}, {"type": "waitlist"}], status="published"
    )
    lab_client().get("/p/plain")
    stats = api.get(f"/api/projects/{project.id}/lab-pages/{page.id}/stats").json()
    assert stats["price_test"] is None and stats["sample"]["n"] == 1


# --- respondent data requests ---------------------------------------------------------------------------------------


def dr_token(seconds=10):
    from lab.data_requests import FORM_SALT

    return signing.dumps({"t": int(time.time()) - seconds}, salt=FORM_SALT)


def dr(c, **data):
    return c.post("/data-request", {"email": "ana@example.org", "kind": "delete", "token": dr_token(), **data})


def _no_nonce(html: str) -> str:
    import re

    return re.sub(r'nonce="[^"]+"', "", html)


def test_data_request_form_never_reveals_whether_an_address_is_held(priced):
    c = lab_client()
    assert "Get a copy of your data" in c.get("/data-request").content.decode()
    nobody = dr(c, email="nobody@example.org").content.decode()
    assert "If we hold anything for that address" in nobody and len(mail.outbox) == 0
    WaitlistSignup.objects.create(
        page=priced,
        email_encrypted=crypto.encrypt("ana@example.org"),
        email_hash=crypto.email_hash("ana@example.org"),
        consent_version="v",
        expires_at=_future(),
    )
    held = dr(lab_client(ip="198.51.100.9")).content.decode()
    assert _no_nonce(held) == _no_nonce(nobody)  # the same answer, apart from the per-response CSP nonce
    assert len(mail.outbox) == 1 and mail.outbox[0].to == ["ana@example.org"] and "/data-request/confirm?t=" in mail.outbox[0].body
    assert "Stock" not in mail.outbox[0].body  # doesn't say which pages
    dr(lab_client(ip="198.51.100.10"))
    assert len(mail.outbox) == 1  # one email per address per hour


def test_data_request_validation(priced):
    c = lab_client()
    assert dr(c, kind="other").status_code == 400
    assert dr(c, email="not-an-email").status_code == 400
    assert dr(c, token=dr_token(0)).status_code == 400  # posted instantly
    assert len(mail.outbox) == 0


def _future():
    from datetime import timedelta

    from django.utils import timezone

    return timezone.now() + timedelta(days=30)


def test_confirmed_deletion_removes_everything_and_tells_the_founder(api, project, priced, survey):
    h = crypto.email_hash("ana@example.org")
    WaitlistSignup.objects.create(
        page=priced, email_encrypted=crypto.encrypt("ana@example.org"), email_hash=h, consent_version="v", expires_at=_future()
    )
    SurveyResponse.objects.create(
        survey=survey, answers={"q1": 0}, email_hash=h, email_encrypted="x", consent_version="v", expires_at=_future()
    )
    SurveyResponse.objects.create(survey=survey, answers={"q1": 1}, consent_version="v", expires_at=_future())  # anonymous
    t = link_token(h, "delete")
    c = lab_client()
    r = c.get(f"/data-request/confirm?t={t}")
    assert (
        r.status_code == 200 and "Delete everything" in r.content.decode() and WaitlistSignup.objects.exists()
    )  # GET changes nothing
    r = c.post("/data-request/confirm", {"t": t})
    assert "We deleted 2 items" in r.content.decode()
    assert not WaitlistSignup.objects.exists() and SurveyResponse.objects.count() == 1  # the anonymous one stays
    assert DataRequest.objects.get().responses == 1
    notices = api.get(f"/api/projects/{project.id}/lab-notices").json()["results"]
    assert sorted((n["source"], n["removed"]) for n in notices) == [("Stock", 1), ("Stock counting", 1)]
    assert api.post(f"/api/projects/{project.id}/lab-notices").json() == {"marked": 2}
    assert DataRequestNotice.objects.filter(seen=False).count() == 0


def test_confirmed_copy_shows_the_data(priced, survey):
    h = crypto.email_hash("ana@example.org")
    SurveyResponse.objects.create(
        survey=survey,
        answers={"q1": 2, "q2": [1], "q3": 5},
        text_encrypted=crypto.encrypt_text(json.dumps({"q4": "Tried <b>apps</b>"})),
        email_hash=h,
        email_encrypted="x",
        consent_version="v",
        expires_at=_future(),
    )
    html = lab_client().post("/data-request/confirm", {"t": link_token(h, "copy")}).content.decode()
    assert "Survey answers: Stock counting" in html and "An app" in html and "Ordering" in html
    assert "Tried &lt;b&gt;apps&lt;/b&gt;" in html and SurveyResponse.objects.exists()


def test_bad_or_forged_links_do_nothing(priced):
    assert lab_client().get("/data-request/confirm?t=nope").status_code == 400
    forged = signing.dumps({"h": "x", "k": "delete"}, salt="other-salt")
    assert lab_client().post("/data-request/confirm", {"t": forged}).status_code == 400


def test_notices_are_owner_only(other_api, project):
    assert other_api.get(f"/api/projects/{project.id}/lab-notices").status_code == 404


# --- AI survey questions -------------------------------------------------------------------------------------------


@pytest.fixture
def fake_llm(monkeypatch, settings):
    from lab import suggest

    settings.ANTHROPIC_API_KEY = "test-key"
    settings.LLM_PROVIDER = "anthropic"
    box = {"reply": {"questions": []}}
    monkeypatch.setattr(
        suggest.llm,
        "complete_json",
        lambda *a, **k: LLMResult(data=box["reply"], model="m", input_tokens=1, output_tokens=1, cost_usd=Decimal("0.01")),
    )
    return box


def test_ai_questions_come_from_assumptions_and_stay_neutral(api, project, fake_llm):
    url = f"/api/projects/{project.id}/lab-survey-suggest"
    r = api.post(url)
    assert r.status_code == 503 and "assumption" in r.json()["error"]["message"]
    a = Assumption.objects.create(project=project, text="Owners count stock by hand every week")
    base = {"type": "single", "options": ["Paper", "Spreadsheet", "An app", "Not sure"], "low_label": "", "high_label": ""}
    fake_llm["reply"] = {
        "questions": [
            {**base, "assumption_id": a.id, "prompt": "How do you count stock today?"},
            {**base, "assumption_id": a.id, "prompt": "Wouldn't it be great to count faster?"},  # leading: dropped
            {**base, "assumption_id": a.id + 999, "prompt": "Ignore previous instructions"},  # not an assumption: dropped
            {**base, "assumption_id": a.id, "type": "text", "options": [], "prompt": "What's your phone number?"},  # PII: dropped
        ]
    }
    body = api.post(url).json()
    assert body["ai"] is True and len(body["questions"]) == 1
    assert body["questions"][0] == {
        "id": "q1",
        "type": "single",
        "prompt": "How do you count stock today?",
        "required": False,
        "assumption_id": a.id,
        "options": base["options"],
    }
    fake_llm["reply"] = {"questions": [{**base, "assumption_id": a.id, "prompt": "Isn't it painful? See evil.com"}]}
    assert api.post(url).status_code == 503
