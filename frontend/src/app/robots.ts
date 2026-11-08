import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/brand";

// Signed-in app, auth plumbing and API: nothing useful to index.
const DISALLOW = [
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
];

/**
 * AI search / answer engines (GEO). They're allowed on public pages so ValidMe can be cited in
 * AI answers, with the same private-route rules as everyone else. This is a business choice:
 * to opt out of a crawler, move it to `disallow: "/"` here.
 */
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Bingbot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      { userAgent: AI_CRAWLERS, allow: ["/", "/llms.txt", "/llms-full.txt"], disallow: DISALLOW },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
