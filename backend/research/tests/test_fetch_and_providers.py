"""SSRF-safe fetcher, URL-page providers and Stack Exchange — no live network."""

import json
import socket
from pathlib import Path

import httpx
import pytest

from research.providers import fetch as fetch_mod
from research.providers.base import Availability, Budget, ProviderError, QueryIn, RawResult
from research.providers.fetch import BlockedURL, check_url, extract_text, fetch_public_page
from research.providers.stackexchange import StackExchangeProvider
from research.providers.url_pages import CompetitorPagesProvider, UserUrlsProvider

FIXTURES = Path(__file__).parent / "fixtures"


def fake_dns(monkeypatch, mapping: dict[str, str]):
    def getaddrinfo(host, port, *args, **kwargs):
        if host not in mapping:
            raise socket.gaierror("unknown host")
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (mapping[host], port))]

    monkeypatch.setattr(fetch_mod.socket, "getaddrinfo", getaddrinfo)


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "gopher://example.com",
        "http://user:pw@example.com/",
        "http://example.com:8080/",
        "http://127.0.0.1/",
        "http://localhost/",
        "http://10.0.0.5/",
        "http://192.168.1.1/",
        "http://169.254.169.254/latest/meta-data/",
        "http://[::1]/",
    ],
)
def test_blocks_non_public_targets(monkeypatch, url):
    fake_dns(
        monkeypatch,
        {
            "example.com": "93.184.216.34",
            "localhost": "127.0.0.1",
            "127.0.0.1": "127.0.0.1",
            "10.0.0.5": "10.0.0.5",
            "192.168.1.1": "192.168.1.1",
            "169.254.169.254": "169.254.169.254",
            "::1": "::1",
        },
    )
    with pytest.raises(BlockedURL):
        check_url(url)


def test_allows_public_host(monkeypatch):
    fake_dns(monkeypatch, {"example.com": "93.184.216.34"})
    check_url("https://example.com/pricing")


def _client_with(monkeypatch, handler):
    real_client = httpx.Client

    def factory(**kwargs):
        kwargs["transport"] = httpx.MockTransport(handler)
        return real_client(**kwargs)

    monkeypatch.setattr(fetch_mod.httpx, "Client", factory)


PAGE = """<html><head><title>Acme Pricing</title><meta name="description" content="Plans from $29/month.">
<script>var x = 1;</script></head><body><nav>Home Pricing</nav><h1>Simple pricing</h1><p>Starter $29</p></body></html>"""


def test_fetches_public_page_and_extracts_text(monkeypatch):
    fake_dns(monkeypatch, {"acme.test": "93.184.216.34"})

    def handler(request):
        if request.url.path == "/robots.txt":
            return httpx.Response(404)
        return httpx.Response(200, headers={"content-type": "text/html; charset=utf-8"}, text=PAGE)

    _client_with(monkeypatch, handler)
    page = fetch_public_page("https://acme.test/pricing")
    title, description, text = extract_text(page.text)
    assert title == "Acme Pricing"
    assert description == "Plans from $29/month."
    assert "Simple pricing" in text and "var x" not in text and "Home Pricing" not in text


def test_redirect_to_private_host_is_blocked(monkeypatch):
    fake_dns(monkeypatch, {"acme.test": "93.184.216.34", "internal.test": "10.1.2.3"})

    def handler(request):
        if request.url.path == "/robots.txt":
            return httpx.Response(404)
        return httpx.Response(302, headers={"location": "http://internal.test/admin"})

    _client_with(monkeypatch, handler)
    with pytest.raises(BlockedURL):
        fetch_public_page("https://acme.test/go")


