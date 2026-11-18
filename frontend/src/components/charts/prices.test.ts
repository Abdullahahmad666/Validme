import { describe, expect, it } from "vitest";
import { priceLadder } from "@/components/charts/prices";
import type { ReportCompetitor } from "@/types/report";

const comp = (name: string, status: "verified" | "unavailable", plans: { name: string; price: string; period: string }[]) =>
  ({ name, pricing: { status, plans, retrieved_at: "2026-11-01T00:00:00Z" } }) as unknown as ReportCompetitor;

describe("priceLadder", () => {
  it("keeps only verified monthly prices in the main currency, cheapest first, and counts the rest", () => {
    const out = priceLadder([
      comp("A", "verified", [
        { name: "Pro", price: "$29", period: "/month" },
        { name: "Starter", price: "$9.50", period: "per month" },
        { name: "Free", price: "Free", period: "" },
        { name: "Yearly", price: "$290", period: "/year" },
      ]),
      comp("B", "verified", [{ name: "Team", price: "€19", period: "/mo" }]),
      comp("C", "unavailable", [{ name: "X", price: "$5", period: "/month" }]),
    ]);
    expect(out.currency).toBe("$");
    expect(out.points.map((p) => [p.label, p.value])).toEqual([
      ["A · Starter", 9.5],
      ["A · Pro", 29],
    ]);
    expect(out.excluded).toBe(3); // free, yearly, other currency (C isn't verified, so not counted at all)
    expect(out.points[0].note).toContain("read 2026-11-01");
  });

  it("returns nothing to draw without verified monthly prices", () => {
    expect(priceLadder([comp("A", "verified", [{ name: "Free", price: "Free", period: "" }])])).toEqual({ currency: null, points: [], excluded: 1 });
  });
});
