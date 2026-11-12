"""Week 8: monitoring engine (claim → polite fetch → hash → deterministic diff → change), API and SSRF safety."""

import time
from datetime import timedelta

import pytest
from django.core.cache import cache
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from monitoring import engine
from monitoring import views as mviews
from monitoring.diff import diff_pages, prices
from monitoring.models import Change, Observation, Watch
from projects.models import Project
from reports.models import Competitor
from research.providers import fetch as fetch_mod
from research.providers.fetch import BlockedURL, FetchedPage, FetchError

PAGE_V1 = "<html><body><h1>Acme</h1><p>Starter $29/mo</p><p>Pro $99/mo</p><p>Stock counts for restaurants</p></body></html>"
PAGE_V2 = "<html><body><h1>Acme</h1><p>Starter $35/mo</p><p>Pro $99/mo</p><p>Stock counts for restaurants</p></body></html>"


@pytest.fixture(autouse=True)
def _fresh_cache(settings, monkeypatch):
    settings.MONITORING_HOST_INTERVAL = 30
    # Fake public DNS for the politeness check: one address per hostname.
    monkeypatch.setattr(engine, "check_url", lambda url: f"93.184.216.{sum(map(ord, url.split('/')[2])) % 200 + 1}")
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def eager_celery():
    from config.celery import app

    old = app.conf.task_always_eager
    app.conf.task_always_eager = True
    yield
    app.conf.task_always_eager = old


@pytest.fixture
def project(user):
    return Project.objects.create(owner=user, name="Monitored", status="COMPLETED")


def watch(project, url="https://acme.test/pricing", **kw):
    return Watch.objects.create(project=project, url=url, next_run_at=timezone.now() - timedelta(minutes=1), **kw)


class FakeFetch:
    """Stands in for fetch_public_page: serves queued pages, records the validators it was sent."""

    def __init__(self, *responses):
        self.responses = list(responses)
        self.calls: list[dict] = []

    def __call__(self, url, conditional=None):
        self.calls.append({"url": url, "conditional": conditional})
        r = self.responses.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


def page(html, status=200, etag='"v1"'):
    return FetchedPage(url="https://acme.test/pricing", status=status, text=html, etag=etag, last_modified="")


# --- diff -------------------------------------------------------------------------------------


def test_price_extraction_and_pricing_diff():
    assert prices("Starter $29/mo · Team €1,200 per year · 3 seats") == ["$29/mo", "€1,200 per year"]
    d = diff_pages("Starter $29/mo\nPro $99/mo", "Starter $35/mo\nPro $99/mo")
    assert d["kind"] == "pricing" and d["significance"] == "high"
    assert d["details"]["prices_added"] == ["$35/mo"] and d["details"]["prices_removed"] == ["$29/mo"]


def test_content_diff_is_deterministic_and_capped():
    before = "\n".join(f"Feature {i}" for i in range(50))
    after = "\n".join(f"Feature {i}" for i in range(50)) + "\n" + "\n".join(f"New thing {i}" for i in range(40))
    d1, d2 = diff_pages(before, after), diff_pages(before, after)
    assert d1 == d2 and d1["kind"] == "content" and d1["significance"] == "medium"
    assert len(d1["details"]["blocks_added"]) == 20 and d1["details"]["blocks_added_total"] == 40


# --- engine -----------------------------------------------------------------------------------


def test_baseline_then_unchanged_then_price_change(project, monkeypatch):
    w = watch(project)
    fake = FakeFetch(page(PAGE_V1), page(PAGE_V1, etag='"v1b"'), page(PAGE_V2, etag='"v2"'))
    monkeypatch.setattr(engine, "fetch_public_page", fake)

    assert engine.check_watch(w.pk) == "baseline"
    assert Observation.objects.filter(watch=w).count() == 1 and not Change.objects.exists()

    cache.clear()  # next check of the same host is allowed
    assert engine.check_watch(w.pk) == "unchanged"
    assert Observation.objects.filter(watch=w).count() == 1  # same visible text: nothing stored
    assert fake.calls[1]["conditional"]["etag"] == '"v1"'  # validators from the last read are sent

    cache.clear()
    assert engine.check_watch(w.pk) == "changed"
    c = Change.objects.get()
    assert c.kind == "pricing" and c.significance == "high" and "$35/mo" in c.summary
    assert c.before.text != c.after.text and c.project_id == project.pk


def test_not_modified_skips_everything(project, monkeypatch):
    w = watch(project, etag='"v1"', last_hash="abc")
    monkeypatch.setattr(engine, "fetch_public_page", FakeFetch(page("", status=304)))
    assert engine.check_watch(w.pk) == "unchanged"
    w.refresh_from_db()
    assert not Observation.objects.exists() and w.next_run_at > timezone.now() + timedelta(days=6)


