import type { Level } from "@/types/report";
import type { Signal, SignalType } from "@/types/radar";

export const SIGNAL_TYPES: Record<SignalType, { label: string; className: string }> = {
  opportunity: { label: "Opportunity", className: "bg-success/10 text-success-text" },
  risk: { label: "Risk", className: "bg-warning/10 text-warning-text" },
  trend: { label: "Trend", className: "bg-primary/10 text-primary" },
};

/** Display bands for the 0..1 relevance / impact scores (presentation only; the scores come from backend rules). */
export function level(x: number): Level {
  return x >= 0.7 ? "high" : x >= 0.4 ? "medium" : "low";
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** One factual line on what the signal rests on (same wording as the digest; never AI). Missing facts are said to be
 * missing, never shown as 0. */
export function basisLine(s: Signal): string {
  const f = s.facts ?? {};
  switch (s.kind) {
    case "complaint_theme": {
      const [records, sources, sites] = [num(f.records), num(f.distinct_sources), num(f.sites)];
      if (records === null || sources === null || sites === null) return "Counts unavailable";
      return `${records} records from ${sources} distinct sources on ${sites} sites`;
    }
    case "discussion_trend": {
      const [recent, baseline] = [num(f.recent), num(f.baseline)];
      const end = Array.isArray(f.recent_window) ? str(f.recent_window[1]) : null;
      if (recent === null || baseline === null) return "Counts unavailable";
      return `${recent} dated records in the 30 days${end ? ` to ${end}` : ""}, vs ${baseline} in the 90 days before`;
    }
    case "competitor_change":
      return `A change we detected on ${str(f.competitor) ?? "a watched page"}`;
    case "new_competitor":
      return `${str(f.domain) ?? "A new product"}, which you chose to watch`;
  }
}

/** Why the confidence is what it is, from the counts the backend stored with the signal. */
export function confidenceReason(s: Signal): string {
  if (s.kind === "competitor_change") return "We read both versions of the page ourselves; the change is exact.";
  if (s.kind === "new_competitor") return "You confirmed it by watching it; a launch matching your searches isn't proof on its own.";
  const b = (s.facts?.confidence_basis ?? {}) as Record<string, unknown>;
  const [sources, sites, platforms, share] = [num(b.sources), num(b.sites), num(b.platforms), num(b.recent_share)];
  if (sources === null || sites === null || platforms === null || share === null) return "Basis unavailable.";
  const recent = `${Math.round(share * 100)}% from the last 6 months`;
  return `${sources} distinct sources on ${sites} sites from ${platforms} platform${platforms === 1 ? "" : "s"}; ${recent}${
    s.confidence === "high" ? "." : ". High needs 2+ platforms and at least 60% from the last 6 months."
  }`;
}

/** Monitoring signals use fixed relevance/impact by kind (a pricing change vs. a text change), not a measurement. */
export function scoresByKind(s: Signal): boolean {
  return s.facts?.scores_by_kind === true;
}
