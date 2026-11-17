import type { KeywordRow, ProviderStatus } from "@/types/distribution";

const whole = new Intl.NumberFormat("en-US");

/** A figure from a provider as given (full number, grouped). Missing → the word, never 0. */
export function figure(n: number | null | undefined, missing = "Unavailable"): string {
  return typeof n === "number" && Number.isFinite(n) ? whole.format(n) : missing;
}

export function usd(v: string | null): string {
  return v === null ? "Unavailable" : `$${v}`;
}

export const STATUS_TEXT: Record<ProviderStatus, string> = {
  OK: "Looked up",
  LIMITED: "Partly looked up",
  FAILED: "Couldn't look up",
  REQUIRES_CONNECTION: "Not connected",
  SKIPPED: "Nothing new to look up",
};

const monthFmt = new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" });
const monthName = (m: { year: number; month: number }) => monthFmt.format(new Date(Date.UTC(m.year, m.month - 1, 1)));

/** Plain description of a keyword's 12-month figures (for screen readers and the table), from the raw values. */
export function trendText(k: KeywordRow): string {
  const pts = k.monthly.filter((m) => typeof m.volume === "number");
  if (pts.length < 2) return "No monthly figures";
  const first = pts[0];
  const last = pts[pts.length - 1];
  const lo = Math.min(...pts.map((m) => m.volume as number));
  const hi = Math.max(...pts.map((m) => m.volume as number));
  return `${figure(first.volume)} in ${monthName(first)}, ${figure(last.volume)} in ${monthName(last)} (range ${figure(lo)}–${figure(hi)})`;
}

/** SVG polyline points for the monthly figures; a missing month breaks the line (returned as separate segments). */
export function sparkSegments(k: KeywordRow, w = 96, h = 24): string[] {
  const vals = k.monthly.map((m) => (typeof m.volume === "number" ? m.volume : null));
  const known = vals.filter((v): v is number => v !== null);
  if (known.length < 2) return [];
  const max = Math.max(...known) || 1;
  const step = vals.length > 1 ? w / (vals.length - 1) : w;
  const segs: string[] = [];
  let cur: string[] = [];
  vals.forEach((v, i) => {
    if (v === null) {
      if (cur.length > 1) segs.push(cur.join(" "));
      cur = [];
      return;
    }
    cur.push(`${(i * step).toFixed(1)},${(h - (v / max) * (h - 2) - 1).toFixed(1)}`);
  });
  if (cur.length > 1) segs.push(cur.join(" "));
  return segs;
}
