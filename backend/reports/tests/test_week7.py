"""Week 7: competitive matrix, assumption tracker, idea comparison, unit-economics inputs."""

from datetime import UTC, datetime

import pytest

from evidence.models import Evidence
from projects.models import Assumption, IdeaDefinition, MarketProfile, Project
from reports.matrix import build_matrix
from reports.models import Report
from reports.services import build_report
from research.models import ResearchJob

CONTENT = {
    "competitors": [
        {
            "id": 1,
            "name": "Acme",
            "features": ["Stock counts", "Supplier ordering"],
            "pricing": {
                "status": "verified",
                "plans": [{"name": "Starter", "price": "$49", "period": "/mo"}, {"name": "Pro", "price": "$1,200", "period": "/yr"}],
                "source_url": "https://acme.test/pricing",
                "retrieved_at": "2026-11-01",
            },
            "complaint_ids": [5, 6],
            "identified_gap": "Too heavy for one site",
            "ai_extracted": True,
        },
        {
            "id": 2,
            "name": "Beta",
            "features": ["stock  counts!"],
            "pricing": {"status": "unavailable", "plans": [{"name": "X", "price": "$9"}]},
            "complaint_ids": [],
            "identified_gap": "",
            "ai_extracted": True,
        },
    ],
    "pain_points": [
        {
            "name": "Recipe food cost tracking",
            "category": "feature_request",
            "records": 4,
            "distinct_sources": 3,
            "confidence": "medium",
            "evidence_ids": [7, 8],
        },
        {
            "name": "Manual stock counts",
            "category": "pain_point",
            "records": 6,
            "distinct_sources": 4,
            "confidence": "high",
            "evidence_ids": [9],
        },
        {
            "name": "Love the reports",
            "category": "positive_feedback",
            "records": 2,
            "distinct_sources": 2,
            "confidence": "low",
            "evidence_ids": [10],
        },
    ],
}


def test_matrix_uses_verified_prices_merges_features_and_cites_gaps():
    m = build_matrix(CONTENT)
    acme, beta = m["pricing"]
    # $49/mo vs $1,200/yr: different billing periods, so no single "lowest" is claimed.
    assert acme["status"] == "verified" and acme["lowest"] is None and acme["mixed_periods"] and acme["retrieved_at"] == "2026-11-01"
    assert beta["status"] == "unavailable" and beta["plans"] == []  # unverified prices are never shown
    counts = {f["feature"]: f["competitor_ids"] for f in m["features"]}
    assert counts["Stock counts"] == [1, 2]  # "stock  counts!" merged into the same row
    gaps = [g["theme"] for g in m["gap_candidates"]]
    assert gaps == ["Recipe food cost tracking"]  # offered "stock counts" isn't a gap; praise never is
    assert m["gap_candidates"][0]["evidence_ids"] == [7, 8] and m["method"]


def test_matrix_without_competitors_has_no_gap_claims():
    assert build_matrix({"competitors": [], "pain_points": CONTENT["pain_points"]})["gap_candidates"] == []


@pytest.fixture
def project(user):
    p = Project.objects.create(owner=user, name="Stock app", status="COMPLETED")
    IdeaDefinition.objects.create(
        project=p,
        original_description="Stock counting for small restaurants.",
        ai_interpretation={"assumptions": ["Owners count weekly."]},
    )
    MarketProfile.objects.create(project=p, price_hypothesis="$29/month")
    return p


def test_matrix_endpoint_is_owner_only(api, other_api, project):
    Report.objects.create(project=project, content=CONTENT)
    assert api.get(f"/api/reports/{project.id}/competitive-matrix").json()["competitor_count"] == 2
    assert other_api.get(f"/api/reports/{project.id}/competitive-matrix").status_code == 404


def test_report_seeds_assumptions_without_overwriting_edits(api, project):
    job = ResearchJob.objects.create(project=project, idempotency_key="a", status="COMPLETED", config_snapshot={})
    build_report(job)
    rows = {a.text: a for a in Assumption.objects.filter(project=project)}
    assert rows["Customers will pay about $29/month."].source == "founder"
    assert rows["Owners count weekly."].source == "ai"
    a = rows["Owners count weekly."]
    a.status = "supported"
    a.save()
    build_report(job)  # re-run: no duplicates, status kept
    assert Assumption.objects.filter(project=project).count() == 2
    assert Assumption.objects.get(pk=a.pk).status == "supported"


