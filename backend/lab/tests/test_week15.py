"""Week 15: experiments as tier-1 evidence, assumptions marked from survey results, predicted vs actual, scoped keys."""

from datetime import timedelta

import pytest
from django.utils import timezone

from lab.blocks import price_test
from lab.experiments import MIN_VIEWS, project_experiments, wilson
from lab.models import LabDailyStat, LabPage, LabVariantStat
from projects.models import IdeaDefinition, Project
from reports.scoring import Dimension, score_project, with_experiment

PRICED = [
    {"type": "hero", "headline": "Count stock faster"},
    {
        "type": "pricing",
        "items": [{"name": "Basic", "price": "$9", "period": "/month"}],
        "test_variants": [[{"name": "Basic", "price": "$19", "period": "/month"}]],
    },
    {"type": "waitlist"},
]


@pytest.fixture
def project(user):
    p = Project.objects.create(owner=user, name="Stock app", status="COMPLETED")
    IdeaDefinition.objects.create(project=p, original_description="Stock counting for small restaurants.")
    return p


def live_page(project, slug="stock-app", blocks=PRICED, views=0, signups=0, status="published"):
    page = LabPage.objects.create(project=project, title=slug, slug=slug, blocks=blocks, status=status, published_at=timezone.now())
    if views:
        LabDailyStat.objects.create(page=page, day=timezone.localdate(), views=views, signups=signups)
    return page


# --- D1: experiments as tier-1 evidence ----------------------------------------------------------------------------


def test_wilson_interval():
    assert wilson(0, 0) is None
    low, high = wilson(10, 100)
    assert round(low, 3) == 0.055 and round(high, 3) == 0.174
    assert wilson(0, 50)[0] == 0.0


def test_too_few_views_are_mentioned_but_not_scored(project):
    live_page(project, views=MIN_VIEWS - 1, signups=10)
    exp = project_experiments(project)["demand_evidence"]
    assert exp.counted is False and exp.score is None and f"needs {MIN_VIEWS}" in exp.explanation
    dim = with_experiment(Dimension("demand_evidence", 40, "medium", "12 sources."), exp)
    assert dim.score == 40 and dim.research_score == 40 and "Too few views" in dim.explanation


def test_small_samples_score_lower_than_large_ones_at_the_same_rate(project, make_user):
    live_page(project, views=40, signups=4)
    small = project_experiments(project)["demand_evidence"]
    other = Project.objects.create(owner=make_user("c@example.com"), name="x")
    live_page(other, slug="big", views=1000, signups=100)
    big = project_experiments(other)["demand_evidence"]
    assert small.rate == big.rate == 0.1
    assert small.score < big.score <= 100 and small.confidence == "low" and big.confidence == "high"
    assert "at least" in big.explanation and "10% target" in big.explanation


def test_experiment_blends_into_research_or_scores_alone():
    from lab.experiments import ExperimentResult

    exp = ExperimentResult(
        "demand_evidence", 400, 40, "waitlist sign-ups", counted=True, score=70, confidence="high", explanation="E."
    )
    blended = with_experiment(Dimension("demand_evidence", 20, "low", "R."), exp)
    assert blended.score == round(0.6 * 70 + 0.4 * 20) and blended.research_score == 20 and blended.confidence == "high"
    assert blended.experiment["score"] == 70
    alone = with_experiment(Dimension("willingness_to_pay", None, "low", "Nothing."), exp)
    assert alone.score == 70 and alone.research_score is None and "experiment alone" in alone.explanation


def test_only_pages_that_were_live_count_and_price_tests_use_the_current_version(project):
    LabPage.objects.create(project=project, title="draft", slug="draft", blocks=PRICED)  # never published: ignored
    page = live_page(project, views=200, signups=10)
    key = price_test(page.blocks)["key"]
    LabVariantStat.objects.create(page=page, test_key=key, variant=0, day=timezone.localdate(), views=100, clicks=12)
    LabVariantStat.objects.create(page=page, test_key=key, variant=1, day=timezone.localdate(), views=100, clicks=8)
    LabVariantStat.objects.create(page=page, test_key="old", variant=0, day=timezone.localdate(), views=500, clicks=400)
    exps = project_experiments(project)
    assert (exps["demand_evidence"].trials, exps["demand_evidence"].successes) == (200, 10)
    pay = exps["willingness_to_pay"]
    assert (pay.trials, pay.successes) == (200, 20) and pay.sources == [{"kind": "price_test", "id": page.id, "title": "stock-app"}]


def test_no_lab_pages_means_no_experiments_and_a_tip(project):
    assert project_experiments(project) == {}
    result = score_project([], [], [], {})
    assert "Validation Lab" in result["what_would_change"][0] and result["experiments_used"] == []
    assert all(d["experiment"] is None for d in result["dimensions"])


