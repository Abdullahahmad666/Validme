from django.utils import timezone
from rest_framework.test import APIClient

from evidence.models import Evidence
from projects.models import Project
from research.models import ResearchJob

IDEA = "A tool that helps independent restaurants track inventory and reduce food waste."


def create(api, **extra) -> dict:
    body = {"name": "Restaurant inventory", "description": IDEA, "objectives": ["validate_demand"], **extra}
    r = api.post("/api/projects", body, format="json")
    assert r.status_code == 201, r.content
    return r.json()


def test_create_draft(api, user):
    data = create(api, audiences=["restaurant owners"], customer_type="B2B")
    assert data["status"] == "DRAFT"
    assert data["description"] == IDEA
    project = Project.objects.get(pk=data["id"])
    assert project.owner == user
    assert project.idea.original_description == IDEA
    assert project.market.audiences == ["restaurant owners"]


def test_create_rejects_unknown_objective_and_bad_url(api):
    r = api.post(
        "/api/projects",
        {"name": "Valid name", "description": IDEA, "objectives": ["get_rich"], "existing_product_url": "ftp://x"},
        format="json",
    )
    assert r.status_code == 400
    assert set(r.json()["error"]["details"]) >= {"objectives", "existing_product_url"}


def test_objectives_cannot_be_emptied(api):
    data = create(api)
    r = api.patch(f"/api/projects/{data['id']}", {"objectives": []}, format="json")
    assert r.status_code == 400
    assert "objectives" in r.json()["error"]["details"]


def test_description_length_limits(api):
    r = api.post("/api/projects", {"name": "Valid name", "description": "x" * 2001}, format="json")
    assert r.status_code == 400


def test_status_is_read_only(api):
    data = create(api)
    api.patch(f"/api/projects/{data['id']}", {"status": "COMPLETED"}, format="json")
    assert Project.objects.get(pk=data["id"]).status == "DRAFT"


def test_partial_update_autosave(api):
    data = create(api)
    r = api.patch(f"/api/projects/{data['id']}", {"name": "Kitchen waste tracker", "geographies": ["US"]}, format="json")
    assert r.status_code == 200
    assert r.json()["name"] == "Kitchen waste tracker"
    assert r.json()["geographies"] == ["US"]
    assert r.json()["description"] == IDEA  # untouched fields survive


def test_list_is_paginated_and_filterable(api):
    create(api)
    second = create(api, name="Second idea")
    Project.objects.filter(pk=second["id"]).update(status="ARCHIVED")
    body = api.get("/api/projects").json()
    assert body["count"] == 2
    assert "results" in body
    assert api.get("/api/projects?status=ARCHIVED").json()["count"] == 1


def test_delete(api):
    data = create(api)
    assert api.delete(f"/api/projects/{data['id']}").status_code == 204
    assert not Project.objects.filter(pk=data["id"]).exists()


def test_owner_isolation(api, other_api):
    data = create(api)
    url = f"/api/projects/{data['id']}"
    assert other_api.get(url).status_code == 404
    assert other_api.patch(url, {"name": "Hijacked"}, format="json").status_code == 404
    assert other_api.delete(url).status_code == 404
    assert other_api.get("/api/projects").json()["count"] == 0
    assert Project.objects.get(pk=data["id"]).name == "Restaurant inventory"


def test_requires_authentication(db):
    assert APIClient().get("/api/projects").status_code == 401
    assert APIClient().post("/api/projects", {}, format="json").status_code == 401


def test_dashboard_summary_counts_only_own_data(api, other_api):
    keys = ("projects", "reports", "evidence", "active_jobs")
    empty = {"projects": 0, "reports": 0, "evidence": 0, "active_jobs": 0}
    assert {k: api.get("/api/dashboard/summary").json()[k] for k in keys} == empty
    mine = Project.objects.get(pk=create(api)["id"])
    create(other_api)
    ResearchJob.objects.create(project=mine, idempotency_key="k", status="RUNNING")
    Evidence.objects.create(
        project=mine,
        provider="hackernews",
        source_url="https://news.ycombinator.com/item?id=1",
        excerpt="We throw away a lot of produce every week.",
        retrieved_at=timezone.now(),
        content_hash="a",
    )
    body = api.get("/api/dashboard/summary").json()
    assert {k: body[k] for k in keys} == {"projects": 1, "reports": 0, "evidence": 1, "active_jobs": 1}
    assert body["plan"] == "free" and isinstance(body["credits"], int)


