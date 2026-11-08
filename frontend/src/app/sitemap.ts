import type { MetadataRoute } from "next";
import { PAGE_KEYS, PAGES } from "@/content/seo";
import { absoluteUrl } from "@/lib/seo";

// Generated from the SEO registry: every indexable page with a sitemap entry, plus its social image.
export default function sitemap(): MetadataRoute.Sitemap {
  return PAGE_KEYS.flatMap((key) => {
    const p = PAGES[key];
    if (!p.index || !("sitemap" in p)) return [];
    return [
      {
        url: absoluteUrl(p.path),
        changeFrequency: p.sitemap.changeFrequency,
        priority: p.sitemap.priority,
        images: [absoluteUrl(`/og/${key}/og.png`)],
      },
    ];
  });
}
