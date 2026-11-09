"""complete_json: schema validation, one retry, refusals, cost. The Anthropic client is faked."""

from decimal import Decimal
from types import SimpleNamespace

import pytest

from research.ai import client as llm

SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["answer"],
    "properties": {"answer": {"type": "string", "minLength": 1}},
}


def response(text, stop_reason="end_turn", model="claude-opus-5-5"):
    return SimpleNamespace(
        content=[SimpleNamespace(type="text", text=text)],
        stop_reason=stop_reason,
        stop_details=None,
        model=model,
        usage=SimpleNamespace(input_tokens=1000, output_tokens=200),
    )


class FakeMessages:
    def __init__(self, replies):
        self.replies = list(replies)
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return self.replies.pop(0)


@pytest.fixture
def fake(monkeypatch, settings):
    settings.LLM_PROVIDER = "anthropic"
    settings.ANTHROPIC_API_KEY = "test-key"
    settings.LLM_MODEL = "claude-opus-5-5"
    settings.LLM_EFFORT = "medium"

    def install(*replies):
        messages = FakeMessages(replies)
        monkeypatch.setattr(llm, "_anthropic_client", lambda: SimpleNamespace(beta=SimpleNamespace(messages=messages)))
        return messages

    return install


def test_valid_json_returns_data_and_cost(fake):
    calls = fake(response('{"answer": "yes"}'))
    result = llm.complete_json("q", SCHEMA)
    assert result.data == {"answer": "yes"}
    # 1000 in × $4/M + 200 out × $20/M
    assert result.cost_usd == Decimal("0.008000")
    sent = calls.calls[0]
    assert sent["output_config"]["format"] == {"type": "json_schema", "schema": SCHEMA}
    assert sent["output_config"]["effort"] == "medium"
    assert sent["fallbacks"] == "default"
    assert llm.FALLBACK_BETA in sent["betas"]


def test_invalid_output_is_retried_once(fake):
    calls = fake(response('{"wrong": 1}'), response('{"answer": "ok"}'))
    result = llm.complete_json("q", SCHEMA)
    assert result.data == {"answer": "ok"}
    assert len(calls.calls) == 2
    assert result.input_tokens == 2000  # both attempts are counted in the cost


def test_invalid_twice_raises(fake):
    fake(response("not json"), response('{"answer": ""}'))
    with pytest.raises(llm.LLMInvalidOutput):
        llm.complete_json("q", SCHEMA)


def test_refusal_raises(fake):
    fake(response("", stop_reason="refusal"))
    with pytest.raises(llm.LLMRefused):
        llm.complete_json("q", SCHEMA)


def test_truncated_output_raises(fake):
    fake(response('{"answer": "cut', stop_reason="max_tokens"))
    with pytest.raises(llm.LLMInvalidOutput):
        llm.complete_json("q", SCHEMA)


def test_not_configured(settings):
    settings.ANTHROPIC_API_KEY = ""
    assert llm.is_configured() is False
    with pytest.raises(llm.LLMNotConfigured):
        llm.complete_json("q", SCHEMA)
