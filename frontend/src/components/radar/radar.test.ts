import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ScoreTrend } from "@/components/radar/ScoreTrend";
import { SignalCard } from "@/components/radar/SignalCard";
import { basisLine, confidenceReason, level } from "@/lib/radar";
import type { ScoreSnapshot, Signal } from "@/types/radar";

const base: Signal = {
  id: 7,
  kind: "complaint_theme",
  type: "opportunity",
  title: "Recurring complaint: <img src=x onerror=alert(1)>counting",
  facts: {
    records: 6,
    distinct_sources: 5,
    sites: 2,
    theme_named_by: "ai",
    confidence_basis: { sources: 5, sites: 2, platforms: 2, recent_share: 0.83, undated: 0 },
  },
  relevance: 0.8,
  impact: 0.5,
  confidence: "high",
  rank: 0.4,
  ai_rationale: "",
  ai_action: "",
  status: "new",
  feedback: "",
  discovered_at: "2026-11-16T08:00:00Z",
  evidence: [
    { id: 1, title: "t", excerpt: "<script>alert(1)</script> counting takes hours", source_url: "javascript:alert(1)", provider: "hackernews", published_at: "2026-06-01" },
    { id: 2, title: "t", excerpt: "spreadsheets again", source_url: "https://news.ycombinator.com/item?id=2", provider: "hackernews", published_at: null },
  ],
  evidence_count: 6,
  change: null,
  candidate: null,
};

const render = (s: Signal, onUpdate = () => {}) => renderToStaticMarkup(createElement(SignalCard, { s, projectId: "p1", onUpdate }));

describe("radar helpers", () => {
  it("turn rule-based numbers into words and facts into one line", () => {
    expect([level(0.2), level(0.4), level(0.69), level(0.7)]).toEqual(["low", "medium", "medium", "high"]);
    expect(basisLine(base)).toBe("6 records from 5 distinct sources on 2 sites");
    expect(basisLine({ ...base, kind: "discussion_trend", facts: { recent: 8, baseline: 3, recent_window: ["2026-10-17", "2026-11-16"] } })).toBe(
      "8 dated records in the 30 days to 2026-11-16, vs 3 in the 90 days before",
    );
    // a missing fact is said to be missing, never shown as 0
    expect(basisLine({ ...base, facts: {} })).toBe("Counts unavailable");
    expect(basisLine({ ...base, kind: "discussion_trend", facts: { recent: 8 } })).toBe("Counts unavailable");
    expect(basisLine({ ...base, kind: "competitor_change", facts: { competitor: { evil: 1 } } })).toBe("A change we detected on a watched page");
    expect(confidenceReason({ ...base, kind: "competitor_change" })).toMatch(/both versions/);
    expect(confidenceReason(base)).toBe("5 distinct sources on 2 sites from 2 platforms; 83% from the last 6 months.");
    expect(confidenceReason({ ...base, confidence: "medium" })).toMatch(/High needs 2\+ platforms/);
    expect(confidenceReason({ ...base, facts: {} })).toBe("Basis unavailable.");
  });
});

describe("SignalCard", () => {
  it("renders source text as plain text and drops unsafe links", () => {
    const out = render(base);
    expect(out).not.toContain("<script>");
    expect(out).not.toContain("<img src=x");
    expect(out).not.toContain("javascript:");
    expect(out).toContain('href="https://news.ycombinator.com/item?id=2"');
    expect(out).toContain("date not given");
    expect(out).toContain("4 more records behind this signal.");
    expect(out).toContain("rule-based scores");
    expect(out).toContain("written by AI");
  });

  it("labels the AI view and keeps it apart from the facts", () => {
    const out = render({ ...base, ai_rationale: "Owners lose hours each week.", ai_action: "Read three threads." });
    expect(out).toContain("AI view: why it may matter");
    expect(out.indexOf("Based on: 6 records")).toBeLessThan(out.indexOf("AI view"));
    expect(out).toContain("Suggested next step: </span>Read three threads.");
  });

  it("offers act/dismiss only on open signals", () => {
    expect(render(base)).toContain("Mark as acted on");
    const done = render({ ...base, status: "acted", feedback: "useful" });
    expect(done).not.toContain("Mark as acted on");
    expect(done).toContain('aria-pressed="true"');
    expect(done).toContain('aria-label="Was this signal useful?"');
  });
});

describe("ScoreTrend", () => {
  const snap = (id: number, score: number | null, source: ScoreSnapshot["source"] = "revalidation"): ScoreSnapshot => ({
    id,
    created_at: `2026-11-${10 + id}T00:00:00Z`,
    source,
    score,
    confidence: "medium",
    recommendation: "research_more",
    evidence_count: 5,
    report_id: null,
  });

  it("never draws an unscored point as a score", () => {
    const out = renderToStaticMarkup(createElement(ScoreTrend, { snapshots: [snap(3, 61), snap(2, null), snap(1, 55, "report")] }));
    expect(out).toContain("Not scored");
    expect(out).toMatch(/61\/100 on .*, from 55\/100 on .* \(3 points\)/);
    expect(out).toContain("1 point wasn&#x27;t scored and is left as a gap, not drawn as 0.");
    expect(out).not.toContain("0/100");
    expect(out).toContain("Research report");
  });

  it("explains itself until there are two points", () => {
    expect(renderToStaticMarkup(createElement(ScoreTrend, { snapshots: [snap(1, 50)] }))).toContain("appears once there are two points");
  });
});
