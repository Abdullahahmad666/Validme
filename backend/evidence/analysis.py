"""Evidence analysis: near-duplicate detection, classification and clustering.

Rules (CLAUDE.md, PRD §7):
- Excerpts are never rewritten. AI output goes only into classification fields and EvidenceCluster.
- The model may cite only evidence ids it was given; an output citing unknown ids is rejected whole.
- A failed or unavailable AI step leaves items `unclassified` and says so; nothing is guessed.
- Cluster confidence is computed from evidence volume and source diversity, not by the model.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from decimal import Decimal

from django.db import transaction

from evidence.models import Category, Evidence, EvidenceCluster
from research.ai import client as llm
from research.ai import prompts
from research.models import ResearchJob

CLASSIFY_PROMPT = "classify_v1"
CLUSTER_PROMPT = "cluster_v1"
BATCH = 25
MAX_CLUSTER_ITEMS = 150
SIMHASH_DISTANCE = 3  # ≤ 3 differing bits of 64 = near-identical text
CLUSTER_CATEGORIES = [
    Category.PAIN_POINT,
    Category.FEATURE_REQUEST,
    Category.ALTERNATIVE_SEEKING,
    Category.PRICING_OBJECTION,
    Category.BUYING_INTENT,
    Category.WORKAROUND,
]
LABELLED = [c.value for c in Category if c != Category.UNCLASSIFIED]
_WORD = re.compile(r"[a-z0-9']+")


# ------------------------------------------------------------------ near-duplicates (simhash)
def simhash(text: str) -> int:
    """64-bit simhash over word 3-shingles. Reposts and lightly edited copies land within a few bits."""
    words = _WORD.findall(text.lower())
    shingles = [" ".join(words[i : i + 3]) for i in range(max(1, len(words) - 2))] if words else [""]
    weights = [0] * 64
    for s in shingles:
        h = int.from_bytes(hashlib.blake2b(s.encode(), digest_size=8).digest(), "big")
        for bit in range(64):
            weights[bit] += 1 if (h >> bit) & 1 else -1
    return sum(1 << bit for bit in range(64) if weights[bit] > 0)


def hamming(a: int, b: int) -> int:
    return (a ^ b).bit_count()


def mark_near_duplicates(job: ResearchJob) -> int:
    """Fingerprint this job's evidence and point near-copies at the earliest original in the project."""
    project_items = list(Evidence.objects.filter(project=job.project).order_by("retrieved_at", "id"))
    for item in project_items:
        if not item.simhash:
            item.simhash = f"{simhash(f'{item.title} {item.excerpt}'):016x}"
            Evidence.objects.filter(pk=item.pk).update(simhash=item.simhash)
    originals: list[tuple[int, Evidence]] = []
    merged = 0
    for item in project_items:
        fp = int(item.simhash, 16)
        if item.duplicate_of_id is None and len(item.excerpt) >= 40:
            match = next((orig for ofp, orig in originals if hamming(fp, ofp) <= SIMHASH_DISTANCE), None)
            if match is not None and item.job_id == job.id:
                Evidence.objects.filter(pk=item.pk).update(duplicate_of=match)
                merged += 1
                continue
        if item.duplicate_of_id is None:
            originals.append((fp, item))
    return merged


# ------------------------------------------------------------------ LLM steps
def _idea(job: ResearchJob) -> str:
    idea = job.project.idea
    return f"{job.project.name}: {idea.original_description}".replace("<", "&lt;")


def _items_json(items: list[Evidence], extra: bool = False) -> str:
    rows = []
    for e in items:
        row = {"id": e.id, "title": e.title[:200], "excerpt": e.excerpt}
        if extra:
            row["category"] = e.category
        rows.append(row)
    return json.dumps(rows, ensure_ascii=False).replace("<", "&lt;")


CLASSIFY_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["results"],
    "properties": {
        "results": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["id", "category", "relevance"],
                "properties": {
                    "id": {"type": "integer"},
                    "category": {"type": "string", "enum": LABELLED},
                    "relevance": {"type": "number", "minimum": 0, "maximum": 1},
                },
            },
        }
    },
}

CLUSTER_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["themes"],
    "properties": {
        "themes": {
            "type": "array",
            "maxItems": 10,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["name", "category", "summary", "severity", "evidence_ids"],
                "properties": {
                    "name": {"type": "string", "minLength": 3, "maxLength": 120},
                    "category": {"type": "string", "enum": [c.value for c in CLUSTER_CATEGORIES]},
                    "summary": {"type": "string", "minLength": 1, "maxLength": 400},
                    "severity": {"type": "string", "enum": ["low", "medium", "high"]},
                    "evidence_ids": {"type": "array", "minItems": 1, "items": {"type": "integer"}},
                },
            },
        }
    },
}


