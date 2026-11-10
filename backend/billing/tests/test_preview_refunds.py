"""Free-plan evidence preview and proportional (partial) refunds."""

from datetime import UTC, datetime

import pytest

from billing.models import Purchase, UsageTransaction
from billing.tests.test_billing import order, payments, post_hook  # noqa: F401 (payments is a fixture)
from evidence.models import Evidence
from projects.models import Project
from reports.services import build_report
from research.models import ResearchJob


@pytest.fixture
def evidence_set(user, settings):
    settings.EVIDENCE_PREVIEW_LIMIT = 3
    project = Project.objects.create(owner=user, name="Preview", status="COMPLETED")
    job = ResearchJob.objects.create(project=project, idempotency_key="pv", status="COMPLETED", config_snapshot={})
    rows = [
        Evidence.objects.create(
            project=project,
            job=job,
            provider="hackernews",
            source_url=f"https://news.ycombinator.com/item?id={i}",
            title=f"t{i}",
            excerpt=f"inventory pain number {i}",
            retrieved_at=datetime.now(UTC),
            content_hash=f"h{i}",
            relevance=i / 10,
            category="pain_point",
            classifier_version="v",
        )
        for i in range(8)
    ]
    return project, job, rows


def test_free_plan_sees_top_records_only(api, evidence_set):
    project, _, rows = evidence_set
    body = api.get(f"/api/evidence?project={project.id}").json()
    top = [r.id for r in sorted(rows, key=lambda r: -r.relevance)[:3]]
    assert [e["id"] for e in body["results"]] == top
    assert body["preview"] == {"limited": True, "limit_per_project": 3, "available": 3, "total": 8}
    # Search, filters, detail and save can't reach past the preview.
    assert api.get(f"/api/evidence?project={project.id}&q=number 0").json()["count"] == 0
    hidden = sorted(rows, key=lambda r: r.relevance)[0]
    assert api.get(f"/api/evidence/{hidden.id}").status_code == 404
    assert api.patch(f"/api/evidence/{hidden.id}", {"saved_by_user": True}, format="json").status_code == 404
    assert api.get(f"/api/evidence/{top[0]}").status_code == 200


def test_paid_plan_sees_everything(api, user, evidence_set):
    project, _, _ = evidence_set
    Purchase.objects.create(user=user, provider="lemonsqueezy", pack_id="starter", credits=6, status="paid")
    body = api.get(f"/api/evidence?project={project.id}").json()
    assert body["count"] == 8 and "preview" not in body


def test_report_keeps_all_cited_evidence_on_free_plan(api, evidence_set):
    project, job, _ = evidence_set
    build_report(job)
    body = api.get(f"/api/reports/{project.id}").json()
    cited = {int(i) for i in body["evidence_index"]}
    assert len(cited) > 3  # the report is never cut down to the preview


def test_partial_refunds_take_back_a_matching_share(client, user, payments):  # noqa: F811
    p = Purchase.objects.create(user=user, provider="lemonsqueezy", pack_id="starter", credits=6)
    post_hook(client, order(p, order_id="77"))
    user.refresh_from_db()
    start = user.credits

    def refund(refunded, status="partial_refund"):
        payload = order(p, order_id="77", event="order_refunded", status=status)
        payload["data"]["attributes"].update({"total": 1900, "refunded_amount": refunded})
        return post_hook(client, payload)

    refund(950)  # half: 3 credits back
    refund(950)  # replay: nothing more
    user.refresh_from_db()
    p.refresh_from_db()
    assert start - user.credits == 3 and p.status == "paid" and p.credits_refunded == 3
    refund(1900, status="refunded")  # rest of the order
    user.refresh_from_db()
    p.refresh_from_db()
    assert start - user.credits == 6 and p.status == "refunded"
    assert sum(t.credits for t in UsageTransaction.objects.filter(operation="purchase_refund")) == -6
