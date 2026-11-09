"""Week 4: competitor profiles, scoring and the report. The LLM is faked; honesty rules are tested."""

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import pytest

from evidence.models import Evidence, EvidenceCluster, SourceSnapshot
from projects.models import IdeaDefinition, MarketProfile, Project
from reports import competitors as comp_mod
from reports.models import ChannelRecommendation, Competitor, Opportunity, Report
from reports.scoring import score_project
from reports.services import build_report
from research.ai.client import LLMResult
from research.models import ResearchJob

PAGE = "Acme Stock — inventory for restaurant groups. Starter $49/month. Pro $129 per month. Book a demo."


def ev(project, job, url, text, provider="hackernews", **kw):
    return Evidence.objects.create(
        project=project,
        job=job,
        provider=provider,
        source_url=url,
        title=kw.pop("title", "t"),
        excerpt=text,
        retrieved_at=datetime.now(UTC),
        content_hash=str(abs(hash((url, text)))),
        **kw,
    )


@pytest.fixture
def setup(user):
    project = Project.objects.create(owner=user, name="Restaurant stock", status="COMPLETED")
    IdeaDefinition.objects.create(project=project, original_description="Stock counting for small restaurants.")
    MarketProfile.objects.create(project=project, price_hypothesis="$29/month", geographies=["UK"])
    job = ResearchJob.objects.create(
        project=project, idempotency_key="k", status="COMPLETED", completed_at=datetime.now(UTC), config_snapshot={}
    )
    return project, job


@pytest.fixture
def fake_llm(monkeypatch, settings):
    settings.ANTHROPIC_API_KEY = "test-key"
    settings.LLM_PROVIDER = "anthropic"
    replies: list = []

    def complete_json(prompt, schema, **kwargs):
        return LLMResult(data=replies.pop(0), model="claude-opus-5-5", input_tokens=1, output_tokens=1, cost_usd=Decimal("0.01"))

    monkeypatch.setattr(comp_mod.llm, "complete_json", complete_json)
    return replies


def test_only_prices_found_on_the_page_are_kept():
    plans = [{"name": "Starter", "price": "$49", "period": "/month"}, {"name": "Team", "price": "$79", "period": "/month"}]
    assert comp_mod.verified_plans(plans, PAGE) == [plans[0]]  # $79 was invented: dropped


def test_listed_competitor_profile_is_dated_and_verified(setup, fake_llm):
    project, job = setup
    page = ev(
        project, job, "https://acme.test/pricing", "Inventory for restaurant groups.", provider="competitor_pages", title="Acme Stock"
    )
    SourceSnapshot.objects.create(evidence=page, text=PAGE, retrieved_at=page.retrieved_at)
    fake_llm.append(
        {
            "name": "Acme Stock",
            "audience": "restaurant groups",
            "features": ["stock counts"],
            "plans": [{"name": "Starter", "price": "$49", "period": "/month"}, {"name": "Pro", "price": "$99", "period": "/month"}],
        }
    )
    comps, _cost, _notes = comp_mod.build_competitors(job)
    c = comps[0]
    assert c.positioning == "Inventory for restaurant groups."  # the page's own words
    assert c.pricing["status"] == "verified"
    assert [p["price"] for p in c.pricing["plans"]] == ["$49"]  # "$99" isn't on the page
    assert c.pricing["source_url"] == "https://acme.test/pricing" and c.pricing["retrieved_at"]


def test_without_ai_pricing_is_unavailable(setup, settings):
    settings.ANTHROPIC_API_KEY = ""
    project, job = setup
    page = ev(
        project, job, "https://acme.test/pricing", "Inventory for restaurant groups.", provider="competitor_pages", title="Acme Stock"
    )
    SourceSnapshot.objects.create(evidence=page, text=PAGE, retrieved_at=page.retrieved_at)
    comps, _, notes = comp_mod.build_competitors(job)
    assert comps[0].pricing["status"] == "unavailable" and "AI unavailable" in notes[0]


