"""Query CRUD, wizard step 2/3 fields, estimate. Owner isolation on every route."""

import pytest

from projects.models import Project
from research.models import ResearchQuery

IDEA = "A tool that helps independent restaurants track inventory and reduce food waste."


@pytest.fixture
def project(api):
    return api.post("/api/projects", {"name": "Restaurant inventory", "description": IDEA}, format="json").json()["id"]


def test_query_crud(api, project):
    url = f"/api/projects/{project}/queries"
    q = api.post(url, {"text": "restaurant waste tracking", "intent": "problem_discovery"}, format="json").json()
    assert q["ai_generated"] is False
    r = api.patch(f"{url}/{q['id']}", {"text": "restaurant food waste tracking", "enabled": False}, format="json")
    assert r.status_code == 200
    assert r.json()["user_modified"] is True
    assert r.json()["enabled"] is False
    assert len(api.get(url).json()) == 1
    assert api.delete(f"{url}/{q['id']}").status_code == 204
    assert api.get(url).json() == []


def test_query_validation(api, project):
    url = f"/api/projects/{project}/queries"
    assert api.post(url, {"text": "ab", "intent": "problem_discovery"}, format="json").status_code == 400
    assert api.post(url, {"text": "valid query", "intent": "nope"}, format="json").status_code == 400


def test_query_owner_isolation(api, other_api, project):
    url = f"/api/projects/{project}/queries"
    q = api.post(url, {"text": "restaurant waste tracking", "intent": "problem_discovery"}, format="json").json()
    assert other_api.get(url).status_code == 404
    assert other_api.post(url, {"text": "sneaky one", "intent": "problem_discovery"}, format="json").status_code == 404
    assert other_api.patch(f"{url}/{q['id']}", {"text": "hijacked"}, format="json").status_code == 404
    assert other_api.delete(f"{url}/{q['id']}").status_code == 404
    assert ResearchQuery.objects.get(pk=q["id"]).text == "restaurant waste tracking"


def test_query_cap(api, project):
    ResearchQuery.objects.bulk_create(
        [ResearchQuery(project_id=project, text=f"query {i}", intent="problem_discovery") for i in range(40)]
    )
    r = api.post(f"/api/projects/{project}/queries", {"text": "one more", "intent": "problem_discovery"}, format="json")
    assert r.status_code == 400


def test_market_and_config_fields_roundtrip(api, project):
    body = {
        "industry": "Food service",
        "customer_type": "B2B",
        "audiences": ["restaurant owners"],
        "geographies": ["US", "UK"],
        "business_stage": "idea",
        "price_hypothesis": "$29/month",
        "ai_suggested_fields": ["industry"],
        "sources": ["web_search", "hackernews"],
        "depth": "quick",
        "competitor_urls": ["https://example.com/pricing"],
        "evidence_urls": ["https://news.ycombinator.com/item?id=1"],
        "exclude_terms": ["jobs"],
        "interpretation_confirmed": True,
    }
    r = api.patch(f"/api/projects/{project}", body, format="json")
    assert r.status_code == 200, r.content
    data = api.get(f"/api/projects/{project}").json()
    for k, v in body.items():
        assert data[k] == v, k


def test_config_url_rules(api, project):
    bad_scheme = api.patch(f"/api/projects/{project}", {"competitor_urls": ["ftp://example.com"]}, format="json")
    assert bad_scheme.status_code == 400
    too_many = api.patch(f"/api/projects/{project}", {"evidence_urls": [f"https://example.com/{i}" for i in range(11)]}, format="json")
    assert too_many.status_code == 400


def test_non_draft_cannot_be_edited(api, project):
    Project.objects.filter(pk=project).update(status="COMPLETED")
    r = api.patch(f"/api/projects/{project}", {"name": "Changed name"}, format="json")
    assert r.status_code == 400


def test_estimate(api, project, user):
    r = api.get(f"/api/research/estimate?project={project}&depth=deep").json()
    assert r["credits"] == 4
    assert r["balance"] == user.credits
    assert r["sufficient"] is True
    assert r["balance_after"] == user.credits - 4
    assert api.get("/api/research/estimate?depth=huge").status_code == 400


def test_estimate_owner_isolation(other_api, project):
    assert other_api.get(f"/api/research/estimate?project={project}").status_code == 404
