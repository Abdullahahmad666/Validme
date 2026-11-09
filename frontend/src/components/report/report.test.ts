import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Audience, Distribution } from "@/components/report/DistributionSections";
import { Competitors, MarketGaps, Overview } from "@/components/report/ReportSections";
import type { Report } from "@/types/report";

const ev = { id: 1, title: "Counting takes hours", excerpt: "We count stock by hand", source_url: "https://a.test/1", provider: "hackernews", published_at: "2026-10-01", category: "pain_point" as const };

const report: Report = {
  id: 7,
  project: { id: "p1", name: "Restaurant stock", status: "COMPLETED", industry: "Food", audiences: [], geographies: ["UK"] },
  created_at: "2026-11-01T00:00:00Z",
  generated_at: "2026-11-01T00:00:00Z",
  depth: "standard",
  coverage: { hackernews: "COMPLETED" },
  overview: {
    score: 41, confidence: "low", recommendation: "research_more", next_step: "Talk to 5 owners.",
    evidence_count: 1, competitor_count: 2, summary: "Early signal.",
    key_findings: [{ text: "Manual counting", detail: "1 record", evidence_ids: [1], ai: false }],
  },
  demand: { by_category: { pain_point: 1 }, by_source: { hackernews: 1 }, date_range: null, buying_intent: [], classified: true },
  pain_points: [],
  competitors: [
    { id: 1, name: "Acme", kind: "listed", website: "https://acme.test", positioning: "", audience: "", features: [], pricing: { status: "verified", plans: [{ name: "Starter", price: "$49", period: "/month" }], retrieved_at: "2026-11-01T00:00:00Z" }, complaint_ids: [], identified_gap: "", evidence_ids: [], ai_extracted: true },
    { id: 2, name: "Other", kind: "mentioned", website: "", positioning: "", audience: "", features: [], pricing: { status: "unavailable", plans: [] }, complaint_ids: [1], identified_gap: "", evidence_ids: [1], ai_extracted: false },
  ],
  opportunity: {
    dimensions: [
      { key: "demand_evidence", label: "Demand evidence", weight: 25, score: 40, available: true, confidence: "low", explanation: "1 record", evidence_ids: [1] },
      { key: "product_feasibility", label: "Product feasibility", weight: 10, score: null, available: false, confidence: "low", explanation: "Needs your input", evidence_ids: [] },
    ],
    scored_weight: 25, assumptions: [{ text: "Customers will pay about $29/month.", source: "founder" }], risks: [],
    market_size: { status: "unavailable", reason: "No sourced market data." }, what_would_change: ["More sources"],
  },
  audience: {
    segments: [
      {
        name: "restaurant owners",
        source: "founder",
        evidence_count: 1,
        evidence_ids: [1],
        signals: { pain_point: 1 },
        needs: [],
        channels: ["Hacker News"],
        accessibility: "Named in 1 record across 1 place we searched.",
      },
    ],
  },
  distribution: {
    channels: [
      { key: "news.ycombinator.com", name: "Hacker News", is_hypothesis: false, evidence_count: 1, threads: 1, latest: "2026-10-01", categories: { pain_point: 1 }, relevance: "low", recommendation: "Read them.", evidence_ids: [1] },
      { key: "hypothesis-0", name: "Your own network", is_hypothesis: true, evidence_count: 0, threads: 0, latest: null, categories: {}, relevance: "", recommendation: "People you know.", evidence_ids: [] },
    ],
    threads: [ev],
    first_ten_plan: [{ title: "List 30 people", detail: "Write the list yourself.", evidence_ids: [1], ai: false }],
  },
  evidence_index: { "1": ev },
  notes: [],
};

const html = (c: (p: { r: Report }) => React.ReactNode) => renderToStaticMarkup(createElement(c, { r: report }));

describe("report sections", () => {
  it("shows score with confidence and cites evidence", () => {
    const out = html(Overview);
    expect(out).toContain("41");
    expect(out).toContain("Low confidence");
    expect(out).toContain("https://a.test/1");
  });
  it("shows only verified prices, others as Unavailable", () => {
    const out = html(Competitors);
    expect(out).toContain("$49");
    expect(out).toContain("Verified on page");
    expect(out).toContain("Unavailable");
  });
  it("marks unscored dimensions and market size unavailable", () => {
    const out = html(MarketGaps);
    expect(out).toContain("Not scored");
    expect(out).toContain("TAM, SAM and SOM: unavailable");
    expect(out).toContain("(yours)");
  });
  it("labels researched vs hypothesis channels; hypotheses carry no evidence count", () => {
    const out = html(Distribution);
    expect(out).toContain("Researched");
    expect(out).toContain("Hypothesis");
    expect(out).toContain("Not searched: no supporting evidence");
    expect(out).toContain("nothing is sent for you");
  });
  it("shows segments, and says when an older report has no audience data", () => {
    expect(html(Audience)).toContain("restaurant owners");
    const old = renderToStaticMarkup(createElement(Audience, { r: { ...report, audience: undefined } }));
    expect(old).toContain("Re-run the research");
  });
});