def test_mentioned_competitor_must_appear_in_cited_text(setup, fake_llm):
    project, job = setup
    project_job = {"competitor_discovery": True}
    job.config_snapshot = project_job
    job.save()
    a = ev(
        project,
        job,
        "https://a.test/1",
        "We tried MarketMan but it was overkill.",
        category="pain_point",
        relevance=0.9,
        classifier_version="v",
    )
    b = ev(
        project,
        job,
        "https://b.test/1",
        "Spreadsheets everywhere, nothing fits.",
        category="workaround",
        relevance=0.8,
        classifier_version="v",
    )
    fake_llm.append({"competitors": [{"name": "MarketMan", "evidence_ids": [a.id]}, {"name": "Upserve", "evidence_ids": [b.id]}]})
    fake_llm.append({"gap": "Too heavy for one location.", "evidence_ids": [a.id]})
    comps, _, _ = comp_mod.build_competitors(job)
    assert [c.name for c in comps] == ["MarketMan"]  # "Upserve" isn't in its cited excerpt
    assert comps[0].complaints == [a.id] and comps[0].identified_gap == "Too heavy for one location."


def test_scoring_marks_unscorable_dimensions_unavailable(setup):
    project, job = setup
    items = [
        ev(
            project,
            job,
            f"https://s{i}.test",
            f"pain {i}",
            category="pain_point",
            relevance=0.9,
            classifier_version="v",
            published_at=date.today() - timedelta(days=30),
        )
        for i in range(3)
    ]
    result = score_project(items, [], [])
    dims = {d["key"]: d for d in result["dimensions"]}
    assert dims["competitive_gap"]["score"] is None and dims["product_feasibility"]["score"] is None
    assert dims["demand_evidence"]["score"] > 0 and dims["demand_evidence"]["evidence_ids"]
    assert result["scored_weight"] == 55  # demand 25 + pain 20 + audience 10 (one place found); gap, wtp, feasibility unscored
    assert result["confidence"] == "low" and result["recommendation"] == "research_more"
    assert result["what_would_change"]


def test_unclassified_evidence_is_not_scored_as_demand(setup):
    project, job = setup
    items = [ev(project, job, f"https://s{i}.test", f"text {i}") for i in range(5)]
    result = score_project(items, [], [])
    assert result["score"] is None and result["recommendation"] == "research_more"


def test_high_score_with_low_confidence_never_says_build(setup):
    project, job = setup
    items = [
        ev(project, job, f"https://s{i}.test", f"x {i}", category="buying_intent", relevance=1, classifier_version="v")
        for i in range(30)
    ]
    cluster = EvidenceCluster.objects.create(project=project, name="Pain", category="pain_point", severity="high")
    cluster.evidence.set(items)
    result = score_project(items, [cluster], [])
    assert result["confidence"] == "low"  # one provider, no dates
    assert result["recommendation"] == "research_more"


def test_report_snapshot_and_api(api, other_api, setup):
    project, job = setup
    ev(project, job, "https://a.test/1", "Counting takes hours", category="pain_point", relevance=0.9, classifier_version="v")
    report, _, _ = build_report(job)
    assert Opportunity.objects.filter(project=project).exists()
    c = report.content
    assert c["opportunity"]["market_size"]["status"] == "unavailable"
    assert {"text": "Customers will pay about $29/month.", "source": "founder"} in c["opportunity"]["assumptions"]
    body = api.get(f"/api/reports/{project.id}").json()
    assert body["project"]["name"] == "Restaurant stock" and body["overview"]["evidence_count"] == 1
    assert body["overview"]["key_findings"][0]["evidence_ids"]
    # Owner isolation + bad ids
    assert other_api.get(f"/api/reports/{project.id}").status_code == 404
    assert api.get("/api/reports/not-a-uuid").status_code == 404
    Report.objects.all().delete()
    assert api.get(f"/api/reports/{project.id}").status_code == 404
    assert Competitor.objects.count() == 0


def test_unclassified_evidence_is_not_a_key_finding(setup):
    project, job = setup
    ev(project, job, "https://a.test/2", "Unrelated launch post")
    report, _, _ = build_report(job)
    assert report.content["overview"]["key_findings"] == []


