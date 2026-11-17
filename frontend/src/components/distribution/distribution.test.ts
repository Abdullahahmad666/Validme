import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CustomersView } from "@/components/distribution/CustomersView";
import { figure, sparkSegments, trendText, usd } from "@/lib/distribution";
import type { Distribution, KeywordRow } from "@/types/distribution";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(""), useRouter: () => ({ push: () => {} }) }));

const kwRow = (monthly: KeywordRow["monthly"], extra: Partial<KeywordRow> = {}): KeywordRow => ({
  keyword: "restaurant inventory app",
  search_volume: 880,
  cpc: "7.46",
  competition: "MEDIUM",
  difficulty: 23,
  monthly,
  source: "dataforseo",
  fetched_at: "2026-11-17T08:00:00Z",
  stale: false,
  ...extra,
});

describe("distribution helpers", () => {
  it("show provider figures as given and missing ones as unavailable", () => {
    expect(figure(12000)).toBe("12,000");
    expect(figure(null)).toBe("Unavailable");
    expect(figure(0)).toBe("0");
    expect(usd(null)).toBe("Unavailable");
    expect(usd("7.46")).toBe("$7.46");
  });

  it("describe the 12 months from the raw values and break the line on a gap", () => {
    const k = kwRow([
      { year: 2026, month: 8, volume: 700 },
      { year: 2026, month: 9, volume: null },
      { year: 2026, month: 10, volume: 900 },
      { year: 2026, month: 11, volume: 880 },
    ]);
    expect(trendText(k)).toBe("700 in Aug 2026, 880 in Nov 2026 (range 700–900)");
    expect(sparkSegments(k)).toHaveLength(1); // the first point is alone before the gap, so only one drawable segment
    expect(sparkSegments(kwRow([]))).toEqual([]);
  });
});

const data: Distribution = {
  report: { id: 1, created_at: "2026-11-10T08:00:00Z" },
  channels: [
    {
      key: "news.ycombinator.com",
      name: "Hacker News",
      is_hypothesis: false,
      evidence_count: 4,
      threads: 3,
      latest: "2026-11-01",
      categories: { pain_point: 3 },
      relevance: "medium",
      recommendation: "Read them.",
      evidence_ids: [5],
    },
  ],
  first_ten_plan: [{ title: "List 30 people", detail: "Start with the cited threads.", evidence_ids: [5], ai: false }],
  evidence: { "5": { id: 5, title: "t", excerpt: "Counting takes hours", source_url: "https://news.ycombinator.com/item?id=5", provider: "hackernews", published_at: "2026-11-01", category: "pain_point" } },
  youtube: {
    connected: true,
    last_check: { status: "OK", note: "2 channels from 3 searches.", at: "2026-11-17T08:00:00Z" },
    searches: ["restaurant inventory app", "count stock faster", "cafe stock"],
    channels: [
      {
        channel_id: "UC1",
        title: "<img src=x onerror=alert(1)>Kitchen Ops",
        url: "javascript:alert(1)",
        subscriber_count: null,
        subscribers_hidden: true,
        video_count: 140,
        latest_video: { title: "Stock counts in 5 min", url: "https://www.youtube.com/watch?v=v1", published_at: "2026-10-01T10:00:00Z" },
        matched_queries: ["restaurant inventory app"],
        fetched_at: "2026-11-17T08:00:00Z",
        expires_at: "2026-12-17T08:00:00Z",
      },
    ],
  },
  keywords: {
    connected: false,
    last_check: null,
    location: { code: 2826, language: "en", label: "United Kingdom", default: false },
    allowance: { used: 0, limit: 10 },
    rows: [],
  },
};

function render(d: Distribution) {
  const qc = new QueryClient();
  qc.setQueryData(["distribution", "p1"], d);
  qc.setQueryData(["project", "p1"], { id: "p1", name: "Stock app" });
  return renderToStaticMarkup(createElement(QueryClientProvider, { client: qc }, createElement(CustomersView, { projectId: "p1" })));
}

describe("CustomersView", () => {
  it("says why look-ups are off, and shows unavailable rather than hidden when YouTube gave no count", () => {
    const out = render({
      ...data,
      report: null,
      youtube: { ...data.youtube, channels: [{ ...data.youtube.channels[0], subscribers_hidden: false }] },
    });
    expect(out).toContain("Run research on this idea first");
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*aria-describedby="lookup-hint"|aria-describedby="lookup-hint"[^>]*disabled=""/);
    expect(out).not.toContain("Hidden by the channel");
  });

  it("warns when the keyword allowance is used up", () => {
    const out = render({ ...data, keywords: { ...data.keywords, connected: true, allowance: { used: 10, limit: 10 } } });
    expect(out).toContain("keyword look-ups are used up");
    expect(out).toContain('href="/billing"');
  });

  it("credits YouTube, keeps its figures raw and separate, and drops unsafe links", () => {
    const out = render(data);
    expect(out).toContain("Data from YouTube");
    expect(out).toContain('href="https://www.youtube.com/t/terms"');
    expect(out).toContain("Hidden by the channel"); // never 0
    expect(out).toContain(">140<");
    expect(out).toContain("found by 1 of 3 searches");  // M = searches that actually ran
    expect(out).toMatch(/This is our search\s+result, not a YouTube figure\./);
    expect(out).toContain("we don&#x27;t combine them into a score");
    expect(out).toContain("Deleted after");
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("<img src=x");
  });

  it("says keyword data is unavailable when not connected, and shows researched channels with evidence", () => {
    const out = render(data);
    expect(out).toContain("Keyword data isn&#x27;t connected yet, so this is unavailable.");
    expect(out).toContain("Hacker News");
    expect(out).toContain("From your report of");
    expect(out).toContain("nothing is sent for you");
  });
});
