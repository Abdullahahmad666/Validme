import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Walkthrough } from "@/components/marketing/Walkthrough";

describe("Walkthrough", () => {
  it("is labelled as sample data, starts still on the server and has accessible controls", () => {
    const out = renderToStaticMarkup(createElement(Walkthrough));
    expect(out).toContain("Sample data · illustration");
    expect(out).toContain('aria-label="Play walkthrough"'); // not auto-playing until the client knows motion is welcome
    expect(out).toContain('aria-label="Step 5: Test with real people"');
    expect(out).toContain('aria-current="step"');
  });
});
