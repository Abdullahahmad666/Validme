"""The only place ValidMe calls an LLM.

`complete_json(prompt, schema)` sends a prompt, asks the model for JSON matching `schema`
(structured outputs), validates the result with jsonschema, and returns it with usage/cost.
Nothing is saved from an LLM response that hasn't passed validation.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from decimal import Decimal
from functools import lru_cache
from typing import Any

import anthropic
import jsonschema
from django.conf import settings

# USD per million tokens (input, output). Anthropic list prices; update when pricing changes.
PRICES_PER_MTOK: dict[str, tuple[Decimal, Decimal]] = {
    "claude-opus-5-5": (Decimal("4"), Decimal("20")),
    "claude-sonnet-5-5": (Decimal("2"), Decimal("10")),
    "claude-haiku-5-5": (Decimal("0.10"), Decimal("0.50")),
}

# Server-side refusal fallback: a request declined by safety classifiers is re-run on Anthropic's
# recommended fallback model inside the same call, instead of failing the research job.
FALLBACK_BETA = "server-side-fallback-2026-07-01"


class LLMError(Exception):
    """Base class: the caller records a failed stage or marks items unclassified. Never fabricate."""


class LLMNotConfigured(LLMError):
    pass


class LLMInvalidOutput(LLMError):
    """The model returned something that doesn't match the schema (after one retry)."""


class LLMRefused(LLMError):
    pass


@dataclass
class LLMResult:
    data: dict[str, Any]
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: Decimal


def is_configured() -> bool:
    return settings.LLM_PROVIDER == "anthropic" and bool(settings.ANTHROPIC_API_KEY)


@lru_cache(maxsize=1)
def _anthropic_client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=120.0, max_retries=2)


def cost_for(model: str, input_tokens: int, output_tokens: int) -> Decimal:
    price_in, price_out = PRICES_PER_MTOK.get(model, PRICES_PER_MTOK["claude-opus-5-5"])
    usd = (Decimal(input_tokens) * price_in + Decimal(output_tokens) * price_out) / Decimal(1_000_000)
    return usd.quantize(Decimal("0.000001"))


def _call_anthropic(system: str, prompt: str, schema: dict[str, Any], max_tokens: int) -> tuple[str, Any]:
    try:
        response = _anthropic_client().beta.messages.create(
            model=settings.LLM_MODEL,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": prompt}],
            output_config={
                "effort": settings.LLM_EFFORT,
                "format": {"type": "json_schema", "schema": schema},
            },
            betas=[FALLBACK_BETA],
            fallbacks="default",
        )
    except anthropic.RateLimitError as exc:
        raise LLMError(f"rate limited: {exc.message}") from exc
    except anthropic.APIStatusError as exc:
        raise LLMError(f"API error {exc.status_code}: {exc.message}") from exc
    except anthropic.APIConnectionError as exc:
        raise LLMError(f"connection error: {exc}") from exc

    if response.stop_reason == "refusal":
        category = getattr(response.stop_details, "category", None) if response.stop_details else None
        raise LLMRefused(f"model declined (category={category})")
    if response.stop_reason == "max_tokens":
        raise LLMInvalidOutput("response hit max_tokens before the JSON was complete")
    text = next((b.text for b in response.content if b.type == "text"), "")
    return text, response


def complete_json(
    prompt: str,
    schema: dict[str, Any],
    *,
    system: str = "",
    max_tokens: int = 16000,
) -> LLMResult:
    """Ask for JSON matching `schema`. Retries once on invalid output, then raises LLMInvalidOutput."""
    if settings.LLM_PROVIDER != "anthropic":
        raise LLMNotConfigured(f"LLM_PROVIDER={settings.LLM_PROVIDER!r} is not implemented; use 'anthropic'.")
    if not settings.ANTHROPIC_API_KEY:
        raise LLMNotConfigured("ANTHROPIC_API_KEY is not set.")

    validator = jsonschema.Draft202012Validator(schema)
    total_in = total_out = 0
    last_error = ""
    for _attempt in range(2):
        text, response = _call_anthropic(system, prompt, schema, max_tokens)
        total_in += response.usage.input_tokens
        total_out += response.usage.output_tokens
        try:
            data = json.loads(text)
            validator.validate(data)
        except (json.JSONDecodeError, jsonschema.ValidationError) as exc:
            last_error = str(exc)[:300]
            continue
        return LLMResult(
            data=data,
            model=response.model,
            input_tokens=total_in,
            output_tokens=total_out,
            cost_usd=cost_for(response.model, total_in, total_out),
        )
    raise LLMInvalidOutput(f"output failed schema validation twice: {last_error}")
