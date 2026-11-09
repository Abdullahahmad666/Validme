"""Provider interface. Every data source implements ResearchProvider and returns normalized EvidenceIn."""

from __future__ import annotations

import hashlib
import html
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from enum import StrEnum
from typing import Any, Protocol
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import httpx


class Availability(StrEnum):
    AVAILABLE = "AVAILABLE"
    LIMITED = "LIMITED"
    REQUIRES_CONNECTION = "REQUIRES_CONNECTION"
    UNAVAILABLE = "UNAVAILABLE"


@dataclass
class Budget:
    max_results: int
    max_usd: float
    spent_usd: float = 0.0

    def charge(self, usd: float) -> None:
        self.spent_usd += usd

    @property
    def exhausted(self) -> bool:
        return self.spent_usd >= self.max_usd


@dataclass
class QueryIn:
    text: str
    intent: str
    geography: str = ""


@dataclass
class RawResult:
    provider: str
    data: dict[str, Any]


@dataclass
class EvidenceIn:
    provider: str
    source_url: str
    title: str
    excerpt: str
    retrieved_at: datetime
    published_at: date | None = None
    author_hash: str = ""
    license: str = ""
    author_name: str = ""
    author_url: str = ""
    extra: dict[str, Any] = field(default_factory=dict)

    @property
    def content_hash(self) -> str:
        normalized = " ".join(self.excerpt.lower().split())
        return hashlib.sha256(normalized.encode()).hexdigest()


class ProviderError(Exception):
    """Raised by a provider; the orchestrator records it as coverage FAILED instead of failing the job.

    Its message is shown to the user in coverage notes: build it with `describe_http_error`, never str(exc),
    because httpx messages include the request URL (and API keys sent as query parameters).
    """


_SECRET_PARAM = re.compile(r"(?i)\b(key|api_key|apikey|access_token|token|secret|signature)=[^&\s'\"]+")


def redact(text: str) -> str:
    """Remove credentials from text that may reach users or logs."""
    return _SECRET_PARAM.sub(r"\1=[redacted]", text)


def describe_http_error(exc: Exception) -> str:
    """A user-safe description of an HTTP failure: status or kind only, no URL."""
    if isinstance(exc, httpx.HTTPStatusError):
        code = exc.response.status_code
        if code == 429:
            return "rate limited by the source (HTTP 429)"
        return f"the source returned HTTP {code}"
    if isinstance(exc, httpx.TimeoutException):
        return "the source timed out"
    if isinstance(exc, httpx.HTTPError):
        return "couldn't reach the source"
    return "unexpected error"


class ResearchProvider(Protocol):
    key: str
    label: str
    contributes: str

    def availability(self) -> Availability: ...

    def search(self, query: QueryIn, budget: Budget) -> list[RawResult]: ...

    def normalize(self, raw: RawResult) -> EvidenceIn: ...


_TRACKING_PARAMS = ("utm_", "fbclid", "gclid", "mc_cid", "mc_eid", "ref_src")


def normalize_url(url: str) -> str:
    """Canonical form for dedupe: lowercase host, no fragment, no tracking params, no trailing slash."""
    parts = urlsplit(url.strip())
    query = urlencode(
        [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if not k.lower().startswith(_TRACKING_PARAMS)]
    )
    path = parts.path.rstrip("/") or "/"
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), path, query, ""))


_TAG = re.compile(r"<[^>]+>")


def strip_html(text: str) -> str:
    """Source text without markup: tags removed, entities decoded, whitespace collapsed."""
    return " ".join(html.unescape(_TAG.sub(" ", text or "")).split())


def clip(text: str, limit: int = 500) -> str:
    text = " ".join((text or "").split())
    return text if len(text) <= limit else text[: limit - 1] + "…"