def test_one_request_per_host_at_a_time(project, monkeypatch):
    a = watch(project, url="https://acme.test/pricing")
    b = watch(project, url="https://acme.test/features")
    monkeypatch.setattr(engine, "fetch_public_page", FakeFetch(page(PAGE_V1)))
    assert engine.check_watch(a.pk) == "baseline"
    assert engine.check_watch(b.pk) == "deferred"  # same host within the politeness interval
    b.refresh_from_db()
    assert b.next_run_at > timezone.now()


def test_errors_back_off_then_pause_and_never_leak_keys(project, monkeypatch, settings):
    w = watch(project)
    errs = [FetchError("HTTP 500 for https://acme.test/pricing?token=SECRET")] * settings.MONITORING_MAX_ERRORS
    monkeypatch.setattr(engine, "fetch_public_page", FakeFetch(*errs))
    for i in range(settings.MONITORING_MAX_ERRORS):
        cache.clear()
        Watch.objects.filter(pk=w.pk).update(next_run_at=timezone.now())
        engine.check_watch(w.pk)
        w.refresh_from_db()
        assert "SECRET" not in w.last_error
        if i == 0:
            assert w.last_status == "error" and w.next_run_at <= timezone.now() + timedelta(hours=1, seconds=5)
    assert w.active is False and w.last_status == "paused"


def test_private_address_is_blocked_by_the_real_fetcher(project, monkeypatch):
    """SSRF: a watch pointing at an internal address is refused before any connection is made."""
    w = watch(project, url="https://internal.test/admin")
    monkeypatch.setattr(engine, "check_url", fetch_mod.check_url)  # the real check, not the test DNS stub
    monkeypatch.setattr(fetch_mod.socket, "getaddrinfo", lambda *a, **k: [(2, 1, 6, "", ("10.0.0.5", 443))])
    assert engine.check_watch(w.pk) == "blocked"
    w.refresh_from_db()
    assert "public address" in w.last_error and not Observation.objects.exists()


def test_claim_leases_due_watches_once(project):
    due = watch(project)
    Watch.objects.create(project=project, url="https://later.test/", next_run_at=timezone.now() + timedelta(days=1))
    Watch.objects.create(project=project, url="https://off.test/", next_run_at=timezone.now(), active=False)
    assert engine.claim_due()[0] == [due.pk]
    assert engine.claim_due()[0] == []  # leased: not claimed twice


def test_retention_keeps_recent_and_referenced(project, settings):
    settings.MONITORING_KEEP_OBSERVATIONS = 3
    w = watch(project)
    now = timezone.now()
    obs = [
        Observation.objects.create(watch=w, fetched_at=now - timedelta(days=10 - i), final_url=w.url, content_hash=str(i), text=str(i))
        for i in range(8)
    ]
    Change.objects.create(
        watch=w, project=project, before=obs[0], after=obs[1], kind="content", significance="low", summary="s", detected_at=now
    )
    engine.prune(w)
    kept = set(Observation.objects.filter(watch=w).values_list("pk", flat=True))
    assert kept == {obs[0].pk, obs[1].pk, obs[5].pk, obs[6].pk, obs[7].pk}


def test_cycle_of_1000_watches_is_cheap(project, user):
    """Load: claiming is one batched query, regardless of how many watches are due."""
    other = Project.objects.create(owner=user, name="Bulk")
    Watch.objects.bulk_create(
        [Watch(project=other, url=f"https://site{i}.test/", next_run_at=timezone.now() - timedelta(minutes=1)) for i in range(1000)]
    )
    start = time.perf_counter()
    with CaptureQueriesContext(connection) as q:
        counts = engine.run_cycle(limit=1000, check=lambda _id, _token: "unchanged")
    elapsed = time.perf_counter() - start
    assert counts == {"unchanged": 1000}
    assert len(q.captured_queries) <= 6  # select-for-update + one bulk lease update (+ transaction statements)
    assert elapsed < 5


# --- API --------------------------------------------------------------------------------------


@pytest.fixture
def public_dns(monkeypatch):
    monkeypatch.setattr(mviews, "check_url", lambda url: "93.184.216.34")


