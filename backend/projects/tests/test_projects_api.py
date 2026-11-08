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
    empty = {"projects": 0, "reports": 0, "evidence": 0, "active_jobs": 0}
    assert api.get("/api/dashboard/summary").json() == empty
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
    assert api.get("/api/dashboard/summary").json() == {"projects": 1, "reports": 0, "evidence": 1, "active_jobs": 1}
