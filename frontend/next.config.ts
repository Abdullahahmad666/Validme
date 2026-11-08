import type { NextConfig } from "next";

// Django origin. The browser only ever talks to this Next.js origin; /api and /_allauth are
// proxied so Django's session + CSRF cookies are first-party (no tokens in localStorage).
const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
      { source: "/_allauth/:path*", destination: `${BACKEND_URL}/_allauth/:path*` },
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
