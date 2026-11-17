"""Week 12: YouTube channels (30-day retention, raw stats only) and keyword demand (licensed, cached, capped)."""

from datetime import timedelta
from decimal import Decimal

import httpx
import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.services import issue_api_key
from billing.models import UsageTransaction
from distribution import keywords as kw
from distribution import youtube as yt
from distribution.models import KeywordMetric, ProviderCall, YouTubeChannel
from projects.models import IdeaDefinition, MarketProfile, Project
from reports.models import Report
from research.models import ResearchQuery


@pytest.fixture
def project(user):
    p = Project.objects.create(owner=user, name="Stock app", status="COMPLETED")
    Report.objects.create(project=p, content={})  # researched: look-ups use its queries
    IdeaDefinition.objects.create(project=p, original_description="Stock counting for small restaurants.")
    MarketProfile.objects.create(project=p, geographies=["UK"])
    for text, intent in [
        ("restaurant inventory app", "customer_acquisition"),
        ("how do I count stock faster in my cafe?", "problem_discovery"),
        ("a very long sentence that is far too long to be a search keyword for any ads tool at all", "problem_discovery"),
    ]:
        ResearchQuery.objects.create(project=p, text=text, intent=intent)
    return p


def _resp(status, body, url="https://x.test"):
    return httpx.Response(status, json=body, request=httpx.Request("GET", url))


# --- YouTube --------------------------------------------------------------------------------------------

SEARCH = {
    "items": [
        {
            "id": {"videoId": "v1"},
            "snippet": {"channelId": "UC1", "title": "Stock counts in 5 min", "publishedAt": "2026-10-01T10:00:00Z"},
        },
        {"id": {"videoId": "v2"}, "snippet": {"channelId": "UC1", "title": "Older video", "publishedAt": "2026-03-01T10:00:00Z"}},
        {
            "id": {"videoId": "v3"},
            "snippet": {"channelId": "UC2", "title": "Owner&#39;s <b>cafe</b> tips", "publishedAt": "2026-09-01T10:00:00Z"},
        },
        {"id": {"playlistId": "p"}, "snippet": {"channelId": "UC3"}},
    ]
}
CHANNELS = {
    "items": [
        {"id": "UC1", "snippet": {"title": "Kitchen Ops"}, "statistics": {"subscriberCount": "12000", "videoCount": "140"}},
        {"id": "UC2", "snippet": {"title": "Cafe Life"}, "statistics": {"hiddenSubscriberCount": True, "videoCount": "33"}},
        {"id": "UC9", "snippet": {"title": "Not in results"}, "statistics": {}},
    ]
}


class FakeYouTube:
    def __init__(self, search=SEARCH, channels=CHANNELS, search_status=200):
        self.search, self.channels, self.search_status, self.calls = search, channels, search_status, []

    def __call__(self, url, params=None, **kw):
        self.calls.append((url, params))
        if url.endswith("/search"):
            return _resp(self.search_status, self.search, url)
        return _resp(200, self.channels, url)


@pytest.fixture
def youtube(settings, monkeypatch):
    settings.YOUTUBE_API_KEY = "yt-test-key"
    settings.YOUTUBE_DAILY_UNITS = 9000
    settings.YOUTUBE_USER_DAILY_UNITS = 1300
    fake = FakeYouTube()
    monkeypatch.setattr(yt.httpx, "get", fake)
    return fake


def test_youtube_needs_a_key(project, user, settings):
    settings.YOUTUBE_API_KEY = ""
    assert yt.refresh(project, user).status == "REQUIRES_CONNECTION"


