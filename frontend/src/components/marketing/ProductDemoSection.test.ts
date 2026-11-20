import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { demoVideoEntity, ProductDemoSection } from "@/components/marketing/ProductDemoSection";
import { DEMO_VIDEO } from "@/content/marketing";

describe("ProductDemoSection", () => {
  it("shows the demo video without autoplay, with poster, example-data note, music credit and a text alternative", () => {
    const out = renderToStaticMarkup(createElement(ProductDemoSection));
    expect(out).toContain('<source src="/demo/validme-demo.mp4" type="video/mp4"/>');
    expect(out).toContain('poster="/demo/validme-demo-poster.jpg"');
    expect(out).toContain('preload="none"');
    expect(out).not.toContain("autoplay");
    expect(out).toContain("example project with illustrative data");
    expect(out).toContain("Sascha Ende, ende.app (CC BY 4.0)");
    expect(out).toContain("What the video shows");
    expect(out).toContain('aria-describedby="demo-shows"');
    expect(out.match(/<li>/g)?.length).toBe(DEMO_VIDEO.shows.length);
  });

  it("falls back to the code-drawn walkthrough when no video is set", () => {
    const out = renderToStaticMarkup(createElement(ProductDemoSection, { video: { ...DEMO_VIDEO, src: null } }));
    expect(out).not.toContain("<video");
    expect(out).toContain("Sample data · illustration");
    expect(out).not.toContain("What the video shows");
  });

  it("describes the video in structured data with facts from the same config", () => {
    const e = demoVideoEntity("https://example.test");
    expect(e).toMatchObject({
      "@type": "VideoObject",
      contentUrl: "https://example.test/demo/validme-demo.mp4",
      thumbnailUrl: "https://example.test/demo/validme-demo-poster.jpg",
      duration: "PT45S",
      uploadDate: "2026-11-20",
    });
    expect(demoVideoEntity("https://example.test", { ...DEMO_VIDEO, src: null })).toBeNull();
  });
});