def test_report_and_rescore_use_experiments(project):
    from radar.models import ScoreSnapshot
    from radar.services import rescore
    from reports.models import Report
    from reports.scoring import SCORING_VERSION

    Report.objects.create(project=project, content={})
    live_page(project, views=500, signups=60)
    snap = rescore(project, now=timezone.now() + timedelta(days=1))
    assert snap is not None and snap.scoring_version == SCORING_VERSION == "score_v2"
    assert snap.dimensions["demand_evidence"] is not None  # scored from the experiment alone (no research evidence)
    assert ScoreSnapshot.objects.count() == 1


# --- D3: assumptions marked from survey results -------------------------------------------------------------------


def _survey(project, assumption, **q):
    from lab.models import Survey

    question = {"id": "q1", "type": "single", "prompt": "How do you count stock?", "options": ["Paper", "An app", "Other"]}
    question.update({"assumption_id": assumption.id, "support_options": [0], **q})
    return Survey.objects.create(
        project=project, title="Stock", slug="stock-q", questions=[question], status="published", published_at=timezone.now()
    )


def _answers(survey, values):
    from lab.models import SurveyResponse

    for v in values:
        SurveyResponse.objects.create(
            survey=survey, answers={"q1": v}, consent_version="v", expires_at=timezone.now() + timedelta(days=30)
        )


@pytest.fixture
def assumption(project):
    from projects.models import Assumption

    return Assumption.objects.create(project=project, text="Owners count stock on paper")


def test_supporting_answer_rules_are_validated():
    from lab.surveys import validate_questions

    q = {"id": "q1", "type": "single", "prompt": "How?", "options": ["Paper", "App"]}
    assert validate_questions([{**q, "support_options": [0]}]) == []
    assert validate_questions([{**q, "support_options": [5]}])  # not an option
    assert validate_questions([{**q, "support_options": [0, 1]}])  # every option supports: can't test anything
    assert validate_questions([{**q, "support_min": 4}])  # scale-only rule
    assert validate_questions([{"id": "q2", "type": "scale", "prompt": "How painful?", "support_min": 4}]) == []
    assert validate_questions([{"id": "q2", "type": "scale", "prompt": "How painful?", "support_min": 9}])


def test_too_few_answers_stay_inconclusive_and_untested(project, assumption):
    from lab.verdicts import evaluate_assumptions

    _answers(_survey(project, assumption), [0] * 9)
    evaluate_assumptions(project)
    assumption.refresh_from_db()
    assert assumption.auto_status == "inconclusive" and assumption.status == "untested" and "too few to judge" in assumption.auto_basis


def test_clear_majorities_mark_the_assumption_and_cite_the_question(project, assumption):
    from lab.verdicts import evaluate_assumptions

    survey = _survey(project, assumption)
    _answers(survey, [0] * 18 + [1] * 2)
    evaluate_assumptions(project)
    assumption.refresh_from_db()
    assert (assumption.auto_status, assumption.status) == ("supported", "supported")
    ref = assumption.auto_refs[0]
    assert (ref["survey_id"], ref["question_id"], ref["n"], ref["k"]) == (survey.id, "q1", 20, 18)
    assert "18 of 20 gave a supporting answer" in assumption.auto_basis
    _answers(survey, [1] * 40)  # now 18 of 60
    evaluate_assumptions(project)
    assumption.refresh_from_db()
    assert (assumption.auto_status, assumption.status) == ("contradicted", "contradicted")


def test_a_close_split_is_inconclusive(project, assumption):
    from lab.verdicts import evaluate_assumptions

    _answers(_survey(project, assumption), [0] * 11 + [1] * 9)
    evaluate_assumptions(project)
    assumption.refresh_from_db()
    assert assumption.auto_status == "inconclusive" and assumption.status == "untested"


def test_scale_and_multi_rules(project, assumption):
    from lab.verdicts import evaluate_assumptions

    survey = _survey(project, assumption, type="scale", options=[], support_options=[], support_min=4)
    survey.questions[0].pop("options")
    survey.questions[0].pop("support_options")
    survey.save()
    _answers(survey, [5] * 12 + [4] * 6 + [2] * 2)
    evaluate_assumptions(project)
    assumption.refresh_from_db()
    assert assumption.auto_status == "supported" and assumption.auto_refs[0]["k"] == 18


