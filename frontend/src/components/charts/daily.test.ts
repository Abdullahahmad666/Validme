import { describe, expect, it } from "vitest";
import { fillDays, fmtDay, summarize } from "@/components/charts/daily";

describe("daily chart helpers", () => {
  it("fill every day in the window with zeros where nothing was counted (no interpolation)", () => {
    const rows = fillDays([{ day: "2026-11-02", views: 5, signups: 1 }], "2026-11-01", "2026-11-03", ["views", "signups"]);
    expect(rows).toEqual([
      { day: "2026-11-01", views: 0, signups: 0 },
      { day: "2026-11-02", views: 5, signups: 1 },
      { day: "2026-11-03", views: 0, signups: 0 },
    ]);
  });

  it("summarize totals and the busiest day in words", () => {
    const rows = fillDays([{ day: "2026-11-02", views: 9, signups: 2 }, { day: "2026-11-03", views: 4, signups: 0 }], "2026-11-01", "2026-11-03", ["views", "signups"]);
    const series = [
      { key: "views", label: "Views" },
      { key: "signups", label: "Sign-ups" },
    ];
    expect(summarize(rows, series)).toBe("Nov 1–Nov 3: 13 views, 2 sign-ups. Busiest day Nov 2 (9 views).");
    expect(summarize(fillDays([], "2026-11-01", "2026-11-02", ["views"]), series.slice(0, 1))).toBe("Nov 1–Nov 2: 0 views.");
    expect(fmtDay("2026-01-31")).toBe("Jan 31");
  });
});

describe("summaries of stacked series", () => {
  it("rank by the total, not the first series", () => {
    const rows = fillDays(
      [
        { day: "2026-11-02", low: 5, high: 0 },
        { day: "2026-11-09", low: 1, high: 9 },
      ],
      "2026-11-02",
      "2026-11-09",
      ["low", "high"],
    ).filter((r) => r.day === "2026-11-02" || r.day === "2026-11-09");
    const series = [
      { key: "low", label: "Low" },
      { key: "high", label: "High" },
    ];
    expect(summarize(rows, series, "week", true)).toContain("Busiest week (starting) Nov 9 (10 in all)");
  });
});