@dataclass
class AnalysisResult:
    duplicates: int = 0
    classified: int = 0
    unclassified: int = 0
    themes: int = 0
    cost_usd: Decimal = Decimal("0")
    notes: list[str] = field(default_factory=list)

    def summary(self) -> str:
        parts = [f"{self.duplicates} near-duplicate{'s' if self.duplicates != 1 else ''} merged"]
        parts.append(f"{self.classified} classified")
        if self.unclassified:
            parts.append(f"{self.unclassified} left unclassified")
        parts.append(f"{self.themes} theme{'s' if self.themes != 1 else ''}")
        return " · ".join(parts) + (f" ({'; '.join(self.notes)})" if self.notes else "")


def classify(job: ResearchJob, result: AnalysisResult) -> None:
    items = list(Evidence.objects.filter(job=job, duplicate_of__isnull=True, category=Category.UNCLASSIFIED).order_by("id"))
    if not items:
        return
    template, version = prompts.load(CLASSIFY_PROMPT)
    for start in range(0, len(items), BATCH):
        batch = items[start : start + BATCH]
        ids = {e.id for e in batch}
        try:
            out = llm.complete_json(template.format(idea=_idea(job), items=_items_json(batch)), CLASSIFY_SCHEMA)
        except llm.LLMError as exc:
            result.cost_usd += exc.cost_usd
            result.unclassified += len(batch)
            if "a classification batch failed" not in result.notes:
                result.notes.append("a classification batch failed")
            continue
        result.cost_usd += out.cost_usd
        rows = out.data["results"]
        if any(r["id"] not in ids for r in rows):
            # The model cited evidence it wasn't given: reject the whole batch.
            result.unclassified += len(batch)
            result.notes.append("a batch cited unknown evidence and was rejected")
            continue
        tag = f"{version}@{out.model}"[:40]
        seen = set()
        with transaction.atomic():
            for r in rows:
                if r["id"] in seen:
                    continue
                seen.add(r["id"])
                Evidence.objects.filter(pk=r["id"], job=job).update(
                    category=r["category"], relevance=round(r["relevance"], 3), classifier_version=tag
                )
        result.classified += len(seen)
        result.unclassified += len(ids - seen)


def confidence_for(evidence: list[Evidence]) -> str:
    """From the evidence itself: distinct sources and how many providers they came from."""
    urls = {e.source_url for e in evidence}
    providers = {e.provider for e in evidence}
    if len(urls) >= 5 and len(providers) >= 2:
        return "high"
    if len(urls) >= 3:
        return "medium"
    return "low"


def cluster(job: ResearchJob, result: AnalysisResult) -> None:
    items = list(
        Evidence.objects.filter(
            project=job.project, duplicate_of__isnull=True, category__in=CLUSTER_CATEGORIES, relevance__gte=0.4
        ).order_by("-relevance", "id")[:MAX_CLUSTER_ITEMS]
    )
    if len(items) < 2:
        result.notes.append("not enough relevant evidence to group into themes")
        return
    by_id = {e.id: e for e in items}
    template, version = prompts.load(CLUSTER_PROMPT)
    try:
        out = llm.complete_json(template.format(idea=_idea(job), items=_items_json(items, extra=True)), CLUSTER_SCHEMA)
    except llm.LLMError as exc:
        result.cost_usd += exc.cost_usd
        result.notes.append("grouping into themes failed")
        return
    result.cost_usd += out.cost_usd
    themes = out.data["themes"]
    if any(i not in by_id for t in themes for i in t["evidence_ids"]):
        result.notes.append("theme output cited unknown evidence and was rejected")
        return
    tag = f"{version}@{out.model}"[:60]
    with transaction.atomic():
        EvidenceCluster.objects.filter(project=job.project).delete()  # themes always reflect the latest analysis
        for t in themes:
            members = [by_id[i] for i in dict.fromkeys(t["evidence_ids"])]
            c = EvidenceCluster.objects.create(
                project=job.project,
                job=job,
                name=t["name"],
                category=t["category"],
                severity=t["severity"],
                confidence=confidence_for(members),
                ai_summary=t["summary"],
                prompt_version=tag,
            )
            c.evidence.set(members)
    result.themes = len(themes)


def analyze_evidence(job: ResearchJob) -> AnalysisResult:
    result = AnalysisResult()
    result.duplicates = mark_near_duplicates(job)
    if not llm.is_configured():
        result.unclassified = Evidence.objects.filter(job=job, duplicate_of__isnull=True, category=Category.UNCLASSIFIED).count()
        result.notes.append("AI unavailable, evidence left unclassified")
        return result
    classify(job, result)
    cluster(job, result)
    return result