def test_the_founders_call_wins_until_they_hand_it_back(api, project, assumption):
    from lab.verdicts import evaluate_assumptions

    _answers(_survey(project, assumption), [0] * 20)
    evaluate_assumptions(project)
    url = f"/api/projects/{project.id}/assumptions/{assumption.id}"
    r = api.patch(url, {"status": "contradicted", "note": "Talked to 5 owners: they use apps."}, format="json").json()
    assert r["status"] == "contradicted" and r["status_locked"] is True and r["auto_status"] == "supported"
    evaluate_assumptions(project)
    assumption.refresh_from_db()
    assert assumption.status == "contradicted"  # an override survives recomputation
    r = api.patch(url, {"follow_experiments": True}, format="json").json()
    assert r["status"] == "supported" and r["status_locked"] is False
    assert api.patch(url, {"auto_status": "contradicted"}, format="json").json()["auto_status"] == "supported"  # read-only


def test_existing_founder_statuses_are_locked_by_the_migration():
    import importlib

    mod = importlib.import_module("projects.migrations.0007_assumption_verdicts")
    assert any(type(op).__name__ == "RunPython" for op in mod.Migration.operations)


def test_answers_and_deletions_update_the_verdict(api, project, assumption, django_capture_on_commit_callbacks):
    from lab import public_surveys
    from lab.models import SurveyResponse

    survey = _survey(project, assumption)
    _answers(survey, [0] * 9)
    import time

    from django.core import signing
    from django.test import Client

    token = signing.dumps({"s": survey.pk, "t": int(time.time()) - 10}, salt=public_surveys.SURVEY_SALT)
    c = Client(HTTP_HOST="127.0.0.1:8000", HTTP_USER_AGENT="Mozilla/5.0")
    with django_capture_on_commit_callbacks(execute=True):  # the verdict is recomputed after the answer is committed
        assert c.post("/s/stock-q/answer", {"q1": "0", "consent": "yes", "token": token}).status_code == 303
    assumption.refresh_from_db()
    assert assumption.status == "supported"  # the 10th answer made it decisive
    ids = list(SurveyResponse.objects.values_list("id", flat=True)[:5])
    api.post(f"/api/projects/{project.id}/lab-surveys/{survey.id}/responses/delete", {"ids": ids}, format="json")
    assumption.refresh_from_db()
    assert assumption.status == "untested" and assumption.auto_status == "inconclusive"


def test_rules_set_after_answers_are_flagged(api, project, assumption):
    from lab.verdicts import evaluate_assumptions

    survey = _survey(project, assumption)
    _answers(survey, [1] * 20)
    q = {**survey.questions[0], "support_options": [1]}  # changed after seeing results
    r = api.patch(f"/api/projects/{project.id}/lab-surveys/{survey.id}", {"questions": [q]}, format="json")
    assert r.status_code == 200
    evaluate_assumptions(project)
    assumption.refresh_from_db()
    assert assumption.auto_status == "supported" and assumption.auto_refs[0]["late_rule"] is True
    assert "chosen after people had answered" in assumption.auto_basis


# --- D2: predicted vs actual ---------------------------------------------------------------------------------------


def test_predicted_vs_actual(api, other_api, project, assumption):
    from reports.models import Report

    url = f"/api/projects/{project.id}/predicted-vs-actual"
    empty = api.get(url).json()
    assert empty["report"] is None and [d["predicted"] for d in empty["dimensions"]] == [None, None]
    assert [d["actual"] for d in empty["dimensions"]] == [None, None]  # nothing invented without data
    dims = [
        {"key": "demand_evidence", "score": 62, "research_score": 40, "confidence": "medium", "explanation": "R."},
        {"key": "willingness_to_pay", "score": 30, "confidence": "low", "explanation": "Old report."},  # pre-v2
    ]
    Report.objects.create(project=project, content={"opportunity": {"dimensions": dims}})
    live_page(project, views=120, signups=18)
    body = api.get(url).json()
    demand, pay = body["dimensions"]
    assert demand["predicted"]["score"] == 40 and demand["actual"]["counted"] is True and demand["actual"]["trials"] == 120
    assert pay["predicted"]["score"] == 30 and pay["actual"] is None  # no price-test views yet
    assert body["live_pages"] == 1 and body["assumptions"][0]["text"] == "Owners count stock on paper"
    assert other_api.get(url).status_code == 404


# --- D4: API key scopes ---------------------------------------------------------------------------------------------


def key_client(user, scopes=None):
    from rest_framework.test import APIClient

    from accounts.services import issue_api_key

    _, raw = issue_api_key(user, "mcp", scopes)
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Api-Key {raw}")
    return c


