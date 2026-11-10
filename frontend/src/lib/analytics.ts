/**
 * First-party analytics: events go to our own API (POST /api/analytics/events), never to a third party.
 * No cookies are set, no IP or user agent is stored, and nothing is sent when the browser asks not to be
 * tracked (Global Privacy Control or Do Not Track).
 *
 * Client events (the server drops anything else; keep in sync with backend/analytics/services.py):
 *  hero_cta_clicked · sample_report_opened · pricing_viewed · signup_started · signup_completed ·
 *  report_viewed · report_exported · checkout_clicked
 * Research, report and purchase events are recorded server-side, where the facts are known.
 */
export type AnalyticsEvent =
  | "hero_cta_clicked"
  | "sample_report_opened"
  | "pricing_viewed"
  | "signup_started"
  | "signup_completed"
  | "report_viewed"
  | "report_exported"
  | "checkout_clicked";

export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;
type Handler = (event: AnalyticsEvent, props: AnalyticsProps) => void;

const handlers = new Set<Handler>();

export function registerAnalyticsHandler(handler: Handler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

export function track(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
  if (typeof window === "undefined") return;
  for (const handler of handlers) {
    try {
      handler(event, props);
    } catch {
      // Analytics must never break the product.
    }
  }
  window.dispatchEvent(new CustomEvent("validme:analytics", { detail: { event, props } }));
  if (process.env.NODE_ENV === "development") console.debug("[analytics]", event, props);
}

/** Respect the browser's opt-out signals. */
export function trackingAllowed(nav: { doNotTrack?: string | null; globalPrivacyControl?: boolean } | undefined): boolean {
  if (!nav) return false;
  return !(nav.globalPrivacyControl === true || nav.doNotTrack === "1");
}

/** Install once on the client: forwards events to our own API. Returns an uninstall function. */
export function installFirstPartyAnalytics(send: (body: { event: string; props: AnalyticsProps; path: string }) => void) {
  return registerAnalyticsHandler((event, props) => {
    if (!trackingAllowed(navigator as Navigator & { globalPrivacyControl?: boolean })) return;
    send({ event, props, path: window.location.pathname });
  });
}
