import type { NextConfig } from "next";

// Django origin. The browser only ever talks to this Next.js origin; /api and /_allauth are
// proxied so Django's session + CSRF cookies are first-party (no tokens in localStorage).
const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/$/, "");

const isDev = process.env.NODE_ENV !== "production";
const isHttps = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");

// Everything is same-origin (API proxied, fonts bundled, no third-party scripts). Next.js needs inline
// scripts for hydration; dev also needs eval + the HMR websocket. Google sign-in posts to /_allauth,
// which redirects to Google, so form-action allows that one origin.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "object-src 'none'",
  ...(isHttps ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isHttps ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  poweredByHeader: false, // don't advertise the framework
  productionBrowserSourceMaps: false, // never ship source maps to browsers
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
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
