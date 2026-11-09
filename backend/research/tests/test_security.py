"""Nothing internal or secret reaches API responses or user-visible notes."""

import httpx
import pytest

from research.providers.base import ProviderError, describe_http_error, redact
from research.providers.stackexchange import StackExchangeProvider


def test_http_errors_never_include_the_url_or_key():
    req = httpx.Request("GET", "https://api.stackexchange.com/2.3/search?q=x&key=SECRET123")
    exc = httpx.HTTPStatusError("boom", request=req, response=httpx.Response(400, request=req))
    msg = describe_http_error(exc)
    assert "SECRET123" not in msg and "stackexchange.com" not in msg and "400" in msg


def test_redact_strips_credentials_from_notes():
    assert (
        redact("failed for https://x.test/a?q=1&key=abc&token=def")
        == "failed for https://x.test/a?q=1&key=[redacted]&token=[redacted]"
    )


def test_stackexchange_error_does_not_leak_key(monkeypatch, settings):
    settings.STACKEXCHANGE_API_KEY = "SECRET123"

    def fake_get(url, params=None, **kw):
        req = httpx.Request("GET", url, params=params)
        return httpx.Response(400, request=req)

    monkeypatch.setattr(httpx, "get", fake_get)
    from research.providers.base import Budget, QueryIn

    with pytest.raises(ProviderError) as err:
        StackExchangeProvider().search(QueryIn(text="stock", intent="problem_discovery"), Budget(max_results=5, max_usd=1))
    assert "SECRET123" not in str(err.value)


def test_estimate_hides_internal_spend_cap(api):
    body = api.get("/api/research/estimate?depth=quick").json()
    assert "max_usd" not in body["budget"] and body["budget"]["queries"]


def test_oversized_ids_are_404_not_500(api, user):
    from projects.models import Project

    p = Project.objects.create(owner=user, name="P")
    assert api.get(f"/api/reports/{p.id}?report=99999999999999999999").status_code == 404
    assert api.get(f"/api/evidence?project={p.id}&cluster=99999999999999999999").status_code == 200
