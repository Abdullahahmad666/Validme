import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { planLabel, planPrice, subscriptionLine } from "@/components/billing/BillingView";
import { Candidates } from "@/components/monitoring/MonitoringView";
import { PACK_PRICES, PLAN_PRICES, yearlySavingMonths } from "@/content/pricing";
import type { SubscriptionInfo } from "@/types/api";
import type { CompetitorCandidate } from "@/types/monitoring";

const nav = vi.hoisted(() => ({ query: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(nav.query) }));

describe("pricing catalog", () => {
  it("matches the decided prices (keep in step with the Lemon Squeezy variants)", () => {
    expect([PLAN_PRICES.founder.month, PLAN_PRICES.founder.year, PLAN_PRICES.pro.month, PLAN_PRICES.pro.year]).toEqual([19, 190, 39, 390]);
    expect(PACK_PRICES.map((p) => [p.id, p.credits, p.price])).toEqual([
      ["starter", 6, 19],
      ["builder", 20, 49],
    ]);
    expect(yearlySavingMonths(PLAN_PRICES.founder)).toBe(2);
    expect(yearlySavingMonths(PLAN_PRICES.free)).toBe(0);
  });
});

describe("billing helpers", () => {
  it("labels every plan", () => {
    expect(["free", "paid", "founder", "pro"].map((p) => planLabel(p as never))).toEqual(["Free", "Credit packs", "Founder", "Pro"]);
    expect(planLabel(undefined)).toBe("—");
  });

  it("prefers the provider's own price label over the catalog", () => {
    expect(planPrice("founder", "month")).toBe("$19/month");
    expect(planPrice("pro", "year")).toBe("$390/year");
    expect(planPrice("founder", "month", { id: "founder", monthly_credits: 4, month: "19.00 USD", year: null })).toBe("19.00 USD/month");
  });

  it("describes where a subscription stands", () => {
    const base: SubscriptionInfo = { plan: "founder", interval: "month", status: "active", renews_at: "2026-12-14T00:00:00Z", ends_at: null };
    expect(subscriptionLine(base)).toMatch(/^Billed monthly\. Renews on /);
    expect(subscriptionLine({ ...base, status: "cancelled", ends_at: "2026-12-14T00:00:00Z" })).toMatch(/stays active until/);
    expect(subscriptionLine({ ...base, status: "past_due" })).toMatch(/didn't go through/);
  });
});

function withData(key: unknown[], data: unknown, el: ReturnType<typeof createElement>) {
  const qc = new QueryClient();
  qc.setQueryData(key, data);
  return renderToStaticMarkup(createElement(QueryClientProvider, { client: qc }, el));
}

describe("competitor candidates", () => {
  const c: CompetitorCandidate = {
    id: 1,
    domain: "stockly.test",
    name: "<img src=x onerror=alert(1)>Stockly",
    url: "https://stockly.test/",
    source_url: "javascript:alert(1)",
    source: "hackernews",
    found_at: "2026-11-10T00:00:00Z",
    status: "new",
  };

  it("renders launch titles as text and drops unsafe links", () => {
    const out = withData(["candidates", "p1"], [c], createElement(Candidates, { projectId: "p1", full: false }));
    expect(out).toContain('id="candidates"');
    expect(out).not.toContain("<img src=x");
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("<a "); // an unsafe launch link is left out, not rendered as "#"
  });

  it("stays out of the way when nothing was found, and can't watch past the plan limit", () => {
    expect(withData(["candidates", "p1"], [], createElement(Candidates, { projectId: "p1", full: false }))).toBe("");
    const out = withData(["candidates", "p1"], [{ ...c, source_url: "https://news.ycombinator.com/item?id=1" }], createElement(Candidates, { projectId: "p1", full: true }));
    expect(out).toContain('href="https://news.ycombinator.com/item?id=1"');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
    expect(out).toContain("page limit");
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*>Watch<\/button>/);
  });
});

describe("unsubscribe confirmation", () => {
  async function render(query: string) {
    nav.query = query;
    const { UnsubscribedMessage } = await import("@/components/settings/UnsubscribedMessage");
    return renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(UnsubscribedMessage)));
  }

  it("asks before unsubscribing (opening the link changes nothing)", async () => {
    const out = await render("token=abc");
    expect(out).toContain("Stop the weekly digest?");
    expect(out).toMatch(/<button[^>]*>Unsubscribe<\/button>/);
    expect(out).toContain('href="/settings#email"');
  });

  it("explains a bad link", async () => {
    for (const q of ["error=1", ""]) {
      const out = await render(q);
      expect(out).toContain("That link didn&#x27;t work");
      expect(out).not.toContain(">Unsubscribe</button>");
    }
  });
});
