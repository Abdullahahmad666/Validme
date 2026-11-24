import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { demoVideoEntity, ProductDemoSection } from "@/components/marketing/ProductDemoSection";
import { DEMO_VIDEO } from "@/content/marketing";

describe("ProductDemoSection", () => {
  it("shows the demo video, muted with controls, with poster, a screen-reader note and text alternative, no visible credit", () => {
    const out = renderToStaticMarkup(createElement(ProductDemoSection));
    expect(out).toContain('<source src="/demo/validme-demo.mp4" type="video/mp4"/>');
    expect(out).toContain('poster="/demo/validme-demo-poster.jpg"');
    // No autoplay attribute: playback starts from script only when in view (and never with reduced motion), muted.
    expect(out).not.toContain("autoplay");
    expect(out).toMatch(/<video[^>]*muted=""/);
    expect(out).toMatch(/<video[^>]*controls=""/);
    expect(out).toContain("Example project with illustrative data");
    expect(out).toContain("Music only, no narration");
    // The credit lives at the end of the video, not under it.
    expect(out).not.toContain("Music: “");
    expect(out).toContain('class="sr-only"');
    expect(out).toContain("A score, and how sure it is"); // on-screen captions are quoted in the text alternative
    expect(out).toContain('aria-describedby="demo-note"');
    expect(out.match(/<li>/g)?.length).toBe(DEMO_VIDEO.shows.length);
  });

  it("falls back to the code-drawn walkthrough when no video is set", () => {
    const out = renderToStaticMarkup(createElement(ProductDemoSection, { video: { ...DEMO_VIDEO, src: null } }));
    expect(out).not.toContain("<video");
    expect(out).toContain("Sample data · illustration");
    expect(out).not.toContain('id="demo-note"');
  });

  it("describes the video in structured data with facts from the same config", () => {
    const e = demoVideoEntity("https://example.test");
    expect(e).toMatchObject({
      "@type": "VideoObject",
      contentUrl: "https://example.test/demo/validme-demo.mp4",
      thumbnailUrl: "https://example.test/demo/validme-demo-poster.jpg",
      duration: "PT45S",
      uploadDate: "2026-11-20T12:00:00+00:00",
    });
    // Illustrative figures never lead the structured description: it opens with the example-data disclaimer.
    expect(String(e?.description)).toMatch(/^A 45-second walkthrough of .+ using an example project with illustrative data/);
    expect(String(e?.description)).not.toContain("81");
    expect(demoVideoEntity("https://example.test", { ...DEMO_VIDEO, src: null })).toBeNull();
  });
});
