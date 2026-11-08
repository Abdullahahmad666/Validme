// Single place to rename the product.
export const BRAND_NAME = "ValidMe";
export const BRAND_TAGLINE = "Evidence-backed idea validation and your first 10 customers.";
export const BRAND_HEADLINE = "Stop building on assumptions. Start building on evidence.";

/** Public site origin for canonical URLs, sitemap and Open Graph. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Optional contact address. Leave unset until a real inbox exists (the contact page says so). */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || null;

/** Only real, active profiles. Empty until the brand has them. */
export const SOCIAL_LINKS: { label: string; href: string }[] = [];
