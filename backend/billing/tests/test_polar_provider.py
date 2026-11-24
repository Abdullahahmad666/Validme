"""Polar provider: request shapes, sandbox/production hosts, price labels and portal links (network mocked)."""

import httpx
import pytest

from billing.providers import polar
from billing.tests.test_billing import payments  # noqa: F401 (fixture)


class FakeResponse:
    def __init__(self, payload, status=200):
        self._payload, self.status_code = payload, status

    def raise_for_status(self):
        if self.status_code >= 400:
            request = httpx.Request("GET", "https://sandbox-api.polar.sh/v1/x")
            raise httpx.HTTPStatusError("err", request=request, response=httpx.Response(self.status_code, request=request))

    def json(self):
        return self._payload


class Calls(list):
    """Requests made (method, url, kwargs), answered in order from `replies`."""

    def __init__(self):
        super().__init__()
        self.replies: list[FakeResponse] = []


@pytest.fixture
def calls(monkeypatch):
    seen = Calls()

    def fake(method):
        def call(url, **kw):
            seen.append((method, url, kw))
            return seen.replies.pop(0)

        return call

    monkeypatch.setattr(httpx, "post", fake("POST"))
    monkeypatch.setattr(httpx, "get", fake("GET"))
    return seen


def test_checkout_sends_products_metadata_and_customer_to_the_sandbox(payments, calls):  # noqa: F811
    calls.replies = [FakeResponse({"id": "chk_1", "url": "https://sandbox.polar.sh/checkout/polar_c_1"})]
    checkout_id, url = polar.create_checkout(
        product_id="prod-1",
        metadata={"user_id": 7, "kind": "pack"},
        email="a@b.test",
        customer_ref="7",
        success_url="https://app.test/billing",
    )
    method, endpoint, kw = calls[0]
    assert (checkout_id, url) == ("chk_1", "https://sandbox.polar.sh/checkout/polar_c_1")
    assert method == "POST" and endpoint == "https://sandbox-api.polar.sh/v1/checkouts/"
    assert kw["json"] == {
        "products": ["prod-1"],
        "metadata": {"user_id": "7", "kind": "pack"},
        "customer_email": "a@b.test",
        "external_customer_id": "7",
        "success_url": "https://app.test/billing",
    }
    assert kw["headers"]["Authorization"] == "Bearer test-token"


def test_production_server_uses_the_live_api(payments, settings, calls):  # noqa: F811
    settings.POLAR_SERVER = "production"
    calls.replies = [FakeResponse({"id": "c", "url": "https://polar.sh/checkout/c"})]
    polar.create_checkout(product_id="p", metadata={}, email="a@b.test", customer_ref="1", success_url="https://x.test")
    assert calls[0][1] == "https://api.polar.sh/v1/checkouts/"


def test_unknown_server_means_payments_are_closed(payments, settings):  # noqa: F811
    settings.POLAR_SERVER = "staging"
    assert not polar.is_configured()


def test_checkout_failure_never_echoes_the_token(payments, calls, caplog):  # noqa: F811
    calls.replies = [FakeResponse({}, status=401)]
    with pytest.raises(polar.ProviderUnavailable):
        polar.create_checkout(product_id="p", metadata={}, email="a@b.test", customer_ref="1", success_url="https://x.test")
    assert "test-token" not in caplog.text and "401" in caplog.text


def test_price_label_uses_the_active_fixed_price(payments, calls):  # noqa: F811
    from django.core.cache import cache

    cache.clear()
    calls.replies = [
        FakeResponse(
            {
                "prices": [
                    {"amount_type": "fixed", "is_archived": True, "price_amount": 900, "price_currency": "usd"},
                    {"amount_type": "fixed", "is_archived": False, "price_amount": 1900, "price_currency": "usd"},
                ]
            }
        )
    ]
    assert polar.price_label("prod-1") == "19.00 USD"
    assert polar.price_label("prod-1") == "19.00 USD"  # cached: no second request
    assert len(calls) == 1 and calls[0][1] == "https://sandbox-api.polar.sh/v1/products/prod-1"


def test_portal_link_comes_from_a_fresh_customer_session(payments, calls):  # noqa: F811
    calls.replies = [
        FakeResponse({"id": "sub_1", "customer_id": "cus_1"}),
        FakeResponse({"customer_portal_url": "https://sandbox.polar.sh/acme/portal?customer_session_token=x"}),
    ]
    assert polar.customer_portal_url("sub_1").startswith("https://sandbox.polar.sh/")
    assert calls[1][1] == "https://sandbox-api.polar.sh/v1/customer-sessions/" and calls[1][2]["json"] == {"customer_id": "cus_1"}
