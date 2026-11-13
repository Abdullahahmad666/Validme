/**
 * Price catalog (decided Week 10). Display only: the amount actually charged is whatever the Lemon Squeezy product
 * variant says, and the backend's /billing/packs returns the provider's own price label (and monthly credits) when
 * payments are live, which always win over these numbers. Keep this file, SUBSCRIPTION_PLANS in .env and the Lemon
 * Squeezy variants in step. Entitlements are enforced server-side from PLAN_LIMITS / MONITORING_AI_DAILY in
 * backend/config/settings.py; the numbers below mirror them for display.
 */

export type PlanId = "free" | "founder" | "pro";
export type Interval = "month" | "year";

export type PlanPrice = {
  id: PlanId;
  name: string;
  /** USD per month / per year; null for Free. */
  month: number | null;
  year: number | null;
  /** Research credits added on each paid invoice (a yearly invoice adds 12 months' worth). */
  monthlyCredits: number;
  watches: number;
  dailyChecks: boolean;
  aiSummariesPerDay: number;
  maxRunning: number;
};

/** MONITORING_MAX_WATCHES_PER_PROJECT: applies on every plan. */
export const WATCHES_PER_PROJECT = 20;

export const PLAN_PRICES: Record<PlanId, PlanPrice> = {
  free: { id: "free", name: "Free", month: null, year: null, monthlyCredits: 0, watches: 3, dailyChecks: false, aiSummariesPerDay: 10, maxRunning: 1 },
  founder: { id: "founder", name: "Founder", month: 19, year: 190, monthlyCredits: 4, watches: 20, dailyChecks: true, aiSummariesPerDay: 100, maxRunning: 3 },
  pro: { id: "pro", name: "Pro", month: 39, year: 390, monthlyCredits: 10, watches: 50, dailyChecks: true, aiSummariesPerDay: 300, maxRunning: 5 },
};

/** Credit-pack buyers without a plan ("paid" in the backend): all depths, free-plan monitoring. */
export const PACK_PLAN = { watches: 3, dailyChecks: false, maxRunning: 3 };

export type PackPrice = { id: string; name: string; credits: number; price: number };

/** One-off credit packs: no subscription, credits don't expire. */
export const PACK_PRICES: PackPrice[] = [
  { id: "starter", name: "Starter pack", credits: 6, price: 19 },
  { id: "builder", name: "Builder pack", credits: 20, price: 49 },
];

export const usd = (n: number) => `$${n}`;

/** Months saved by paying yearly (e.g. $190 vs 12 × $19 = 2 months free). */
export function yearlySavingMonths(p: PlanPrice): number {
  if (!p.month || !p.year) return 0;
  return Math.round((p.month * 12 - p.year) / p.month);
}

/** "50 competitor pages across your projects (up to 20 per project)" — the per-project cap applies to every plan. */
export function watchesLabel(watches: number): string {
  return watches > WATCHES_PER_PROJECT
    ? `${watches} competitor pages across your projects (up to ${WATCHES_PER_PROJECT} per project)`
    : `${watches} competitor pages`;
}

/** "Founder is $19/month and Pro is $39/month" — for copy that mentions the paid prices. */
export const PAID_PRICES_SENTENCE = `${PLAN_PRICES.founder.name} is ${usd(PLAN_PRICES.founder.month!)}/month and ${PLAN_PRICES.pro.name} is ${usd(PLAN_PRICES.pro.month!)}/month`;
