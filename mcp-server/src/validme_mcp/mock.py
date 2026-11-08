"""Sample data for VALIDME_MOCK=1. Every payload is flagged sample=True so it can't be mistaken for research."""

from __future__ import annotations

SAMPLE_NOTE = "SAMPLE DATA (VALIDME_MOCK=1) — not real research."

_EVIDENCE = [
    {
        "id": "ev_1",
        "category": "pricing_objection",
        "title": "Example discussion about inventory tools",
        "source_url": "https://example.com/thread/1",
        "provider": "hackernews",
        "published_at": "2026-10-20",
        "retrieved_at": "2026-11-08",
        "excerpt": "Existing tools are too expensive for a single small restaurant.",
    },
    {
        "id": "ev_2",
        "category": "feature_request",
        "title": "Example Q&A about POS sync",
        "source_url": "https://example.com/question/2",
        "provider": "stackexchange",
        "published_at": "2026-10-18",
        "retrieved_at": "2026-11-08",
        "excerpt": "I want stock levels to sync with the POS automatically.",
    },
]


def start_research(idea: str, audience: str, geography: str, depth: str) -> dict:
    return {
        "sample": True,
        "note": SAMPLE_NOTE,
        "job_id": "job_sample",
        "project_id": "prj_sample",
        "status": "PENDING",
        "depth": depth,
        "estimated_credits": {"quick": 1, "standard": 2, "deep": 4}.get(depth, 2),
        "echo": {"idea": idea, "audience": audience, "geography": geography},
    }


def job_status(job_id: str) -> dict:
    return {
        "sample": True,
        "note": SAMPLE_NOTE,
        "job_id": job_id,
        "project_id": "prj_sample",
        "status": "COMPLETED",
        "stages": [
            {"name": "idea_analysis", "status": "COMPLETED"},
            {"name": "web_research", "status": "COMPLETED"},
            {"name": "community_research", "status": "COMPLETED"},
            {"name": "evidence_analysis", "status": "COMPLETED"},
            {"name": "report", "status": "COMPLETED"},
        ],
        "coverage": {"web_search": "COMPLETED", "hackernews": "COMPLETED", "reddit": "UNAVAILABLE"},
    }


def report(project_id: str) -> dict:
    return {
        "sample": True,
        "note": SAMPLE_NOTE,
        "project_id": project_id,
        "opportunity": {"score": 64, "confidence": "low", "recommendation": "research_more"},
        "pain_points": [
            {"name": "Price too high for single venues", "distinct_sources": 1, "evidence_ids": ["ev_1"]},
            {"name": "No POS sync", "distinct_sources": 1, "evidence_ids": ["ev_2"]},
        ],
        "competitors": [],
        "channels": [
            {"channel": "Founder and operator forums", "is_hypothesis": True, "evidence_ids": []},
        ],
        "first_ten_plan": [
            "List 15 owners from the channels above",
            "Interview them about their current workflow",
            "Offer a paid pilot",
        ],
    }


def evidence(project_id: str, query: str, category: str) -> dict:
    items = [e for e in _EVIDENCE if (not category or e["category"] == category)]
    if query:
        q = query.lower()
        items = [e for e in items if q in e["excerpt"].lower() or q in e["title"].lower()]
    return {"sample": True, "note": SAMPLE_NOTE, "project_id": project_id, "results": items}
