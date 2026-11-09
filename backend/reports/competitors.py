"""Competitor profiles.

- Listed competitors: one per competitor page the founder gave us. Positioning is the page's own text.
  Audience, features and plans are extracted by AI from the page, and a plan is kept only if its price
  text appears verbatim in the fetched page; otherwise pricing is "unavailable". Dated by retrieval.
- Mentioned competitors (if discovery is on): products named in the collected evidence. A name is
  kept only if it appears in the excerpts the model cites.
- Complaints: pain-type evidence that names the competitor. The gap summary may cite only those.
"""

from __future__ import annotations

import json
import re
from decimal import Decimal
from urllib.parse import urlsplit

from django.db import transaction

from evidence.models import Category, Evidence, SourceSnapshot
from reports.models import Competitor
from research.ai import client as llm
from research.ai import prompts
from research.models import ResearchJob

COMPLAINT_CATEGORIES = [Category.PAIN_POINT, Category.PRICING_OBJECTION, Category.ALTERNATIVE_SEEKING, Category.FEATURE_REQUEST]

PAGE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["name", "audience", "features", "plans"],
    "properties": {
        "name": {"type": "string", "minLength": 1, "maxLength": 120},
        "audience": {"type": "string", "maxLength": 200},
        "features": {"type": "array", "maxItems": 8, "items": {"type": "string", "minLength": 1, "maxLength": 80}},
        "plans": {
            "type": "array",
            "maxItems": 8,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["name", "price", "period"],
                "properties": {
                    "name": {"type": "string", "maxLength": 60},
                    "price": {"type": "string", "minLength": 1, "maxLength": 30},
                    "period": {"type": "string", "maxLength": 40},
                },
            },
        },
    },
}

MENTIONS_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["competitors"],
    "properties": {
        "competitors": {
            "type": "array",
            "maxItems": 10,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["name", "evidence_ids"],
                "properties": {
                    "name": {"type": "string", "minLength": 2, "maxLength": 80},
                    "evidence_ids": {"type": "array", "minItems": 1, "items": {"type": "integer"}},
                },
            },
        }
    },
}

GAP_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["gap", "evidence_ids"],
    "properties": {
        "gap": {"type": "string", "minLength": 1, "maxLength": 400},
        "evidence_ids": {"type": "array", "minItems": 1, "items": {"type": "integer"}},
    },
}


def _norm(text: str) -> str:
    return " ".join(text.split()).lower()


def verified_plans(plans: list[dict], page_text: str) -> list[dict]:
    """Keep only plans whose price text appears verbatim on the page (whitespace-insensitive)."""
    page = _norm(page_text)
    return [p for p in plans if p["price"].strip() and _norm(p["price"]) in page]


def _host_name(url: str) -> str:
    host = urlsplit(url).hostname or url
    host = host.removeprefix("www.")
    return host.split(".")[0].capitalize() if host else url


def _quote(text: str) -> str:
    return text.replace("<", "&lt;")


def _mentions(name: str) -> re.Pattern:
    return re.compile(r"(?<![\w])" + re.escape(name) + r"(?![\w])", re.IGNORECASE)


class Run:
    def __init__(self) -> None:
        self.cost = Decimal("0")
        self.notes: list[str] = []

    def call(self, prompt: str, schema: dict, note: str):
        try:
            out = llm.complete_json(prompt, schema)
        except llm.LLMError as exc:
            self.cost += exc.cost_usd
            if note not in self.notes:
                self.notes.append(note)
            return None
        self.cost += out.cost_usd
        return out


def _profile_listed(job: ResearchJob, run: Run, ai: bool) -> list[Competitor]:
    created = []
    pages = Evidence.objects.filter(job=job, provider="competitor_pages").select_related("snapshot")
    for page in pages:
        snapshot = getattr(page, "snapshot", None)
        comp = Competitor(
            project=job.project,
            job=job,
            name=page.title[:160] or _host_name(page.source_url),
            website=page.source_url,
            kind=Competitor.Kind.LISTED,
            positioning=page.excerpt,
            pricing={
                "status": "unavailable",
                "plans": [],
                "source_url": page.source_url,
                "retrieved_at": page.retrieved_at.isoformat(),
            },
        )
        if ai and isinstance(snapshot, SourceSnapshot) and snapshot.text:
            template, version = prompts.load("competitor_page_v1")
            out = run.call(
                template.format(url=page.source_url, text=_quote(snapshot.text[:12000])),
                PAGE_SCHEMA,
                "a competitor page couldn't be read by AI",
            )
            if out:
                data = out.data
                comp.name = data["name"][:160] or comp.name
                comp.audience = data["audience"]
                comp.features = data["features"]
                plans = verified_plans(data["plans"], snapshot.text)
                if plans:
                    comp.pricing.update(status="verified", plans=plans)
                comp.extraction_version = f"{version}@{out.model}"[:60]
        comp.save()
        comp.evidence.add(page)
        created.append(comp)
    return created


