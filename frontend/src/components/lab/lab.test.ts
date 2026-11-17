import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BlockFields } from "@/components/lab/BlockFields";
import { PagePreview, consentText } from "@/components/lab/PagePreview";
import { emptyBlock, hasLink, moveItem, slugify, starterBlocks } from "@/lib/lab";
import type { Block, BlockType } from "@/types/lab";

describe("lab helpers", () => {
  it("make addresses the server accepts", () => {
    expect(slugify("  Stock Counter: Café Edition!! ")).toBe("stock-counter-cafe-edition");
    expect(slugify("--a--b--")).toBe("a-b");
    expect(slugify("x".repeat(80))).toHaveLength(48);
  });

  it("flag links the same way the server refuses them", () => {
    for (const t of ["https://evil.test", "www.evil.test", "go to evil.com now", "me@evil.test"]) expect(hasLink(t), t).toBe(true);
    for (const t of ["Count stock in 5 minutes", "Save hours each week", "$19/month", "e.g. a café"]) expect(hasLink(t), t).toBe(false);
  });

  it("start pages with a hero and a waitlist, and move items safely", () => {
    expect(starterBlocks("Stock app").map((b) => b.type)).toEqual(["hero", "waitlist"]);
    expect(moveItem([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    const types: BlockType[] = ["hero", "problem", "benefits", "pricing", "faq", "waitlist"];
    for (const t of types) expect(emptyBlock(t).type).toBe(t);
  });
});

describe("PagePreview", () => {
  const blocks: Block[] = [
    { type: "hero", headline: "<img src=x onerror=alert(1)>Count stock" },
    { type: "pricing", items: [{ name: "Starter", price: "$19", period: "/month", features: ["One"] }] },
    { type: "waitlist" },
  ];

  // Copied from backend/lab/public.py CONSENT_TEMPLATE (lab-consent-v2) as LabPageSerializer.consent_template sends it:
  // brand filled in, {days} left for the preview.
  const serverTemplate =
    "I'd like to hear about this product. The person behind this page can see and download my email to tell me about it. " +
    "ValidMe stores it encrypted, never sells it, and deletes its copy after {days} days or sooner if I ask.";

  it("escapes founder text and always shows the honest pricing note and the server's consent text", () => {
    const out = renderToStaticMarkup(createElement(PagePreview, { blocks, retentionDays: 90, consentTemplate: serverTemplate }));
    expect(out).not.toContain("<img src=x");
    expect(out).toContain("Not available yet: these are prices being tested, and nothing is charged.");
    // The preview renders whatever the server sends, with the draft's retention period filled in.
    expect(out).toContain(
      "I&#x27;d like to hear about this product. The person behind this page can see and download my email to tell me about it. ValidMe stores it encrypted, never sells it, and deletes its copy after 90 days or sooner if I ask.",
    );
    expect(out).not.toContain("{days}");
    expect(out).toContain("product may not exist yet");
  });

  it("uses the server's template verbatim rather than its own copy", () => {
    const out = renderToStaticMarkup(createElement(PagePreview, { blocks, retentionDays: 30, consentTemplate: "Server says {days} days." }));
    expect(out).toContain("Server says 30 days.");
    expect(out).not.toContain("I&#x27;d like to hear");
  });

  it("falls back to the current live wording when no template is sent", () => {
    expect(consentText(undefined, 60)).toBe(serverTemplate.replace("{days}", "60"));
    expect(consentText("", 60)).toBe(serverTemplate.replace("{days}", "60"));
  });
});

describe("BlockFields", () => {
  it("warns about links before the server refuses them", () => {
    const out = renderToStaticMarkup(createElement(BlockFields, { block: { type: "hero", headline: "Buy at evil.com" }, onChange: () => {} }));
    expect(out).toContain("Links and web or email addresses aren&#x27;t allowed on pages.");
    expect(out).toContain('aria-invalid="true"');
  });
});
