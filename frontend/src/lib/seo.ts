import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/brand";

const OG_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: `${BRAND_NAME} — evidence-backed idea validation` };

/**
 * Per-page metadata for marketing pages. Next merges metadata shallowly, so every page that
 * sets openGraph/twitter must repeat the image and card type, which is why this helper exists.
 */
export function pageMetadata({
  title,
  description,
  path,
  socialTitle,
  absoluteTitle = false,
  noindex = false,
}: {
  title: string;
  description: string;
  path: string;
  socialTitle?: string;
  absoluteTitle?: boolean;
  noindex?: boolean;
}): Metadata {
  const shareTitle = socialTitle ?? (absoluteTitle ? title : `${title} · ${BRAND_NAME}`);
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: shareTitle,
      description,
      url: path,
      siteName: BRAND_NAME,
      type: "website",
      locale: "en_US",
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title: shareTitle, description, images: [OG_IMAGE.url] },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
