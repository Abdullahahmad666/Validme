import { describe, expect, it } from "vitest";
import { DEFAULT_INPUTS, parsePrice, simulate } from "@/lib/unitEconomics";

describe("unit economics", () => {
  const base = { ...DEFAULT_INPUTS, price: 50, margin_pct: 80, churn_pct: 5, cac: 200, fixed_costs: 4000, new_customers: 20 };

  it("computes contribution, LTV, payback and break-even from the inputs", () => {
    const r = simulate(base);
    expect(r.contribution).toBe(40);
    expect(r.ltv).toBe(800); // 40 / 5%
    expect(r.ltvToCac).toBe(4);
    expect(r.paybackMonths).toBe(5);
    expect(r.breakEvenCustomers).toBe(100);
    expect(r.steadyStateCustomers).toBe(400);
  });

  it("projects customers month by month with churn", () => {
    const r = simulate(base, "realistic", 2);
    expect(r.months[0].customers).toBe(20);
    expect(r.months[1].customers).toBeCloseTo(20 * 0.95 + 20);
  });

  it("scenarios move inputs by their percentages and never go negative", () => {
    const p = simulate({ ...base, pessimistic: { price: -200, cac: 30, churn: 50, growth: -100 } }, "pessimistic");
    expect(p.price).toBe(0);
    expect(p.cac).toBe(260);
    expect(p.churnPct).toBe(7.5);
    expect(p.newCustomers).toBe(0);
    expect(p.paybackMonths).toBeNull(); // no contribution → no payback
    expect(simulate(base, "optimistic").ltv).toBeGreaterThan(simulate(base).ltv!);
  });

  it("parses a price out of the founder's free-text hypothesis", () => {
    expect(parsePrice("$29/month")).toBe(29);
    expect(parsePrice("1,200 USD a year")).toBe(1200);
    expect(parsePrice("free")).toBeNull();
  });
});
