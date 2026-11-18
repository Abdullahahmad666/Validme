/** Helpers for day-by-day charts: no React, so they're easy to test. */

/** One day: its ISO date plus a count per series. */
export type DayRow = { day: string; [series: string]: string | number };

export const num = (row: DayRow, key: string): number => Number(row[key]) || 0;

const dayFmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });

export function fmtDay(iso: string): string {
  return dayFmt.format(new Date(`${iso}T00:00:00Z`));
}

const monthFmt = new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" });

/** "2026-03" → "Mar 2026". */
export function fmtMonth(ym: string): string {
  return monthFmt.format(new Date(`${ym}-01T00:00:00Z`));
}

export type Period = "day" | "week" | "month";

/** Label for a row key: days and week starts read "Nov 3"; months read "Mar 2026". */
export function fmtPeriod(key: string, period: Period = "day"): string {
  return period === "month" ? fmtMonth(key) : period === "week" ? `Week of ${fmtDay(key)}` : fmtDay(key);
}

/**
 * Every day from `since` to `until` (inclusive), with zeros where the API has no row. A day without a row really
 * had nothing counted (rows are created on the first count), so zero is the honest value, not an interpolation.
 */
export function fillDays(rows: DayRow[], since: string, until: string, keys: string[]): DayRow[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out: DayRow[] = [];
  const end = new Date(`${until}T00:00:00Z`);
  for (let d = new Date(`${since}T00:00:00Z`); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    const row = byDay.get(day);
    out.push({ day, ...Object.fromEntries(keys.map((k) => [k, row ? num(row, k) : 0])) });
  }
  return out;
}

/** One plain sentence for screen readers and the chart caption: totals and the busiest day. */
export function summarize(rows: DayRow[], series: { key: string; label: string }[], period: Period = "day"): string {
  if (rows.length === 0) return "No data yet.";
  const totals = series.map((s) => `${rows.reduce((n, r) => n + num(r, s.key), 0)} ${s.label.toLowerCase()}`);
  const first = series[0].key;
  const busiest = rows.reduce((a, b) => (num(b, first) > num(a, first) ? b : a));
  const f = (k: string) => (period === "month" ? fmtMonth(k) : fmtDay(k));
  const span = `${f(rows[0].day)}–${f(rows[rows.length - 1].day)}`;
  const unit = period === "month" ? "month" : period === "week" ? "week (starting)" : "day";
  return num(busiest, first) > 0
    ? `${span}: ${totals.join(", ")}. Busiest ${unit} ${f(busiest.day)} (${num(busiest, first)} ${series[0].label.toLowerCase()}).`
    : `${span}: ${totals.join(", ")}.`;
}
