"use client";

import { useId } from "react";
import { Bar, BarChart, ErrorBar, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { aboveLabel, labelColumn, leftTick, STACK_BELOW } from "@/components/charts/ticks";
import { useWidth } from "@/components/charts/useWidth";

export type ShareRow = { label: string; count: number; share: number | null; low?: number | null; high?: number | null };

const pctText = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 100)}%`);

/**
 * Shares of the people who answered (0–100%), one bar per option, with the server's 95% range as a whisker so a small
 * sample visibly carries a wide range. Labels left-aligned (stacked above the bar on narrow cards), value at the end.
 */
export function ShareBars({ rows, answered }: { rows: ShareRow[]; answered: number }) {
  const id = useId();
  const [box, width] = useWidth<HTMLDivElement>();
  const stacked = width !== null && width < STACK_BELOW;
  const col = labelColumn(rows.map((r) => r.label));
  const data = rows.map((r) => {
    const s = (r.share ?? 0) * 100;
    const lo = r.low != null ? r.low * 100 : null;
    const hi = r.high != null ? r.high * 100 : null;
    // No range from the server → no whisker at all (a zero-width one would look like certainty).
    return { ...r, pct: s, range: lo != null && hi != null ? [s - lo, hi - s] : undefined, shown: `${pctText(r.share)} (${r.count})` };
  });
  const summary = rows
    .map((r) => `${r.label}: ${r.count} of ${answered} (${pctText(r.share)}${r.low != null ? `, 95% range ${pctText(r.low)}–${pctText(r.high)}` : ""})`)
    .join("; ");
  return (
    <figure className="flex flex-col gap-1" aria-labelledby={`${id}-cap`}>
      <div ref={box} aria-hidden style={{ height: rows.length * (stacked ? 46 : 32) + 8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart accessibilityLayer={false} data={data} layout="vertical" margin={{ top: stacked ? 18 : 4, right: 70, bottom: 4, left: 0 }} barCategoryGap={stacked ? "34%" : 8}>
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis type="category" dataKey="label" width={stacked ? 0 : col} hide={stacked} tickLine={false} axisLine={false} tick={leftTick(col)} />
            <Tooltip
              cursor={{ fill: "var(--chart-cursor)" }}
              content={({ active, payload }) => {
                const r = active && payload?.[0] ? (payload[0].payload as ShareRow) : null;
                return r ? (
                  <div className="rounded-control border border-border bg-popover px-3 py-2 text-xs shadow-md">
                    <p className="text-muted-foreground">{r.label}</p>
                    <p>
                      <span className="font-semibold tabular-nums">{pctText(r.share)}</span>{" "}
                      <span className="text-muted-foreground">
                        {r.count} of {answered}
                      </span>
                    </p>
                    {r.low != null && (
                      <p className="text-muted-foreground">
                        95% range {pctText(r.low)}–{pctText(r.high)}
                      </p>
                    )}
                  </div>
                ) : null;
              }}
            />
            <Bar dataKey="pct" fill="var(--series-1)" maxBarSize={16} barSize={stacked ? 12 : undefined} radius={[0, 4, 4, 0]} isAnimationActive={false}>
              <ErrorBar dataKey="range" width={6} strokeWidth={1.5} stroke="var(--chart-axis)" direction="x" />
              <LabelList dataKey="shown" position="right" offset={10} style={{ fill: "var(--foreground)", fontSize: 12 }} />
              {stacked && <LabelList dataKey="label" content={aboveLabel()} />}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption id={`${id}-cap`} className="sr-only">
        {summary}
      </figcaption>
      <p className="text-xs text-muted-foreground">Bars show the share who picked each option; the whisker is its 95% range.</p>
    </figure>
  );
}