def test_assumption_crud_isolation_and_evidence_rules(api, other_api, project, user):
    url = f"/api/projects/{project.id}/assumptions"
    mine = Evidence.objects.create(
        project=project,
        provider="hackernews",
        source_url="https://a.test/1",
        title="t",
        excerpt="x",
        retrieved_at=datetime.now(UTC),
        content_hash="h1",
    )
    elsewhere = Project.objects.create(owner=user, name="Other")
    foreign = Evidence.objects.create(
        project=elsewhere,
        provider="hackernews",
        source_url="https://a.test/2",
        title="t",
        excerpt="y",
        retrieved_at=datetime.now(UTC),
        content_hash="h2",
    )
    r = api.post(url, {"text": "Owners will pay monthly", "evidence_ids": [mine.id]}, format="json")
    assert r.status_code == 201 and r.json()["source"] == "founder" and r.json()["evidence"][0]["id"] == mine.id
    aid = r.json()["id"]
    assert api.post(url, {"text": "Owners will pay monthly"}, format="json").status_code == 400  # duplicate
    # Evidence from another project can't be linked.
    assert api.patch(f"{url}/{aid}", {"evidence_ids": [foreign.id]}, format="json").status_code == 400
    assert (
        api.patch(f"{url}/{aid}", {"status": "contradicted", "note": "3 of 5 said no"}, format="json").json()["status"]
        == "contradicted"
    )
    # AI suggestions can change status but not wording.
    ai = Assumption.objects.create(project=project, text="AI idea here", source="ai")
    assert api.patch(f"{url}/{ai.id}", {"text": "Reworded by me"}, format="json").status_code == 400
    assert api.patch(f"{url}/{ai.id}", {"status": "supported"}, format="json").status_code == 200
    assert other_api.get(url).status_code == 404
    assert other_api.patch(f"{url}/{aid}", {"status": "supported"}, format="json").status_code == 404
    assert api.delete(f"{url}/{aid}").status_code == 204


def test_compare_needs_2_to_4_own_projects(api, other_api, project, user):
    p2 = Project.objects.create(owner=user, name="Second")
    Report.objects.create(
        project=project,
        content={"overview": {"score": 61, "confidence": "low"}, "opportunity": {"dimensions": [], "scored_weight": 45}},
    )
    body = api.get(f"/api/projects/compare?ids={project.id},{p2.id}").json()
    assert [r["score"] for r in body["results"]] == [61, None]
    assert api.get(f"/api/projects/compare?ids={project.id}").status_code == 400
    assert other_api.get(f"/api/projects/compare?ids={project.id},{p2.id}").status_code == 404


def test_compare_query_count_is_flat(api, user, django_assert_max_num_queries):
    ids = []
    for i in range(4):
        p = Project.objects.create(owner=user, name=f"P{i}")
        Report.objects.create(project=p, content={"overview": {"score": i}})
        ids.append(str(p.id))
    with django_assert_max_num_queries(6):  # session/auth + projects + reports, not one per project
        assert len(api.get(f"/api/projects/compare?ids={','.join(ids)}").json()["results"]) == 4


VALID = {
    "currency": "USD",
    "price": 29,
    "cac": 120,
    "churn_pct": 4,
    "margin_pct": 80,
    "fixed_costs": 2000,
    "new_customers": 15,
    "pessimistic": {"price": -20, "cac": 30, "churn": 50, "growth": -40},
    "optimistic": {"price": 10, "cac": -20, "churn": -25, "growth": 50},
}


def test_unit_economics_inputs_validated_and_isolated(api, other_api, project):
    url = f"/api/projects/{project.id}/unit-economics"
    assert api.get(url).json()["inputs"] is None
    assert api.put(url, VALID, format="json").json()["inputs"]["price"] == 29
    assert api.put(url, {**VALID, "churn_pct": 0}, format="json").status_code == 400
    assert api.put(url, {**VALID, "currency": "usd"}, format="json").status_code == 400
    assert other_api.get(url).status_code == 404
    assert other_api.put(url, VALID, format="json").status_code == 404


def _priced(plans):
    return {
        "competitors": [{"id": 1, "name": "A", "features": [], "pricing": {"status": "verified", "plans": plans}}],
        "pain_points": [],
    }


