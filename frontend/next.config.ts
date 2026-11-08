import type { NextConfig } from "next";

// Django origin. The browser only ever talks to this Next.js origin; /api and /_allauth are
// proxied so Django's session + CSRF cookies are first-party (no tokens in localStorage).
const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Django's allauth URLs end in "/"; Next's default slash-stripping redirect would loop with APPEND_SLASH.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
      { source: "/_allauth/:path*", destination: `${BACKEND_URL}/_allauth/:path*` },
      // OAuth provider callbacks (e.g. /accounts/google/login/callback/) land on this origin.
      // `:path*` drops a trailing slash, so keep it explicitly (Django's APPEND_SLASH would loop).
      { source: "/accounts/:path*/", destination: `${BACKEND_URL}/accounts/:path*/` },
      { source: "/accounts/:path*", destination: `${BACKEND_URL}/accounts/:path*` },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