def test_youtube_refresh_stores_raw_stats_for_30_days(project, user, youtube):
    c = yt.refresh(project, user)
    assert c.status == "OK" and c.units == 3 * 100 + 1  # 3 searches (YouTube takes sentences) + 1 channels call
    rows = {r.channel_id: r for r in YouTubeChannel.objects.all()}
    assert rows["UC1"].subscriber_count == 12000 and rows["UC1"].video_count == 140
    assert rows["UC2"].subscriber_count is None and rows["UC2"].subscribers_hidden  # hidden: never shown as 0
    assert rows["UC2"].latest_video_title == "Owner's <b>cafe</b> tips"  # entities decoded (React escapes the rest)
    assert "UC9" not in rows and c.details["searches"][0] == "restaurant inventory app"
    assert rows["UC1"].latest_video_id == "v1"  # the most recent matching video
    assert rows["UC1"].matched_queries[:2] == ["restaurant inventory app", "how do I count stock faster in my cafe?"]
    assert len(rows["UC1"].matched_queries) == 3
    assert abs((rows["UC1"].expires_at - rows["UC1"].fetched_at) - timedelta(days=29)) < timedelta(seconds=1)
    params = youtube.calls[0][1]
    assert params["type"] == "video" and params["key"] == "yt-test-key"
    assert yt.refresh(project, user).status == "SKIPPED"  # 6-hour cooldown per project


def test_youtube_daily_quota_guard_and_quota_errors(project, user, youtube, settings, monkeypatch):
    settings.YOUTUBE_DAILY_UNITS = 150
    assert yt.refresh(project, user).status == "LIMITED" and not YouTubeChannel.objects.exists()
    settings.YOUTUBE_DAILY_UNITS = 9000
    quota = {"error": {"errors": [{"reason": "quotaExceeded"}]}}
    monkeypatch.setattr(yt.httpx, "get", FakeYouTube(search=quota, search_status=403))
    c = yt.refresh(project, user)
    assert c.status == "FAILED" and "quota" in c.note and "yt-test-key" not in c.note


def test_per_user_daily_youtube_allowance_and_cooldown_after_partial_runs(project, user, youtube, settings, monkeypatch):
    settings.YOUTUBE_USER_DAILY_UNITS = 200  # less than one look-up (3 searches)
    c = yt.refresh(project, user)
    assert c.status == "LIMITED" and "You've reached" in c.note and c.units == 0
    settings.YOUTUBE_USER_DAILY_UNITS = 1300

    calls = {"n": 0}
    real = FakeYouTube()

    def flaky(url, params=None, **kw):  # second search fails → a partial (LIMITED) run that still spent quota
        if url.endswith("/search"):
            calls["n"] += 1
            if calls["n"] == 2:
                return _resp(400, {}, url)
        return real(url, params)

    monkeypatch.setattr(yt.httpx, "get", flaky)
    c = yt.refresh(project, user)
    assert c.status == "LIMITED" and c.units == 3 * 100 + 1 and len(c.details["searches"]) == 2
    assert yt.refresh(project, user).status == "SKIPPED"  # cooldown applies to partial runs too


def test_failed_channel_details_keep_the_old_rows(project, user, youtube, monkeypatch):
    yt.refresh(project, user)
    YouTubeChannel.objects.update(fetched_at=timezone.now() - timedelta(days=1))
    ProviderCall.objects.update(created_at=timezone.now() - timedelta(hours=7))

    def broken_channels(url, params=None, **kw):
        if url.endswith("/channels"):
            return _resp(500, {}, url)
        return _resp(200, SEARCH, url)

    monkeypatch.setattr(yt.httpx, "get", broken_channels)
    c = yt.refresh(project, user)
    assert c.status == "FAILED" and YouTubeChannel.objects.count() == 2  # nothing replaced with nothing


def test_usage_survives_project_deletion(project, user, youtube, dataforseo):
    yt.refresh(project, user)
    kw.refresh(project, user)
    used_yt, used_kw = yt.units_used_today(user), kw.used_this_month(user)
    project.delete()
    assert yt.units_used_today(user) == used_yt > 0 and kw.used_this_month(user) == used_kw > 0


def test_expired_youtube_data_is_deleted_and_never_served(api, project, user, youtube):
    yt.refresh(project, user)
    YouTubeChannel.objects.filter(channel_id="UC2").update(expires_at=timezone.now() - timedelta(minutes=1))
    body = api.get(f"/api/projects/{project.id}/distribution").json()
    assert [c["channel_id"] for c in body["youtube"]["channels"]] == ["UC1"]
    assert yt.purge_expired() == 1 and YouTubeChannel.objects.count() == 1