def test_matrix_lowest_and_free_are_honest():
    same = build_matrix(
        _priced([{"name": "Pro", "price": "$499", "period": "/mo"}, {"name": "Starter", "price": "$49", "period": "per month"}])
    )
    assert same["pricing"][0]["lowest"] == {"price": "$49", "period": "per month"}
    trial = build_matrix(_priced([{"name": "Free trial", "price": "$49", "period": "/mo"}]))
    assert trial["pricing"][0]["has_free"] is False  # a plan *name* doesn't make it free
    free = build_matrix(_priced([{"name": "Hobby", "price": "Free", "period": ""}, {"name": "Pro", "price": "$9", "period": "/mo"}]))
    assert free["pricing"][0]["has_free"] is True


def test_compare_rejects_foreign_and_malformed_ids(api, other, project):
    theirs = Project.objects.create(owner=other, name="Theirs")
    assert api.get(f"/api/projects/compare?ids={project.id},{theirs.id}").status_code == 404
    assert api.get(f"/api/projects/compare?ids={project.id},garbage").status_code == 400
    assert api.get(f"/api/projects/compare?ids={project.id}, {project.id}").status_code == 400  # same idea twice = 1 project


def _ev(project, n, relevance=0.5):
    return Evidence.objects.create(
        project=project,
        provider="hackernews",
        source_url=f"https://a.test/{project.pk}/{n}",
        title=f"t{n}",
        excerpt=f"x{n}",
        retrieved_at=datetime.now(UTC),
        content_hash=f"h{project.pk}{n}",
        relevance=relevance,
    )


def test_assumption_updates_are_all_or_nothing_and_unique(api, user, project):
    url = f"/api/projects/{project.id}/assumptions"
    a = api.post(url, {"text": "Owners will pay monthly"}, format="json").json()
    b = api.post(url, {"text": "Owners count every week"}, format="json").json()
    assert api.patch(f"{url}/{b['id']}", {"text": "Owners will pay monthly"}, format="json").status_code == 400  # not a 500
    elsewhere = _ev(Project.objects.create(owner=user, name="Other"), 1)
    r = api.patch(f"{url}/{a['id']}", {"status": "supported", "evidence_ids": [elsewhere.id]}, format="json")
    assert r.status_code == 400 and Assumption.objects.get(pk=a["id"]).status == "untested"  # nothing saved


def test_free_plan_can_link_cited_evidence_but_not_hidden_records(api, project, settings):
    settings.EVIDENCE_PREVIEW_LIMIT = 1
    top, cited, hidden = _ev(project, 1, 0.9), _ev(project, 2, 0.5), _ev(project, 3, 0.1)
    Report.objects.create(project=project, content={"evidence_index": {str(cited.id): {"id": cited.id}}})
    url = f"/api/projects/{project.id}/assumptions"
    aid = api.post(url, {"text": "Linking rules hold"}, format="json").json()["id"]
    assert api.patch(f"{url}/{aid}", {"evidence_ids": [top.id, cited.id]}, format="json").status_code == 200
    assert api.patch(f"{url}/{aid}", {"evidence_ids": [top.id, cited.id, hidden.id]}, format="json").status_code == 400
    # Existing links never block an unlink, even if the preview moved since.
    Report.objects.all().delete()
    assert api.patch(f"{url}/{aid}", {"evidence_ids": [cited.id]}, format="json").status_code == 200


def test_dismissed_ai_suggestions_stay_dismissed(api, project):
    job = ResearchJob.objects.create(project=project, idempotency_key="d", status="COMPLETED", config_snapshot={})
    build_report(job)
    url = f"/api/projects/{project.id}/assumptions"
    ai = next(a for a in api.get(url).json() if a["source"] == "ai")
    assert api.delete(f"{url}/{ai['id']}").status_code == 204
    build_report(job)
    assert all(a["id"] != ai["id"] for a in api.get(url).json())


def test_new_endpoints_work_with_api_keys_for_own_data(user, other, project):
    from rest_framework.test import APIClient

    from accounts.services import issue_api_key

    _, raw = issue_api_key(user, "mcp")
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Api-Key {raw}")
    assert c.get(f"/api/projects/{project.id}/assumptions").status_code == 200
    theirs = Project.objects.create(owner=other, name="Theirs")
    assert c.get(f"/api/projects/{theirs.id}/assumptions").status_code == 404
    assert c.get(f"/api/projects/{theirs.id}/unit-economics").status_code == 404
