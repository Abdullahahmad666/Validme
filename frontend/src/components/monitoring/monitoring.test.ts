import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChangeCard } from "@/components/monitoring/ChangeCard";
import type { Change } from "@/types/monitoring";

const change: Change = {
  id: 1,
  watch: { id: 2, label: "<img src=x onerror=alert(1)>", url: "https://acme.test/pricing" },
  kind: "pricing",
  significance: "high",
  summary: "Prices changed (new price: $35/mo)",
  ai_summary: "Starter rose to $35/mo.",
  ai_watch_for: "",
  details: { prices_added: ["$35/mo"], prices_removed: ["$29/mo"], blocks_added: ["<script>alert(1)</script>"], blocks_removed: [] },
  detected_at: "2026-11-13T10:00:00Z",
  before_at: "2026-11-06T10:00:00Z",
  after_url: "javascript:alert(1)",
  seen: false,
};

describe("ChangeCard", () => {
  it("renders third-party page content as inert text and drops unsafe links", () => {
    const out = renderToStaticMarkup(createElement(ChangeCard, { c: change }));
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(out).not.toContain("<img src=x");
    expect(out).not.toContain("javascript:");
    expect(out).toContain('href="https://acme.test/pricing"'); // falls back to the watched page
  });
  it("keeps the AI summary separate from the deterministic fact, and labelled", () => {
    const out = renderToStaticMarkup(createElement(ChangeCard, { c: change }));
    expect(out).toContain("Prices changed (new price: $35/mo)");
    expect(out).toContain("AI summary of the diff");
    expect(out).toContain("No longer shown: </span>$29/mo");
  });
});

describe("notification links", () => {
  it("only allow app paths", async () => {
    const { internalLink } = await import("@/components/monitoring/NotificationBell");
    expect(internalLink("/projects/x/monitoring?change=1")).toBe("/projects/x/monitoring?change=1");
    for (const bad of ["//evil.test", String.raw`/\evil.test`, "https://evil.test", "javascript:alert(1)"]) expect(internalLink(bad)).toBeNull();
  });
});