# --- keywords -------------------------------------------------------------------------------------------

VOLUME = {
    "status_code": 20000,
    "cost": 0.075,
    "tasks": [
        {
            "status_code": 20000,
            "result": [
                {
                    "keyword": "restaurant inventory app",
                    "search_volume": 880,
                    "cpc": 7.456,
                    "competition": "MEDIUM",
                    "monthly_searches": [
                        {"year": 2026, "month": 10, "search_volume": 900},
                        {"year": 2026, "month": 9, "search_volume": 860},
                    ],
                },
                {"keyword": "how do i count stock faster in my cafe", "search_volume": None, "cpc": None, "competition": None},
            ],
        }
    ],
}
DIFFICULTY = {
    "status_code": 20000,
    "cost": 0.01,
    "tasks": [{"status_code": 20000, "result": [{"items": [{"keyword": "restaurant inventory app", "keyword_difficulty": 23}]}]}],
}


class FakeDataForSEO:
    def __init__(self, difficulty=DIFFICULTY, volume_status=200):
        self.difficulty, self.volume_status, self.calls = difficulty, volume_status, []

    def __call__(self, url, json=None, auth=None, **kw):
        self.calls.append((url, json, auth))
        if "search_volume" in url:
            return _resp(self.volume_status, VOLUME, url)
        if isinstance(self.difficulty, Exception):
            raise self.difficulty
        return _resp(200, self.difficulty, url)


@pytest.fixture
def dataforseo(settings, monkeypatch):
    settings.DATAFORSEO_LOGIN = "login@test"
    settings.DATAFORSEO_PASSWORD = "secret-pass"
    settings.DATAFORSEO_MONTHLY_BUDGET_USD = 20.0
    settings.KEYWORD_LOOKUPS_MONTHLY = {"free": 10, "paid": 10, "founder": 100, "pro": 300}
    fake = FakeDataForSEO()
    monkeypatch.setattr(kw.httpx, "post", fake)
    return fake


def test_keyword_selection_and_location(project):
    assert kw.keywords_for(project) == ["restaurant inventory app", "how do i count stock faster in my cafe"]
    assert kw.location_for(project) == {"code": 2826, "language": "en", "label": "the United Kingdom", "default": False}
    project.market.geographies = ["Germany"]
    assert kw.location_for(project)["language"] == "en"  # English queries are looked up as English searches
    project.market.geographies = ["Mars"]
    assert kw.location_for(project)["default"] is True


def test_keyword_refresh_stores_provider_figures_and_cost(project, user, dataforseo, settings):
    settings.DATAFORSEO_LOGIN = ""
    assert kw.refresh(project, user).status == "REQUIRES_CONNECTION"
    settings.DATAFORSEO_LOGIN = "login@test"
    c = kw.refresh(project, user)
    assert c.status == "OK" and c.units == 2 and c.cost_usd == Decimal("0.0850") and "1 had no search figure" in c.note
    url, payload, auth = dataforseo.calls[0]
    assert payload[0]["location_code"] == 2826 and auth == ("login@test", "secret-pass")
    m = KeywordMetric.objects.get(keyword="restaurant inventory app")
    assert m.search_volume == 880 and m.cpc == Decimal("7.46") and m.difficulty == 23 and m.competition == "MEDIUM"
    assert [x["month"] for x in m.monthly] == [9, 10]  # oldest first
    none = KeywordMetric.objects.get(keyword="how do i count stock faster in my cafe")
    assert none.search_volume is None and none.difficulty is None  # unavailable, never 0
    assert UsageTransaction.objects.get(operation="keyword_data").credits == 0
    assert kw.refresh(project, user).status == "SKIPPED"  # cached for 30 days