def _discover_mentioned(job: ResearchJob, run: Run, known: set[str]) -> list[Competitor]:
    items = list(
        Evidence.objects.filter(project=job.project, duplicate_of__isnull=True, relevance__gte=0.3)
        .exclude(category__in=[Category.IRRELEVANT, Category.UNCLASSIFIED])
        .order_by("-relevance", "id")[:120]
    )
    if len(items) < 2:
        return []
    by_id = {e.id: e for e in items}
    template, version = prompts.load("competitor_mentions_v1")
    description = job.project.idea.original_description if hasattr(job.project, "idea") else ""
    idea = _quote(f"{job.project.name}: {description}")
    payload = _quote(json.dumps([{"id": e.id, "title": e.title[:200], "excerpt": e.excerpt} for e in items], ensure_ascii=False))
    out = run.call(template.format(idea=idea, items=payload), MENTIONS_SCHEMA, "finding competitors in evidence failed")
    if not out:
        return []
    created = []
    for c in out.data["competitors"]:
        ids = list(dict.fromkeys(c["evidence_ids"]))
        if any(i not in by_id for i in ids):
            run.notes.append("a competitor cited unknown evidence and was dropped")
            continue
        pattern = _mentions(c["name"])
        cited = [by_id[i] for i in ids if pattern.search(f"{by_id[i].title} {by_id[i].excerpt}")]
        if not cited or c["name"].lower() in known:
            continue  # the name isn't actually in the cited text, or it's already a listed competitor
        known.add(c["name"].lower())
        comp = Competitor.objects.create(
            project=job.project,
            job=job,
            name=c["name"][:160],
            kind=Competitor.Kind.MENTIONED,
            pricing={"status": "unavailable", "plans": []},
            extraction_version=f"{version}@{out.model}"[:60],
        )
        comp.evidence.add(*cited)
        created.append(comp)
    return created


def _attach_complaints(job: ResearchJob, run: Run, competitors: list[Competitor], ai: bool) -> None:
    pool = list(
        Evidence.objects.filter(project=job.project, duplicate_of__isnull=True, category__in=COMPLAINT_CATEGORIES).exclude(
            provider="competitor_pages"
        )
    )
    template, version = prompts.load("competitor_gap_v1")
    for comp in competitors:
        pattern = _mentions(comp.name)
        hits = [e for e in pool if pattern.search(f"{e.title} {e.excerpt}")]
        comp.complaints = [e.id for e in hits]
        if hits:
            comp.evidence.add(*hits)
        if ai and hits:
            by_id = {e.id: e for e in hits[:25]}
            payload = _quote(json.dumps([{"id": e.id, "excerpt": e.excerpt} for e in by_id.values()], ensure_ascii=False))
            out = run.call(template.format(name=_quote(comp.name), items=payload), GAP_SCHEMA, "a competitor gap summary failed")
            if out and all(i in by_id for i in out.data["evidence_ids"]):
                comp.identified_gap = out.data["gap"]
        comp.save(update_fields=["complaints", "identified_gap"])


def build_competitors(job: ResearchJob) -> tuple[list[Competitor], Decimal, list[str]]:
    """Rebuild this project's competitor profiles from the job's evidence. Returns (competitors, cost, notes)."""
    run = Run()
    ai = llm.is_configured()
    with transaction.atomic():
        Competitor.objects.filter(project=job.project).delete()
        competitors = _profile_listed(job, run, ai)
        if ai and job.config_snapshot.get("competitor_discovery", True):
            competitors += _discover_mentioned(job, run, {c.name.lower() for c in competitors})
        _attach_complaints(job, run, competitors, ai)
    if not ai:
        run.notes.append("AI unavailable: features, prices and competitor discovery skipped")
    return competitors, run.cost, run.notes
