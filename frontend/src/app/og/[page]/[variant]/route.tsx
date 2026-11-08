import { OG_VARIANTS, PAGE_KEYS, PAGES, type OgVariant, type PageKey } from "@/content/seo";
import { renderSocialImage } from "@/lib/og-template";

/**
 * Per-page social images, prerendered at build time for every registry entry:
 *   /og/<page>/og.png  1200×630  Open Graph (Facebook, LinkedIn, Slack, Discord, WhatsApp, iMessage)
 *   /og/<page>/x.png   1200×600  X / Twitter summary_large_image
 * Only registry keys render; anything else is a 404 (no arbitrary text on our domain).
 */
export function generateStaticParams() {
  return PAGE_KEYS.flatMap((page) => (Object.keys(OG_VARIANTS) as OgVariant[]).map((v) => ({ page, variant: `${v}.png` })));
}

export async function GET(_request: Request, { params }: { params: Promise<{ page: string; variant: string }> }) {
  const { page, variant } = await params;
  const v = variant.replace(/\.png$/, "") as OgVariant;
  if (!(page in PAGES) || !(v in OG_VARIANTS) || !variant.endsWith(".png")) {
    return new Response("Not found", { status: 404 });
  }
  const { og } = PAGES[page as PageKey];
  return renderSocialImage({ ...og, ...OG_VARIANTS[v] });
}
