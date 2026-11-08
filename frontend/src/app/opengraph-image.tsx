import { PAGES } from "@/content/seo";
import { renderSocialImage } from "@/lib/og-template";

// Fallback social image for any route without its own registry entry.
export const alt = PAGES.home.og.headline;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return renderSocialImage({ ...PAGES.home.og, ...size });
}