def test_channels_are_researched_only_with_classified_evidence(setup):
    project, job = setup
    project.market.audiences = ["restaurant owners"]
    project.market.save()
    ev(
        project,
        job,
        "https://news.ycombinator.com/item?id=1",
        "As restaurant owners we count stock by hand",
        category="pain_point",
        relevance=0.9,
        classifier_version="v",
    )
    ev(
        project,
        job,
        "https://cooking.stackexchange.com/q/2",
        "Restaurant owner here, inventory takes hours",
        provider="stackexchange",
        category="workaround",
        relevance=0.7,
        classifier_version="v",
    )
    ev(project, job, "https://news.ycombinator.com/item?id=3", "Unrelated launch post")  # unclassified: ignored
    report, _, _ = build_report(job)
    d = report.content["distribution"]
    researched = [c for c in d["channels"] if not c["is_hypothesis"]]
    assert {c["name"] for c in researched} == {"Hacker News", "Stack Exchange: cooking"}
    assert all(c["evidence_ids"] for c in researched)
    hyp = [c for c in d["channels"] if c["is_hypothesis"]]
    assert hyp and all(c["evidence_count"] == 0 and not c["evidence_ids"] for c in hyp)
    seg = report.content["audience"]["segments"][0]
    assert seg["name"] == "restaurant owners" and seg["evidence_count"] == 2 and seg["source"] == "founder"
    dims = {x["key"]: x for x in report.content["opportunity"]["dimensions"]}
    assert dims["audience_accessibility"]["available"] and dims["audience_accessibility"]["evidence_ids"]
    assert d["first_ten_plan"][0]["evidence_ids"]  # step 1 points at the cited threads
    assert ChannelRecommendation.objects.filter(project=project, is_hypothesis=False).count() == 2


def test_no_signal_means_audience_not_scored_and_no_researched_channels(setup):
    project, job = setup
    ev(project, job, "https://news.ycombinator.com/item?id=9", "Unrelated")
    report, _, _ = build_report(job)
    assert all(c["is_hypothesis"] for c in report.content["distribution"]["channels"])
    dims = {x["key"]: x for x in report.content["opportunity"]["dimensions"]}
    assert dims["audience_accessibility"]["score"] is None


def test_history_export_and_isolation(api, other_api, other, setup):
    project, job = setup
    ev(project, job, "https://a.test/1", "Counting [stock] takes hours", category="pain_point", relevance=0.9, classifier_version="v")
    first, _, _ = build_report(job)
    job2 = ResearchJob.objects.create(
        project=project, idempotency_key="k2", status="COMPLETED", completed_at=datetime.now(UTC), config_snapshot={}
    )
    second, _, _ = build_report(job2)
    hist = api.get(f"/api/reports/{project.id}/history").json()
    assert [h["id"] for h in hist["results"]] == [second.id, first.id]
    assert api.get(f"/api/reports/{project.id}?report={first.id}").json()["id"] == first.id
    assert api.get(f"/api/reports/{project.id}?report=abc").status_code == 404
    md = api.get(f"/api/reports/{project.id}/export?report={first.id}")
    assert md.status_code == 200 and md["Content-Type"].startswith("text/markdown")
    body = md.content.decode()
    assert "TAM, SAM and SOM unavailable" in body and "https://a.test/1" in body
    assert other_api.get(f"/api/reports/{project.id}/history").status_code == 404
    assert other_api.get(f"/api/reports/{project.id}/export").status_code == 404
    other_report = Report.objects.create(project=Project.objects.create(owner=other, name="Other"), content={})
    assert api.get(f"/api/reports/{project.id}?report={other_report.id}").status_code == 404


def test_completed_project_can_rerun_but_not_while_running(api, setup):
    project, _ = setup
    r = api.post("/api/research/jobs", {"project": str(project.id), "depth": "quick"}, format="json", HTTP_IDEMPOTENCY_KEY="rerun-1")
    assert r.status_code == 201
    project.refresh_from_db()
    assert project.status == "RESEARCHING"
    r = api.post("/api/research/jobs", {"project": str(project.id), "depth": "quick"}, format="json", HTTP_IDEMPOTENCY_KEY="rerun-2")
    assert r.status_code == 409
