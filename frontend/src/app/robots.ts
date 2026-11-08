import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Signed-in app, auth plumbing and API: nothing useful to index.
      disallow: [
        "/api/",
        "/_allauth/",
        "/accounts/",
        "/dashboard",
        "/projects",
        "/research/",
        "/evidence",
        "/opportunities",
        "/competitors",
        "/distribution",
        "/billing",
        "/settings",
        "/verify-email/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
