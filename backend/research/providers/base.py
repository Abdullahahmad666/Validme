"""Provider interface. Every data source implements ResearchProvider and returns normalized EvidenceIn."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import date, datetime
from enum import StrEnum
from typing import Any, Protocol


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
    extra: dict[str, Any] = field(default_factory=dict)

    @property
    def content_hash(self) -> str:
        normalized = " ".join(self.excerpt.lower().split())
        return hashlib.sha256(normalized.encode()).hexdigest()


class ProviderError(Exception):
    """Raised by a provider; the orchestrator records it as coverage FAILED instead of failing the job."""


class ResearchProvider(Protocol):
    key: str
    label: str
    contributes: str

    def availability(self) -> Availability: ...

    def search(self, query: QueryIn, budget: Budget) -> list[RawResult]: ...

    def normalize(self, raw: RawResult) -> EvidenceIn: ...


def clip(text: str, limit: int = 500) -> str:
    text = " ".join((text or "").split())
    return text if len(text) <= limit else text[: limit - 1] + "…"
