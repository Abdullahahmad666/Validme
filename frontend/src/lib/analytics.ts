/**
 * Provider-agnostic analytics. No vendor is wired in yet, and there are no tracking IDs here.
 *
 * To connect a provider later, call `registerAnalyticsHandler` once on the client
 * (e.g. in app/providers.tsx) with a function that forwards to it. Until then, events are
 * dispatched as a `validme:analytics` DOM event (and logged in development) and go nowhere.
 *
 * Integration points:
 *  - hero_cta_clicked        → marketing hero CTA (wired)
 *  - sample_report_opened    → /sample-report page view (wired)
 *  - pricing_viewed          → pricing section enters viewport / /pricing (wired)
 *  - signup_started          → signup form submitted (wired, AuthForm)
 *  - signup_completed        → signup succeeded (wired, AuthForm)
 *  - first_research_started  → research job submission (wizard step 4; Week 2). Prefer firing
 *                              server-side, where "first" is known.
 *  - first_report_completed  → job reaches COMPLETED/PARTIALLY_COMPLETED (server-side)
 *  - subscription_started    → payment provider webhook (Week 6, server-side)
 */
export type AnalyticsEvent =
  | "hero_cta_clicked"
  | "sample_report_opened"
  | "pricing_viewed"
  | "signup_started"
  | "signup_completed"
  | "first_research_started"
  | "first_report_completed"
  | "subscription_started";

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
