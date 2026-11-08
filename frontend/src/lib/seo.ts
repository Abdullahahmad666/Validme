import type { Metadata } from "next";
import { ogImagePath, OG_VARIANTS, PAGES, type PageKey } from "@/content/seo";
import { BRAND_NAME, SITE_URL } from "@/lib/brand";

/** Optional X handle (e.g. "@validme"). Leave unset until the account exists. */
const X_HANDLE = process.env.NEXT_PUBLIC_X_HANDLE || undefined;

export const absoluteUrl = (path: string) => `${SITE_URL}${path === "/" ? "" : path}`;

/**
 * Full metadata for a registry page: title, description, canonical, robots, Open Graph
 * (Facebook, LinkedIn, Slack, Discord, WhatsApp, iMessage) and X card, each with its own
 * correctly sized image. Next merges metadata shallowly, so every page must use this.
 */
export function pageMetadata(key: PageKey): Metadata {
  const page = PAGES[key];
  const fullTitle = "absoluteTitle" in page && page.absoluteTitle ? page.title : `${page.title} · ${BRAND_NAME}`;
  const og = OG_VARIANTS.og;
  const x = OG_VARIANTS.x;
  const alt = page.og.headline;

  return {
    title: "absoluteTitle" in page && page.absoluteTitle ? { absolute: page.title } : page.title,
    description: page.description,
    alternates: { canonical: page.path },
    robots: page.index
      ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } }
      : { index: false, follow: true },
    openGraph: {
      type: "website",
      siteName: BRAND_NAME,
      locale: "en_US",
      url: page.path,
      title: fullTitle,
      description: page.description,
      images: [{ url: ogImagePath(key, "og"), width: og.width, height: og.height, alt, type: "image/png" }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: page.description,
      images: [{ url: ogImagePath(key, "x"), width: x.width, height: x.height, alt }],
      ...(X_HANDLE ? { site: X_HANDLE, creator: X_HANDLE } : {}),
    },
  };
}