def test_dashboard_activity_and_next_actions_are_real_and_own(api, other_api, user):
    from datetime import timedelta

    from lab.models import LabPage
    from radar.models import Signal
    from reports.models import Report

    mine = Project.objects.get(pk=create(api)["id"])
    theirs = Project.objects.get(pk=create(other_api)["id"])
    body = api.get("/api/dashboard/summary").json()
    assert body["recent_activity"] == []
    assert body["next_actions"][0]["title"].startswith("Finish setting up") and body["next_actions"][0]["link"].endswith(str(mine.id))
    mine.status = "COMPLETED"
    mine.save()
    job = ResearchJob.objects.create(project=mine, idempotency_key="k", status="COMPLETED", completed_at=timezone.now())
    Report.objects.create(project=mine, job=job, content={})
    Signal.objects.create(
        project=mine,
        kind="complaint_theme",
        type="opportunity",
        key="k",
        title="POS sync",
        facts={},
        relevance=0.5,
        impact=0.5,
        rank=0.25,
        confidence="medium",
    )
    Signal.objects.create(
        project=theirs,
        kind="complaint_theme",
        type="opportunity",
        key="k",
        title="Not yours",
        facts={},
        relevance=0.5,
        impact=0.5,
        rank=0.25,
        confidence="medium",
    )
    body = api.get("/api/dashboard/summary").json()
    kinds = [e["kind"] for e in body["recent_activity"]]
    assert "report" in kinds and "signal" in kinds and all("Not yours" not in e["title"] for e in body["recent_activity"])
    titles = [a["title"] for a in body["next_actions"]]
    assert any("Radar signal" in t for t in titles) and any("landing page" in t for t in titles)
    assert all(a["project_id"] == str(mine.id) for a in body["next_actions"])
    LabPage.objects.create(project=mine, title="P", slug="p-one", status="published", published_at=timezone.now())
    titles = [a["title"] for a in api.get("/api/dashboard/summary").json()["next_actions"]]
    assert not any("landing page" in t for t in titles)
    Report.objects.filter(project=mine).update(created_at=timezone.now() - timedelta(days=90))


def test_project_cards_show_stages_and_score_without_extra_queries(api, django_assert_max_num_queries):
    from reports.models import Opportunity
    from research.models import JobStage

    ids = [create(api)["id"] for _ in range(3)]
    for pid in ids:
        p = Project.objects.get(pk=pid)
        p.status = "COMPLETED"
        p.save()
        job = ResearchJob.objects.create(project=p, idempotency_key=pid, status="COMPLETED")
        JobStage.objects.create(job=job, name="web_research", order=1, status="COMPLETED")
        JobStage.objects.create(job=job, name="report", order=2, status="COMPLETED")
        Opportunity.objects.create(project=p, score=62, confidence="medium", recommendation="research_more")
    with django_assert_max_num_queries(10):
        rows = api.get("/api/projects").json()["results"]
    prog = rows[0]["progress"]
    assert [s["name"] for s in prog["stages"]] == ["web_research", "report"] and prog["score"] == 62


def test_dashboard_weekly_evidence_is_zero_filled_and_own(api, other_api):
    mine = Project.objects.get(pk=create(api)["id"])
    theirs = Project.objects.get(pk=create(other_api)["id"])
    for p, h in ((mine, "a"), (mine, "b"), (theirs, "c")):
        Evidence.objects.create(
            project=p,
            provider="hackernews",
            source_url=f"https://x.test/{h}",
            excerpt="e",
            retrieved_at=timezone.now(),
            content_hash=h,
        )
    weeks = api.get("/api/dashboard/summary").json()["weekly_evidence"]
    assert len(weeks) == 12 and weeks[-1]["records"] == 2 and sum(w["records"] for w in weeks) == 2
