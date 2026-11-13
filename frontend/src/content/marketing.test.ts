import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CREDIT_EXPLAINER, FOOTER_COLUMNS, PLANS, SOURCES } from "@/content/marketing";
import { PLAN_PRICES } from "@/content/pricing";

const SRC = path.resolve(__dirname, "..");

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? filesUnder(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

// Platforms we don't search must not appear anywhere on the public site, even as "not included".
const EXCLUDED = /\b(reddit|instagram|tiktok|trustpilot|capterra|twitter)\b|\bG2\b|\bX, |\bX \(|\bX\/Twitter\b/i;

describe("marketing content honesty", () => {
  it("never names platforms we don't search", () => {
    const files = [
      ...filesUnder(path.join(SRC, "components", "marketing")),
      ...filesUnder(path.join(SRC, "app", "(marketing)")),
      ...filesUnder(path.join(SRC, "app", "(auth)")),
      ...filesUnder(path.join(SRC, "components", "auth")),
      path.join(SRC, "content", "marketing.ts"),
    ];
    const hits = files.filter((f) => EXCLUDED.test(readFileSync(f, "utf8"))).map((f) => path.relative(SRC, f));
    expect(hits).toEqual([]);
  });

  it("lists only supported or rolling-out sources", () => {
    for (const s of SOURCES) expect(["supported", "limited"]).toContain(s.status);
  });

  it("plan prices come from the pricing catalog and nothing is unlimited", () => {
    expect(PLANS.map((p) => [p.id, p.price])).toEqual([
      ["free", "$0"],
      ["founder", `$${PLAN_PRICES.founder.month}`],
      ["pro", `$${PLAN_PRICES.pro.month}`],
    ]);
    expect(PLANS.filter((p) => p.recommended).map((p) => p.id)).toEqual(["founder"]);
    expect(PLANS[1].priceNote).toContain("$190/year (2 months free)");
    expect(JSON.stringify(PLANS).toLowerCase()).not.toContain("unlimited");
  });

  it("credit costs match backend CREDITS_PER_DEPTH (quick 1, standard 2, deep 4)", () => {
    expect(Object.fromEntries(CREDIT_EXPLAINER.map((c) => [c.depth, c.credits]))).toEqual({ Quick: 1, Standard: 2, Deep: 4 });
  });

  it("footer links point at internal routes", () => {
    for (const col of FOOTER_COLUMNS) for (const l of col.links) expect(l.href.startsWith("/")).toBe(true);
  });
});
