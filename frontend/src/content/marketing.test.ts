import { describe, expect, it } from "vitest";
import { CREDIT_EXPLAINER, FAQS, FOOTER_COLUMNS, PLANS, SOURCES } from "@/content/marketing";

// Guards for CLAUDE.md rules: no fabricated prices or platform coverage on the marketing site.
describe("marketing content honesty", () => {
  it("never lists disallowed platforms as supported", () => {
    const supported = SOURCES.filter((s) => s.status !== "unavailable").map((s) => s.name.toLowerCase());
    for (const banned of ["reddit", "g2", "capterra", "trustpilot", "x,", "instagram", "tiktok"]) {
      expect(supported.some((n) => n.includes(banned))).toBe(false);
    }
    const unavailable = SOURCES.filter((s) => s.status === "unavailable").map((s) => s.name);
    expect(unavailable.join(" ")).toMatch(/Reddit/);
  });

  it("only shows a price for the free plan until real prices exist", () => {
    for (const plan of PLANS) {
      if (plan.id === "free") expect(plan.price).toBe("$0");
      else expect(plan.price).toBeNull();
    }
    expect(PLANS.filter((p) => p.recommended).map((p) => p.id)).toEqual(["pro"]);
    expect(JSON.stringify(PLANS).toLowerCase()).not.toContain("unlimited");
  });

  it("credit costs match backend CREDITS_PER_DEPTH (quick 1, standard 2, deep 4)", () => {
    expect(Object.fromEntries(CREDIT_EXPLAINER.map((c) => [c.depth, c.credits]))).toEqual({ Quick: 1, Standard: 2, Deep: 4 });
  });

  it("answers the Reddit/X FAQ with an explicit no", () => {
    const faq = FAQS.find((f) => /Reddit/.test(f.q));
    expect(faq?.a.startsWith("No.")).toBe(true);
  });

  it("footer links point at internal routes", () => {
    for (const col of FOOTER_COLUMNS) for (const l of col.links) expect(l.href.startsWith("/")).toBe(true);
  });
});
