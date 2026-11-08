import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { PAGE_KEYS, PAGES } from "@/content/seo";
import { BRAND_NAME } from "@/lib/brand";
import { buildLlmsFullTxt, buildLlmsTxt } from "@/lib/llms";
import { pageMetadata } from "@/lib/seo";

const APP = path.resolve(__dirname, "..", "app");

function pageFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name.startsWith("[") ? [] : pageFiles(full);
    return name === "page.tsx" ? [full] : [];
  });
}

/** Public pages that must be in the registry: all marketing pages + login/signup. */
const PUBLIC_PAGES = [...pageFiles(path.join(APP, "(marketing)")), path.join(APP, "(auth)", "login", "page.tsx"), path.join(APP, "(auth)", "signup", "page.tsx")];

function routeOf(file: string): string {
  const rel = path.relative(APP, path.dirname(file)).split(path.sep).filter((s) => !s.startsWith("("));
  return "/" + rel.join("/");
}

describe("SEO registry covers every public page (rule: CLAUDE.md › SEO for every page)", () => {
  it.each(PUBLIC_PAGES.map((f) => [routeOf(f), f]))("%s uses pageMetadata + PageJsonLd with its registry key", (route, file) => {
    const src = readFileSync(file, "utf8");
    const key = PAGE_KEYS.find((k) => PAGES[k].path === route);
    expect(key, `add ${route} to src/content/seo.ts`).toBeDefined();
    expect(src).toContain(`pageMetadata("${key}")`);
    expect(src).toMatch(new RegExp(`<PageJsonLd[^>]*page="${key}"`));
  });

  it("every registry entry points at a real page", () => {
    for (const key of PAGE_KEYS) {
      const route = PAGES[key].path;
      const candidates = ["(marketing)", "(auth)"].map((g) => path.join(APP, g, ...route.split("/").filter(Boolean), "page.tsx"));
      expect(candidates.some(existsSync), `${key} → ${route} has no page.tsx`).toBe(true);
    }
  });
});

describe("SEO quality limits", () => {
  const titles = PAGE_KEYS.map((k) => {
    const p = PAGES[k];
    return "absoluteTitle" in p && p.absoluteTitle ? p.title : `${p.title} · ${BRAND_NAME}`;
  });

  it("titles fit search results (≤ 65 chars) and are unique", () => {
    for (const t of titles) expect(t.length, t).toBeLessThanOrEqual(65);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("descriptions are 70–160 chars and unique", () => {
    const descs = PAGE_KEYS.map((k) => PAGES[k].description);
    for (const d of descs) {
      expect(d.length, d).toBeGreaterThanOrEqual(70);
      expect(d.length, d).toBeLessThanOrEqual(160);
    }
    expect(new Set(descs).size).toBe(descs.length);
  });

  it("social headlines fit the image (≤ 70 chars)", () => {
    for (const k of PAGE_KEYS) expect(PAGES[k].og.headline.length, k).toBeLessThanOrEqual(70);
  });

  it("metadata has canonical, Open Graph and X images at the right sizes", () => {
    for (const k of PAGE_KEYS) {
      const m = pageMetadata(k);
      expect(m.alternates?.canonical).toBe(PAGES[k].path);
      const og = (m.openGraph?.images as { url: string; width: number; height: number }[])[0];
      expect(og).toMatchObject({ url: `/og/${k}/og.png`, width: 1200, height: 630 });
      const x = (m.twitter?.images as { url: string; width: number; height: number }[])[0];
      expect(x).toMatchObject({ url: `/og/${k}/x.png`, width: 1200, height: 600 });
      expect((m.twitter as { card?: string }).card).toBe("summary_large_image");
    }
  });

  it("sitemap lists exactly the indexable pages", () => {
    const urls = sitemap().map((e) => new URL(e.url).pathname.replace(/^$/, "/"));
    const expected = PAGE_KEYS.filter((k) => PAGES[k].index && "sitemap" in PAGES[k]).map((k) => PAGES[k].path);
    expect(urls.sort()).toEqual(expected.sort());
  });
});

describe("llms.txt (GEO)", () => {
  it("summarises the product and links every indexable page", () => {
    const txt = buildLlmsTxt();
    expect(txt.startsWith(`# ${BRAND_NAME}`)).toBe(true);
    for (const k of PAGE_KEYS) if (PAGES[k].index) expect(txt).toContain(`[${PAGES[k].label}](`);
  });

  it("full version carries the FAQ and glossary and never names platforms we don't search", () => {
    const full = buildLlmsFullTxt();
    expect(full).toContain("## Frequently asked questions");
    expect(full).toContain("## Glossary");
    expect(full).not.toMatch(/\b(reddit|instagram|tiktok|trustpilot|capterra)\b/i);
  });
});