def test_scope_table_is_default_deny():
    from accounts.scopes import required_scope

    p = "/api/projects/7f0c"
    assert required_scope("GET", f"{p}/signals") == "monitoring:read"
    assert required_scope("PATCH", f"{p}/signals/3") == "monitoring:write"
    assert required_scope("POST", f"{p}/signals/refresh") is None  # triggers work: web only
    assert required_scope("GET", f"{p}/lab-surveys/2/results") == "lab:read"
    for personal in ("responses", "responses-export", "signups", "signups-export"):
        assert required_scope("GET", f"{p}/lab-pages/2/{personal}") is None
        assert required_scope("GET", f"{p}/lab-surveys/2/{personal}") is None
    assert required_scope("POST", f"{p}/watches") is None and required_scope("POST", f"{p}/lab-pages/1/publish") is None
    assert required_scope("GET", "/api/api-keys") is None and required_scope("POST", "/api/billing/checkout") is None
    assert required_scope("DELETE", f"{p}/assumptions/1") is None
    assert required_scope("GET", "/api/some-new-endpoint") is None


def test_keys_get_default_scopes_and_old_behaviour(user, project):
    from accounts.models import ApiKey

    c = key_client(user)
    assert ApiKey.objects.get().scopes == ["research:read", "research:run", "monitoring:read", "lab:read"]
    assert c.get(f"/api/projects/{project.id}/predicted-vs-actual").status_code == 200
    assert c.get(f"/api/projects/{project.id}/signals").status_code == 200


def test_missing_scope_is_refused_with_a_clear_message(user, project):
    c = key_client(user, ["research:read"])
    assert c.get(f"/api/projects/{project.id}").status_code == 200
    r = c.get(f"/api/projects/{project.id}/predicted-vs-actual")
    assert r.status_code == 403 and "lab:read" in r.json()["error"]["message"]
    assert c.get(f"/api/projects/{project.id}/watches").status_code == 403
    assert c.post("/api/projects", {"name": "x"}, format="json").status_code == 403  # research:run missing


def _signal(project):
    from radar.models import Signal

    return Signal.objects.create(
        project=project,
        kind="complaint_theme",
        type="opportunity",
        key="k",
        title="T",
        facts={},
        relevance=0.5,
        impact=0.5,
        rank=0.25,
        confidence="medium",
    )


def test_confirm_actions_need_their_write_scope(user, project, assumption):

    sig = _signal(project)
    reader = key_client(user)
    assert reader.patch(f"/api/projects/{project.id}/signals/{sig.id}", {"status": "acted"}, format="json").status_code == 403
    assert (
        reader.patch(f"/api/projects/{project.id}/assumptions/{assumption.id}", {"status": "supported"}, format="json").status_code
        == 403
    )
    writer = key_client(user, ["monitoring:write", "assumptions:write"])
    assert writer.patch(f"/api/projects/{project.id}/signals/{sig.id}", {"status": "acted"}, format="json").status_code == 200
    sig.refresh_from_db()
    assert sig.status == "acted"
    assert writer.post(f"/api/projects/{project.id}/signals/refresh").status_code == 403  # still web-only
    url = f"/api/projects/{project.id}/assumptions/{assumption.id}"
    r = writer.patch(url, {"status": "supported", "note": "From 5 calls"}, format="json")
    assert r.status_code == 200 and r.json()["status_locked"] is True
    assert writer.patch(url, {"text": "Something else"}, format="json").status_code == 403  # only status / note
    assert writer.delete(url).status_code == 403


def test_personal_data_is_never_reachable_with_a_key(user, project):
    from lab.models import Survey

    s = Survey.objects.create(project=project, title="S", slug="s-one", questions=[])
    c = key_client(user, ["research:read", "research:run", "monitoring:read", "monitoring:write", "lab:read", "assumptions:write"])
    for path in ("responses", "responses-export"):
        assert c.get(f"/api/projects/{project.id}/lab-surveys/{s.id}/{path}").status_code == 403
    assert c.get(f"/api/projects/{project.id}/lab-surveys/{s.id}/results").status_code == 200


def test_scopes_are_managed_only_in_the_web_app(api, user):
    r = api.post("/api/api-keys", {"name": "Claude", "scopes": ["research:read", "lab:read"]}, format="json")
    assert r.status_code == 201 and r.json()["scopes"] == ["research:read", "lab:read"]
    kid = r.json()["id"]
    assert api.post("/api/api-keys", {"name": "x", "scopes": ["admin"]}, format="json").status_code == 400
    assert api.patch(f"/api/api-keys/{kid}", {"scopes": ["research:read"]}, format="json").json()["scopes"] == ["research:read"]
    key = key_client(user, ["research:read"])
    assert key.patch(f"/api/api-keys/{kid}", {"scopes": ["lab:read"]}, format="json").status_code == 403


def test_signal_patch_by_other_users_key_is_404(make_user, project):

    sig = _signal(project)
    c = key_client(make_user("eve@example.com"), ["monitoring:write"])
    assert c.patch(f"/api/projects/{project.id}/signals/{sig.id}", {"status": "dismissed"}, format="json").status_code == 404
