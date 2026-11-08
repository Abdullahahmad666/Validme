/**
 * Only allow same-origin paths as post-login redirects. Parsing with URL (instead of string
 * checks) closes bypasses like "/\t/evil.com", which browsers normalise to "//evil.com".
 */
export function safeNext(raw: string | null | undefined, fallback = "/dashboard", origin?: string): string {
  if (!raw || !raw.startsWith("/")) return fallback;
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "http://localhost");
  try {
    const url = new URL(raw, base);
    if (url.origin !== new URL(base).origin) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