def test_watch_api_create_validate_isolate(api, other_api, project, public_dns, monkeypatch, settings):
    url = f"/api/projects/{project.id}/watches"
    r = api.post(url, {"url": "https://acme.test/pricing", "label": " Acme   pricing "}, format="json")
    assert r.status_code == 201 and r.json()["label"] == "Acme pricing" and r.json()["last_status"] == "pending"
    assert "etag" not in r.json() and "last_hash" not in r.json()  # internals stay server-side
    assert api.post(url, {"url": "https://acme.test/pricing"}, format="json").status_code == 400  # duplicate
    assert api.post(url, {"url": "ftp://acme.test/"}, format="json").status_code == 400
    monkeypatch.setattr(mviews, "check_url", lambda u: (_ for _ in ()).throw(BlockedURL("not a public address")))
    assert api.post(url, {"url": "https://intranet.test/"}, format="json").status_code == 400
    assert other_api.get(url).status_code == 404
    wid = r.json()["id"]
    assert other_api.patch(f"{url}/{wid}", {"active": False}, format="json").status_code == 404
    assert api.patch(f"{url}/{wid}", {"url": "https://acme.test/other"}, format="json").status_code == 400
    assert api.patch(f"{url}/{wid}", {"cadence": "daily"}, format="json").json()["cadence"] == "daily"


def test_watch_caps(api, project, public_dns, settings):
    settings.MONITORING_MAX_WATCHES_PER_PROJECT = 2
    url = f"/api/projects/{project.id}/watches"
    for i in range(2):
        assert api.post(url, {"url": f"https://s{i}.test/"}, format="json").status_code == 201
    assert api.post(url, {"url": "https://s9.test/"}, format="json").status_code == 400


def test_check_now_and_atomic_cooldown(api, project, public_dns, monkeypatch, eager_celery):
    from monitoring import tasks

    w = watch(project)
    monkeypatch.setattr(tasks, "check_watch", lambda pk, token=None: "baseline")
    url = f"/api/projects/{project.id}/watches/{w.pk}/check"
    r = api.post(url)
    assert r.status_code == 200 and r.json()["result"] == "baseline"
    assert api.post(url).status_code == 429  # the first request claimed the cooldown before fetching


def test_watch_from_report_competitors(api, project, public_dns):
    a = Competitor.objects.create(
        project=project, name="Acme", website="https://acme.test", pricing={"source_url": "https://acme.test/pricing"}
    )
    b = Competitor.objects.create(project=project, name="NoSite", website="")
    url = f"/api/projects/{project.id}/watches/from-report"
    assert api.post(url, {"competitor_ids": [a.pk, b.pk]}, format="json").status_code == 400  # one has no website
    r = api.post(url, {"competitor_ids": [a.pk]}, format="json")
    assert r.json() == {"created": 1, "skipped": 0}
    assert Watch.objects.get(project=project).url == "https://acme.test/pricing"  # the read pricing page
    assert api.post(url, {"competitor_ids": [a.pk]}, format="json").json() == {"created": 0, "skipped": 1}


def test_changes_feed_isolated_and_markable(api, other_api, project):
    w = watch(project)
    c = Change.objects.create(
        watch=w, project=project, kind="pricing", significance="high", summary="Prices changed", detected_at=timezone.now()
    )
    url = f"/api/projects/{project.id}/changes"
    body = api.get(f"{url}?significance=high").json()
    assert body["count"] == 1 and body["results"][0]["watch"]["id"] == w.pk
    assert api.patch(f"{url}/{c.pk}", {"seen": True, "summary": "x"}, format="json").json()["summary"] == "Prices changed"
    assert Change.objects.get().seen is True
    assert other_api.get(url).status_code == 404


# --- review fixes -----------------------------------------------------------------------------


def test_hostile_page_diff_is_linear():
    """Thousands of near-identical blocks used to make difflib run for minutes."""
    before = "\n".join(["abc"] * 5000)
    after = "\n".join(["abc" if i % 2 else "xyz" for i in range(5000)])
    start = time.perf_counter()
    d = diff_pages(before, after)
    assert time.perf_counter() - start < 1
    assert d["details"]["blocks_added_total"] == 2500 and d["details"]["blocks_removed_total"] == 2500


def test_unsafe_validators_are_not_stored(project, monkeypatch):
    w = watch(project)
    monkeypatch.setattr(engine, "fetch_public_page", FakeFetch(page(PAGE_V1, etag='"caf\xe9"')))
    engine.check_watch(w.pk)
    w.refresh_from_db()
    assert w.etag == ""  # non-ASCII: never sent back (it would crash the next request)


def test_unexpected_errors_count_as_failures(project, monkeypatch):
    w = watch(project)
    monkeypatch.setattr(engine, "fetch_public_page", FakeFetch(UnicodeEncodeError("ascii", "x", 0, 1, "bad")))
    assert engine.check_watch(w.pk) == "error"
    w.refresh_from_db()
    assert w.consecutive_errors == 1 and w.next_run_at > timezone.now()


