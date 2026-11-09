"""Markdown export of a report snapshot. Same content as the web report: every finding keeps its sources,
AI-written text is labelled, and missing data says "unavailable"."""

from __future__ import annotations

from django.conf import settings

REC = {
    "build": "Promising: validate with customers",
    "research_more": "Research more before deciding",
    "pivot": "Weak signal: consider a different angle",
}


def _md(text: str) -> str:
    """Escape characters that would turn source text into Markdown structure."""
    return (text or "").replace("\\", "\\\\").replace("[", "\\[").replace("]", "\\]").replace("\n", " ").strip()


def _url(url: str) -> str:
    """Only http(s) links survive; characters that would end the Markdown link are percent-encoded."""
    if not url.lower().startswith(("http://", "https://")):
        return ""
    return url.replace(" ", "%20").replace("(", "%28").replace(")", "%29").replace("<", "%3C").replace(">", "%3E")


def _src(card: dict) -> str:
    date = (card.get("published_at") or "")[:10] or "date unavailable"
    title = _md(card.get("title") or card["source_url"])
    url = _url(card["source_url"])
    return f"{f'[{title}]({url})' if url else title} ({card.get('provider')}, {date})"


def _cites(ids: list[int], index: dict, k: int = 3) -> list[str]:
    cards = [index[str(i)] for i in ids if str(i) in index][:k]
    return [f"  - {_src(c)}" for c in cards]


def to_markdown(r: dict) -> str:
    idx = r.get("evidence_index", {})
    o = r["overview"]
    p = r["project"]
    brand = getattr(settings, "VALIDME_BRAND", "ValidMe")
    out = [
        f"# {_md(p['name'])}: opportunity report",
        "",
        f"Generated {(r.get('generated_at') or r['created_at'])[:10]} by {brand} · {r.get('depth', '')} depth · report #{r['id']}",
        "",
        "## Overview",
        "",
        f"- **Score:** {o['score'] if o['score'] is not None else 'not enough evidence to score'}"
        + (f"/100 ({r['opportunity']['scored_weight']}% of the model scored)" if o["score"] is not None else ""),
        f"- **Confidence:** {o['confidence']}",
        f"- **Recommendation:** {REC.get(o['recommendation'], o['recommendation'])}",
        f"- **Next step:** {o['next_step']}",
        f"- {o['summary']}",
        "",
        "### Key findings",
        "",
    ]
    if not o["key_findings"]:
        out.append("None: no classified evidence supports a finding.")
    for f in o["key_findings"]:
        out.append(f"- **{_md(f['text'])}**{' (AI theme)' if f.get('ai') else ''}: {_md(f['detail'])}")
        out += _cites(f["evidence_ids"], idx, 2)

    out += ["", "## Coverage", ""]
    out += [f"- {k}: {v}" for k, v in r.get("coverage", {}).items()] or ["- none"]

    out += ["", "## Pain points", ""]
    if not r["pain_points"]:
        out.append("No themes: themes need classified evidence with at least two related records.")
    for t in r["pain_points"]:
        authors = t["distinct_authors"] if t["distinct_authors"] is not None else "unavailable"
        out += [
            f"### {_md(t['name'])}",
            "",
            f"{t['records']} records, {t['distinct_sources']} sources, {authors} authors, {t['confidence'] or 'unrated'} confidence.",
            "",
            f"AI summary: {_md(t['ai_summary'])}",
            "",
        ]
        out += [f"- {_src(c)}" for c in t["samples"]]
        out.append("")

    out += ["", "## Competitors", ""]
    if not r["competitors"]:
        out.append("None found in the searched sources or listed.")
    else:
        out += ["| Competitor | Pricing | Identified gap |", "|---|---|---|"]
        for c in r["competitors"]:
            if c["pricing"].get("status") == "verified":
                plans = "; ".join(f"{pl.get('name', '')} {pl['price']} {pl.get('period', '')}".strip() for pl in c["pricing"]["plans"])
                price = f"{plans} (verified on page {(c['pricing'].get('retrieved_at') or '')[:10]})"
            else:
                price = "Unavailable"
            gap = f"{_md(c['identified_gap'])} (AI summary)" if c["identified_gap"] else "None found"
            out.append(f"| {_md(c['name'])} | {_md(price)} | {gap} |")

    opp = r["opportunity"]
    out += ["", "## Market gaps and score breakdown", ""]
    for d in opp["dimensions"]:
        val = f"{d['score']}/100, {d['confidence']} confidence" if d["available"] else "not scored"
        out.append(f"- **{d['label']}** ({d['weight']}%): {val}. {d['explanation']}")
    out += ["", "**What would change the score:**", ""] + [f"- {w}" for w in opp["what_would_change"]]
    out += ["", f"**Market size:** TAM, SAM and SOM unavailable. {opp['market_size'].get('reason', '')}", ""]
    if opp["assumptions"]:
        out += ["**Assumptions to test:**", ""]
        out += [f"- {_md(a['text'])} ({'yours' if a['source'] == 'founder' else 'AI suggested'})" for a in opp["assumptions"]]
        out.append("")
    if opp["risks"]:
        out += ["**Risks:**", ""] + [f"- {x}" for x in opp["risks"]] + [""]

    aud = r.get("audience", {}).get("segments", [])
    out += ["## Audience", ""]
    if not aud:
        out.append("No audience segments were set for this project.")
    for s in aud:
        out.append(f"- **{_md(s['name'])}** ({'AI suggested' if s['source'] == 'ai' else 'yours'}): {s['accessibility']}")
        for n in s["needs"]:
            out.append(f"  - Need (AI theme): {_md(n['text'])} ({len(n['evidence_ids'])} records)")

    dist = r.get("distribution", {})
    out += ["", "## Distribution", ""]
    for c in dist.get("channels", []):
        tag = (
            "Hypothesis (not searched)" if c["is_hypothesis"] else f"Researched: {c['evidence_count']} records, {c['threads']} threads"
        )
        out.append(f"- **{_md(c['name'])}** [{tag}]: {c['recommendation']}")
    if dist.get("threads"):
        out += ["", "### Where to find your first 100 potential customers", ""]
        out += [f"- {_src(c)}" for c in dist["threads"]]
    if dist.get("first_ten_plan"):
        out += ["", "### First 10 customers plan", ""]
        for i, step in enumerate(dist["first_ten_plan"], 1):
            out.append(f"{i}. **{step['title']}** {step['detail']}")
    if r.get("notes"):
        out += ["", "## Notes from this run", ""] + [f"- {n}" for n in r["notes"]]
    out += ["", "---", f"Every finding links to its source. AI-written text is labelled. Exported from {brand}.", ""]
    return "\n".join(out)