def test_robots_txt_is_respected(monkeypatch):
    fake_dns(monkeypatch, {"acme.test": "93.184.216.34"})

    def handler(request):
        if request.url.path == "/robots.txt":
            return httpx.Response(200, headers={"content-type": "text/plain"}, text="User-agent: *\nDisallow: /private")
        return httpx.Response(200, headers={"content-type": "text/html"}, text=PAGE)

    _client_with(monkeypatch, handler)
    with pytest.raises(BlockedURL):
        fetch_public_page("https://acme.test/private/page")


def test_non_html_rejected(monkeypatch):
    fake_dns(monkeypatch, {"acme.test": "93.184.216.34"})

    def handler(request):
        if request.url.path == "/robots.txt":
            return httpx.Response(404)
        return httpx.Response(200, headers={"content-type": "application/pdf"}, content=b"%PDF")

    _client_with(monkeypatch, handler)
    with pytest.raises(fetch_mod.FetchError):
        fetch_public_page("https://acme.test/file.pdf")


def test_url_provider_reports_partial_failures(monkeypatch):
    def fake_fetch(url):
        if "bad" in url:
            raise BlockedURL("not public")
        return fetch_mod.FetchedPage(url=url, status=200, text=PAGE)

    monkeypatch.setattr("research.providers.url_pages.fetch_public_page", fake_fetch)
    provider = CompetitorPagesProvider()
    pages, problems = provider.fetch_urls(["https://acme.test/pricing", "http://bad.test/"], Budget(10, 1.0))
    assert len(pages) == 1 and len(problems) == 1
    ev = provider.normalize(pages[0])
    assert ev.source_url == "https://acme.test/pricing"
    assert ev.title == "Acme Pricing"
    assert ev.excerpt == "Plans from $29/month."


def test_url_provider_raises_when_everything_fails(monkeypatch):
    def fake_fetch(url):
        raise fetch_mod.FetchError("HTTP 500")

    monkeypatch.setattr("research.providers.url_pages.fetch_public_page", fake_fetch)
    with pytest.raises(ProviderError):
        UserUrlsProvider().fetch_urls(["https://a.test/1"], Budget(10, 1.0))


def test_stackexchange_normalize_fixture():
    data = json.loads((FIXTURES / "stackexchange_search.json").read_text(encoding="utf-8"))
    provider = StackExchangeProvider()
    q, a = (provider.normalize(RawResult(provider.key, {**item, "_site": "stackoverflow"})) for item in data["items"])
    assert q.source_url == "https://stackoverflow.com/q/123456"
    assert q.excerpt == "We count everything on a clipboard every Sunday & it takes two hours ."
    assert q.published_at.isoformat() == "2026-01-01"
    assert q.extra["license"] == "CC BY-SA"
    assert a.source_url == "https://stackoverflow.com/a/654321"


def test_stackexchange_availability(settings):
    settings.STACKEXCHANGE_API_KEY = ""
    assert StackExchangeProvider().availability() == Availability.LIMITED
    settings.STACKEXCHANGE_API_KEY = "k"
    assert StackExchangeProvider().availability() == Availability.AVAILABLE


def test_stackexchange_api_error_is_provider_error(monkeypatch):
    def fake_get(url, params, timeout):
        return httpx.Response(
            200,
            json={"error_id": 502, "error_name": "throttle_violation", "error_message": "slow down"},
            request=httpx.Request("GET", url),
        )

    monkeypatch.setattr("research.providers.stackexchange.httpx.get", fake_get)
    with pytest.raises(ProviderError):
        StackExchangeProvider().search(QueryIn("restaurant stock", "problem_discovery"), Budget(10, 1.0))


def test_stackexchange_respects_budget(monkeypatch):
    seen = {}

    def fake_get(url, params, timeout):
        seen.update(params)
        return httpx.Response(200, json={"items": []}, request=httpx.Request("GET", url))

    monkeypatch.setattr("research.providers.stackexchange.httpx.get", fake_get)
    StackExchangeProvider().search(QueryIn("restaurant stock", "problem_discovery"), Budget(7, 1.0))
    assert seen["pagesize"] == 7
