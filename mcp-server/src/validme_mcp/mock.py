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
        # Same shape as the live API's report.distribution.
        "distribution": {
            "channels": [
                {
                    "name": "Founder and operator forums",
                    "is_hypothesis": True,
                    "evidence_count": 0,
                    "recommendation": "Not searched: test before relying on it.",
                    "evidence_ids": [],
                },
            ],
            "threads": [],
            "first_ten_plan": [
                {"title": "List 15 owners from the channels above", "detail": "", "evidence_ids": [], "ai": False},
                {"title": "Interview them about their current workflow", "detail": "", "evidence_ids": [], "ai": False},
                {"title": "Offer a paid pilot", "detail": "", "evidence_ids": [], "ai": False},
            ],
        },
    }


def history(project_id: str) -> dict:
    return {"sample": True, "note": SAMPLE_NOTE, "count": 1, "results": [{"id": 1, "score": 64, "confidence": "low"}]}


def evidence(project_id: str, query: str, category: str) -> dict:
    items = [e for e in _EVIDENCE if (not category or e["category"] == category)]
    if query:
        q = query.lower()
        items = [e for e in items if q in e["excerpt"].lower() or q in e["title"].lower()]
    return {"sample": True, "note": SAMPLE_NOTE, "project_id": project_id, "results": items}


# --- Week 15: monitoring, Radar and the Lab (sample payloads, same shapes as the live API) ---------------------------


def _sample(**payload) -> dict:
    return {"sample": True, "note": SAMPLE_NOTE, **payload}


def watches(project_id: str) -> dict:
    return _sample(
        project_id=project_id,
        results=[
            {"id": 1, "url": "https://example.com/pricing", "label": "Example competitor pricing", "cadence": "weekly", "active": True}
        ],
    )


def changes(project_id: str) -> dict:
    return _sample(
        project_id=project_id,
        results=[
            {
                "id": 1,
                "watch": 1,
                "kind": "pricing",
                "significance": "high",
                "summary": "Plan 'Pro' price changed from $29 to $39.",
                "detected_at": "2026-11-10T08:00:00Z",
            }
        ],
    )


def signals(project_id: str, status: str) -> dict:
    return _sample(
        project_id=project_id,
        results=[
            {
                "id": 1,
                "kind": "complaint_theme",
                "type": "opportunity",
                "title": "Example theme: POS sync",
                "status": "open",
                "confidence": "medium",
                "facts": {"records": 6, "sources": 4},
            }
        ],
    )


def score_history(project_id: str) -> dict:
    return _sample(
        project_id=project_id, results=[{"score": 64, "confidence": "low", "source": "report", "created_at": "2026-11-08T00:00:00Z"}]
    )


def update_signal(project_id: str, signal_id: int, status: str, feedback: str) -> dict:
    return _sample(id=signal_id, status=status, feedback=feedback or None)


def lab_results(project_id: str) -> dict:
    return _sample(
        project_id=project_id,
        pages=[
            {
                "id": 1,
                "title": "Example test page",
                "status": "published",
                "stats": {
                    "views": 40,
                    "signups": 3,
                    "conversion": 0.075,
                    "sample": {"level": "small", "message": "40 views: early hints only."},
                },
            }
        ],
        surveys=[],
    )


def predicted_vs_actual(project_id: str) -> dict:
    return _sample(
        project_id=project_id,
        dimensions=[
            {"key": "demand_evidence", "label": "Demand", "predicted": {"score": 40, "confidence": "medium"}, "actual": None},
            {"key": "willingness_to_pay", "label": "Willingness to pay", "predicted": None, "actual": None},
        ],
        assumptions=[{"id": 1, "text": "Owners count stock on paper", "status": "untested", "auto_status": "", "auto_basis": ""}],
    )


def set_assumption(project_id: str, assumption_id: int, body: dict) -> dict:
    return _sample(id=assumption_id, **body)
