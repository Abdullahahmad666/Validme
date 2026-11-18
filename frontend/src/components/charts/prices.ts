import type { ReportCompetitor } from "@/types/report";

export type PricePoint = { label: string; value: number; note: string };

const MONEY = /^\s*([$€£])\s?(\d{1,6}(?:[.,]\d{1,2})?)\s*$/;
const MONTHLY = /^\s*(?:\/|per\s+|a\s+)?\s*(?:mo|mon|month|monthly)\.?\s*$/i;

/**
 * Verified competitor plans that can be compared on one scale: an exact price on the page ("$29", "€19.99"), billed
 * monthly, in the most common currency. Everything else (free plans, "contact us", yearly or per-seat prices, other
 * currencies) is counted in `excluded` rather than converted or guessed.
 */
export function priceLadder(competitors: ReportCompetitor[]): { currency: string | null; points: PricePoint[]; excluded: number } {
  const parsed: { currency: string; value: number; label: string; note: string }[] = [];
  let excluded = 0;
  for (const c of competitors) {
    if (c.pricing.status !== "verified") continue;
    for (const p of c.pricing.plans) {
      const m = MONEY.exec(p.price);
      if (!m || !MONTHLY.test(p.period || "")) {
        excluded += 1;
        continue;
      }
      const value = Number(m[2].replace(",", "."));
      const read = c.pricing.retrieved_at ? `read ${c.pricing.retrieved_at.slice(0, 10)}` : "verified";
      parsed.push({ currency: m[1], value, label: `${c.name} · ${p.name}`, note: `${p.price} ${p.period} · ${read} from their pricing page` });
    }
  }
  if (parsed.length === 0) return { currency: null, points: [], excluded };
  const counts = new Map<string, number>();
  parsed.forEach((p) => counts.set(p.currency, (counts.get(p.currency) ?? 0) + 1));
  const currency = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const points = parsed
    .filter((p) => p.currency === currency)
    .sort((a, b) => a.value - b.value)
    .map(({ label, value, note }) => ({ label, value, note }));
  return { currency, points, excluded: excluded + (parsed.length - points.length) };
}
