"""GitHub issues provider: recorded fixture only (no live network)."""

import json
from datetime import date
from pathlib import Path

import httpx
import pytest

from evidence.models import Evidence
from reports.distribution import channel_of
from research.providers import github_issues, registry
from research.providers.base import Availability, Budget, ProviderError, QueryIn

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "github_issues_search.json").read_text(encoding="utf-8"))


class FakeGet:
    def __init__(self, *responses):
        self.responses = list(responses)
        self.calls = []

    def __call__(self, url, params=None, headers=None, **kw):
        self.calls.append({"url": url, "params": params, "headers": headers, **kw})
        status, body = self.responses.pop(0)
        return httpx.Response(status, json=body, request=httpx.Request("GET", url))


@pytest.fixture
def provider():
    return github_issues.GitHubIssuesProvider()


def test_registered_and_availability(provider, settings):
    assert "github_issues" in registry.PROVIDERS
    settings.GITHUB_TOKEN = ""
    assert provider.availability() == Availability.LIMITED
    settings.GITHUB_TOKEN = "github_pat_test"
    assert provider.availability() == Availability.AVAILABLE


def test_search_query_headers_and_no_pull_requests(provider, monkeypatch, settings):
    settings.GITHUB_TOKEN = "github_pat_test"
    fake = FakeGet((200, FIXTURE))
    monkeypatch.setattr(github_issues.httpx, "get", fake)
    rows = provider.search(QueryIn("restaurant stock counting", "problem_discovery"), Budget(max_results=10, max_usd=1))
    assert len(rows) == 2  # the pull request is dropped
    call = fake.calls[0]
    assert call["params"]["q"].startswith("restaurant stock counting is:issue is:public interactions:>0 created:>")
    assert call["params"]["per_page"] == 10 and call["timeout"] == 10
    assert call["headers"]["Authorization"] == "Bearer github_pat_test"
    assert call["headers"]["X-GitHub-Api-Version"] == "2022-11-28"


def test_budget_is_respected(provider, monkeypatch, settings):
    settings.GITHUB_TOKEN = ""
    fake = FakeGet((200, FIXTURE))
    monkeypatch.setattr(github_issues.httpx, "get", fake)
    rows = provider.search(QueryIn("stock", "problem_discovery"), Budget(max_results=1, max_usd=1))
    assert len(rows) == 1 and fake.calls[0]["params"]["per_page"] == 1
    assert "Authorization" not in fake.calls[0]["headers"]  # no token, no header


def test_normalize_mapping(provider):
    e = provider.normalize(github_issues.RawResult("github_issues", FIXTURE["items"][0]))
    assert e.source_url == "https://github.com/acme/stockapp/issues/42"
    assert e.title == "acme/stockapp: Counting inventory takes hours with the CSV import"
    assert "<b>" not in e.excerpt and "export to CSV" in e.excerpt and len(e.excerpt) <= 500
    assert e.published_at == date(2026, 9, 14)
    assert len(e.author_hash) == 64 and "chef-dev" not in e.author_hash
    blank = provider.normalize(github_issues.RawResult("github_issues", FIXTURE["items"][2]))
    assert blank.published_at is None and blank.author_hash == "" and blank.excerpt == "Feature request: barcode scanning"


def test_rate_limit_and_retry(provider, monkeypatch):
    fake = FakeGet((502, {}), (200, FIXTURE))
    monkeypatch.setattr(github_issues.httpx, "get", fake)
    assert len(provider.search(QueryIn("stock", "x"), Budget(max_results=5, max_usd=1))) == 2  # one retry on 5xx
    monkeypatch.setattr(github_issues.httpx, "get", FakeGet((403, {"message": "API rate limit exceeded"})))
    with pytest.raises(ProviderError) as err:
        provider.search(QueryIn("stock", "x"), Budget(max_results=5, max_usd=1))
    assert "HTTP 403" in str(err.value) and "api.github.com" not in str(err.value)  # no URL in user-facing text


def test_each_repository_is_its_own_channel():
    e = Evidence(provider="github_issues", source_url="https://github.com/acme/stockapp/issues/42")
    assert channel_of(e) == ("github.com/acme/stockapp", "GitHub: acme/stockapp")


def test_query_text_cannot_change_the_search_scope():
    assert github_issues.clean_query('stock app OR repo:evil/x (is:pr) "count" NOT foo') == "stock app count foo"
    assert github_issues.clean_query("is:pr") == ""


def test_issue_markdown_and_templates_are_stripped(provider):
    item = {
        **FIXTURE["items"][0],
        "body": "<!-- Please fill the template -->\n### Steps\n- open **import**\n```\nstack trace\n```\n![shot](x.png) see [docs](https://d.test)",
    }
    e = provider.normalize(github_issues.RawResult("github_issues", item))
    assert "Please fill" not in e.excerpt and "###" not in e.excerpt and "stack trace" not in e.excerpt
    assert "**" not in e.excerpt and "x.png" not in e.excerpt and "docs" in e.excerpt


def test_rate_limit_pauses_the_provider_and_bad_json_is_an_error(provider, monkeypatch):
    from django.core.cache import cache

    cache.delete("github_issues:paused")
    fake = FakeGet((429, {}))
    monkeypatch.setattr(github_issues.httpx, "get", fake)
    with pytest.raises(ProviderError):
        provider.search(QueryIn("stock", "x"), Budget(max_results=5, max_usd=1))
    with pytest.raises(ProviderError, match="paused"):
        provider.search(QueryIn("other", "x"), Budget(max_results=5, max_usd=1))
    assert len(fake.calls) == 1  # the second query didn't hit GitHub
    cache.delete("github_issues:paused")

    def not_json(url, **kw):
        return httpx.Response(200, text="<html>oops</html>", request=httpx.Request("GET", url))

    monkeypatch.setattr(github_issues.httpx, "get", not_json)
    with pytest.raises(ProviderError, match="unreadable"):
        provider.search(QueryIn("stock", "x"), Budget(max_results=5, max_usd=1))


def test_one_off_repos_are_grouped_not_channels(db, user):
    from datetime import UTC, datetime

    from projects.models import Project
    from reports.distribution import researched_channels

    project = Project.objects.create(owner=user, name="P")

    def ev(url, rel=0.9):
        return Evidence.objects.create(
            project=project,
            provider="github_issues",
            source_url=url,
            title="t",
            excerpt=url,
            retrieved_at=datetime.now(UTC),
            content_hash=url,
            category="pain_point",
            relevance=rel,
            classifier_version="v",
        )

    items = [ev("https://github.com/acme/stock/issues/1"), ev("https://github.com/acme/stock/issues/2")]
    items += [
        ev("https://github.com/student/toy/issues/9"),
        ev("https://github.com/weak/repo/issues/1", 0.2),
        ev("https://github.com/weak/repo/issues/2", 0.2),
    ]
    names = {c["name"]: c for c in researched_channels(items)}
    assert set(names) == {"GitHub: acme/stock", "GitHub issues"}
    assert names["GitHub issues"]["threads"] == 3
