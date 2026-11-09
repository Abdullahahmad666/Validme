import pytest
from rest_framework.test import APIClient

from accounts.models import ApiKey, User
from billing.models import UsageTransaction
from research.models import ResearchJob

IDEA = "A tool that helps independent restaurants track inventory and reduce food waste."


@pytest.fixture
def user(db):
    return User.objects.create_user("ana", "ana@example.com", "pw-12345678", credits=5)


@pytest.fixture
def other(db):
    return User.objects.create_user("bob", "bob@example.com", "pw-12345678", credits=5)


@pytest.fixture
def api(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


@pytest.fixture(autouse=True)
def no_celery(monkeypatch):
    monkeypatch.setattr("research.views.run_research_job.delay", lambda job_id: None)


def make_project(api):
    r = api.post("/api/projects", {"name": "Restaurant inventory", "description": IDEA, "audiences": ["owners"]}, format="json")
    assert r.status_code == 201, r.content
    return r.json()["id"]


def test_validation_limits(api):
    r = api.post("/api/projects", {"name": "ab", "description": "short"}, format="json")
    assert r.status_code == 400
    assert set(r.json()["error"]["details"]) >= {"name", "description"}


def test_other_user_cannot_see_project(api, other):
    pid = make_project(api)
    c = APIClient()
    c.force_authenticate(other)
    assert c.get(f"/api/projects/{pid}").status_code == 404
    assert c.get("/api/projects").json()["count"] == 0


def test_job_requires_idempotency_key(api):
    pid = make_project(api)
    assert api.post("/api/research/jobs", {"project": pid}, format="json").status_code == 400


def test_job_charges_once_per_idempotency_key(api, user):
    pid = make_project(api)
    first = api.post("/api/research/jobs", {"project": pid}, format="json", HTTP_IDEMPOTENCY_KEY="k1")
    again = api.post("/api/research/jobs", {"project": pid}, format="json", HTTP_IDEMPOTENCY_KEY="k1")
    assert first.status_code == 201 and again.status_code == 200
    assert first.json()["id"] == again.json()["id"]
    user.refresh_from_db()
    assert user.credits == 3  # standard = 2 credits, charged once
    assert UsageTransaction.objects.filter(user=user, operation="research_job").count() == 1
    assert [s["name"] for s in first.json()["stages"]][0] == "idea_analysis"


def test_insufficient_credits(api, user):
    user.credits = 0
    user.save()
    pid = make_project(api)
    r = api.post("/api/research/jobs", {"project": pid, "depth": "deep"}, format="json", HTTP_IDEMPOTENCY_KEY="k2")
    assert r.status_code == 402
    assert ResearchJob.objects.count() == 0


def test_cannot_start_job_on_other_users_project(api, other):
    pid = make_project(api)
    c = APIClient()
    c.force_authenticate(other)
    r = c.post("/api/research/jobs", {"project": pid}, format="json", HTTP_IDEMPOTENCY_KEY="k3")
    assert r.status_code == 404


def test_api_key_auth(user):
    _, raw = ApiKey.issue(user, "mcp")
    c = APIClient()
    assert c.get("/api/projects", HTTP_AUTHORIZATION=f"Api-Key {raw}").status_code == 200
    assert c.get("/api/projects", HTTP_AUTHORIZATION="Api-Key wrong").status_code == 401


def test_sources_lists_unavailable(api):
    keys = {s["key"]: s["availability"] for s in api.get("/api/research/sources").json()["results"]}
    assert keys["reddit"] == "UNAVAILABLE"
    assert keys["hackernews"] == "AVAILABLE"


def test_jobs_filter_by_project_and_isolation(api, other):
    pid = make_project(api)
    api.post("/api/research/jobs", {"project": pid, "depth": "quick"}, format="json", HTTP_IDEMPOTENCY_KEY="f1")
    assert api.get(f"/api/research/jobs?project={pid}").json()["count"] == 1
    c = APIClient()
    c.force_authenticate(other)
    assert c.get(f"/api/research/jobs?project={pid}").json()["count"] == 0


def test_second_job_on_same_project_is_rejected(api):
    pid = make_project(api)
    api.post("/api/research/jobs", {"project": pid, "depth": "quick"}, format="json", HTTP_IDEMPOTENCY_KEY="a")
    r = api.post("/api/research/jobs", {"project": pid, "depth": "quick"}, format="json", HTTP_IDEMPOTENCY_KEY="b")
    assert r.status_code == 409


def test_job_snapshot_uses_project_config(api):
    pid = make_project(api)
    api.patch(
        f"/api/projects/{pid}",
        {"depth": "quick", "sources": ["hackernews"], "exclude_terms": ["jobs"], "evidence_urls": ["https://example.com/thread"]},
        format="json",
    )
    job = api.post("/api/research/jobs", {"project": pid}, format="json", HTTP_IDEMPOTENCY_KEY="c").json()
    snap = ResearchJob.objects.get(pk=job["id"]).config_snapshot
    assert job["depth"] == "quick"
    assert snap["sources"] == ["hackernews"]
    assert snap["exclude_terms"] == ["jobs"]
    assert snap["evidence_urls"] == ["https://example.com/thread"]


def test_unknown_source_rejected(api):
    pid = make_project(api)
    r = api.post("/api/research/jobs", {"project": pid, "sources": ["darkweb"]}, format="json", HTTP_IDEMPOTENCY_KEY="d")
    assert r.status_code == 400