def test_lease_token_stops_duplicate_runs(project, monkeypatch):
    w = watch(project)
    monkeypatch.setattr(engine, "fetch_public_page", FakeFetch(page(PAGE_V1)))
    ids, token = engine.claim_due()
    assert engine.check_watch(w.pk, "someone-elses-token") == "skipped"
    assert engine.check_watch(w.pk, token) == "baseline"
    assert engine.check_watch(w.pk, token) == "skipped"  # duplicate delivery of the same task


def test_one_watch_per_host_per_cycle(project):
    a = watch(project, url="https://acme.test/a")
    watch(project, url="https://acme.test/b")
    c = watch(project, url="https://other.test/")
    assert sorted(engine.claim_due()[0]) == sorted([a.pk, c.pk])


def test_shared_ip_is_rate_limited_across_hostnames(project, monkeypatch):
    """Wildcard DNS: many names pointing at one victim address share one politeness slot."""
    monkeypatch.setattr(engine, "check_url", lambda url: "93.184.216.34")
    a = watch(project, url="https://a.evil.test/")
    b = watch(project, url="https://b.evil.test/")
    monkeypatch.setattr(engine, "fetch_public_page", FakeFetch(page(PAGE_V1)))
    assert engine.check_watch(a.pk) == "baseline"
    assert engine.check_watch(b.pk) == "deferred"


def test_changes_are_capped_per_watch(project, settings):
    settings.MONITORING_KEEP_CHANGES = 3
    w = watch(project)
    now = timezone.now()
    for i in range(6):
        o1 = Observation.objects.create(
            watch=w, fetched_at=now - timedelta(hours=20 - 2 * i), final_url=w.url, content_hash=f"a{i}", text="a"
        )
        o2 = Observation.objects.create(
            watch=w, fetched_at=now - timedelta(hours=19 - 2 * i), final_url=w.url, content_hash=f"b{i}", text="b"
        )
        Change.objects.create(
            watch=w,
            project=project,
            before=o1,
            after=o2,
            kind="content",
            significance="low",
            summary=str(i),
            detected_at=now - timedelta(hours=19 - 2 * i),
        )
    engine.prune(w)
    assert sorted(Change.objects.filter(watch=w).values_list("summary", flat=True)) == ["3", "4", "5"]
    assert Observation.objects.filter(watch=w).count() <= settings.MONITORING_KEEP_OBSERVATIONS + 6


def test_api_keys_can_read_but_not_fetch(user, project, public_dns):
    from rest_framework.test import APIClient

    from accounts.services import issue_api_key

    w = watch(project)
    _, raw = issue_api_key(user, "mcp")
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Api-Key {raw}")
    base = f"/api/projects/{project.id}/watches"
    assert c.get(base).status_code == 200
    assert c.post(base, {"url": "https://x.test/"}, format="json").status_code == 403
    assert c.post(f"{base}/{w.pk}/check").status_code == 403
    assert c.patch(f"{base}/{w.pk}", {"active": False}, format="json").status_code == 403


def test_cross_user_access_is_404(api, other_api, other, project, public_dns):
    w = watch(project)
    ch = Change.objects.create(watch=w, project=project, kind="content", significance="low", summary="s", detected_at=timezone.now())
    base = f"/api/projects/{project.id}"
    assert other_api.post(f"{base}/watches/{w.pk}/check").status_code == 404
    assert other_api.delete(f"{base}/watches/{w.pk}").status_code == 404
    assert other_api.patch(f"{base}/changes/{ch.pk}", {"seen": True}, format="json").status_code == 404
    theirs = Project.objects.create(owner=other, name="Theirs")
    mine = Competitor.objects.create(project=project, name="Acme", website="https://acme.test")
    r = other_api.post(f"/api/projects/{theirs.id}/watches/from-report", {"competitor_ids": [mine.pk]}, format="json")
    assert r.status_code == 400 and not Watch.objects.filter(project=theirs).exists()
    assert other_api.get(f"/api/projects/{theirs.id}/watches/{w.pk}").status_code in (404, 405)
    assert other_api.patch(f"/api/projects/{theirs.id}/watches/{w.pk}", {"active": False}, format="json").status_code == 404


def test_resume_respects_cooldown(api, project, public_dns):
    w = watch(project, active=False, last_status="paused", last_checked_at=timezone.now())
    r = api.patch(f"/api/projects/{project.id}/watches/{w.pk}", {"active": True}, format="json").json()
    w.refresh_from_db()
    assert r["last_status"] == "pending" and w.consecutive_errors == 0
    assert w.next_run_at >= timezone.now() + timedelta(minutes=9)