def test_keyword_allowance_and_budget(project, user, dataforseo, settings):
    settings.KEYWORD_LOOKUPS_MONTHLY = {"free": 1, "paid": 1}
    c = kw.refresh(project, user)
    assert c.status == "LIMITED" and c.units == 1 and "left for the next look-up" in c.note
    assert kw.refresh(project, user).status == "LIMITED"  # allowance used
    settings.KEYWORD_LOOKUPS_MONTHLY = {"free": 50, "paid": 50}
    settings.DATAFORSEO_MONTHLY_BUDGET_USD = 0.01
    assert "paused" in kw.refresh(project, user).note


def test_keyword_failures_are_recorded_not_raised(project, user, monkeypatch, settings, dataforseo):
    monkeypatch.setattr(kw.httpx, "post", FakeDataForSEO(difficulty=httpx.ConnectTimeout("t")))
    c = kw.refresh(project, user)
    assert c.status == "LIMITED" and "difficulty unavailable" in c.note
    assert KeywordMetric.objects.get(keyword="restaurant inventory app").difficulty is None
    KeywordMetric.objects.all().delete()
    monkeypatch.setattr(kw.httpx, "post", FakeDataForSEO(volume_status=401))
    c = kw.refresh(project, user)
    assert c.status == "FAILED" and "secret-pass" not in c.note and not KeywordMetric.objects.exists()


# --- API ------------------------------------------------------------------------------------------------


def test_distribution_api_owner_only_and_read_only_keys(api, other_api, user, project, youtube, dataforseo):
    base = f"/api/projects/{project.id}/distribution"
    assert other_api.get(base).status_code == 404
    assert other_api.post(f"{base}/refresh").status_code == 404
    r = api.post(f"{base}/refresh", {"sources": ["youtube", "keywords"]}, format="json").json()
    assert r["youtube"]["status"] == "OK" and r["keywords"]["status"] == "OK"
    body = api.get(base).json()
    assert body["youtube"]["connected"] and body["youtube"]["last_check"]["status"] == "OK"
    assert len(body["youtube"]["searches"]) == 3  # how many searches ran, for "found by N of M"
    assert body["youtube"]["channels"][0]["url"].startswith("https://www.youtube.com/channel/")
    assert body["keywords"]["allowance"] == {"used": 2, "limit": 10}
    assert body["keywords"]["rows"][0]["keyword"] == "restaurant inventory app"
    assert "cost" not in str(body["keywords"]) and "yt-test-key" not in str(body)
    _, raw = issue_api_key(user, "mcp")
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Api-Key {raw}")
    assert c.get(base).status_code == 200 and c.post(f"{base}/refresh").status_code == 403


def test_refresh_is_one_at_a_time_and_validates(api, project):
    from django.core.cache import cache

    base = f"/api/projects/{project.id}/distribution/refresh"
    assert api.post(base, {"sources": ["reddit"]}, format="json").status_code == 400
    lock = f"distribution:refresh:user:{project.owner_id}"  # one look-up per account, across all its projects
    cache.add(lock, 1, 60)
    try:
        assert api.post(base).json()["error"]["code"] == "busy"
    finally:
        cache.delete(lock)
    fresh = Project.objects.create(owner=project.owner, name="Draft")
    r = api.post(f"/api/projects/{fresh.id}/distribution/refresh")
    assert r.status_code == 400 and r.json()["error"]["code"] == "not_researched"


def test_report_channels_and_plan_come_with_their_evidence(api, project):
    Report.objects.filter(project=project).delete()
    Report.objects.create(
        project=project,
        content={
            "distribution": {
                "channels": [{"key": "news.ycombinator.com", "name": "Hacker News", "evidence_ids": [5], "is_hypothesis": False}],
                "first_ten_plan": [{"title": "List 30 people", "evidence_ids": [7]}],
            },
            "evidence_index": {"5": {"id": 5, "title": "a"}, "7": {"id": 7, "title": "b"}, "9": {"id": 9, "title": "not cited"}},
        },
    )
    body = api.get(f"/api/projects/{project.id}/distribution").json()
    assert body["channels"][0]["name"] == "Hacker News" and set(body["evidence"]) == {"5", "7"}
    assert ProviderCall.objects.count() == 0  # reading never calls a provider
