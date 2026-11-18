"use client";

import { useId } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { aboveLabel, STACK_BELOW } from "@/components/charts/ticks";
import { useWidth } from "@/components/charts/useWidth";

export type Group = { label: string; values: Record<string, number | null> };
export type GroupSeries = { key: string; label: string; color: string };

const SLOTS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];

/** Fixed colour order for up to four compared things (never cycled; a fifth would need another chart). */
export function seriesColors(n: number): string[] {
  return SLOTS.slice(0, Math.min(n, SLOTS.length));
}

/**
 * Grouped vertical bars on a 0–100 scale (e.g. each score part for 2–4 ideas). A missing value (not scored) is a gap,
 * never a zero bar. Legend above, tooltip lists every series at the hovered group, sr summary; the page keeps the full
 * table, which also carries values for colours below 3:1.
 */
export function GroupedBars({ groups, series, height = 260, unit = "/100" }: { groups: Group[]; series: GroupSeries[]; height?: number; unit?: string }) {
  const id = useId();
  const [ref, width] = useWidth<HTMLDivElement>();
  // On narrow cards the groups run down the page (label above each group) so long names never truncate to "…".
  const narrow = width !== null && width < STACK_BELOW;
  const rowPx = series.length * 14 + 34;
  const data = groups.map((g) => ({ label: g.label, ...g.values }));
  const summary = groups
    .map((g) => `${g.label}: ${series.map((s) => `${s.label} ${g.values[s.key] ?? "not scored"}`).join(", ")}`)
    .join("; ");
  return (
    <figure className="flex flex-col gap-2" aria-labelledby={`${id}-cap`}>
      <ul className="flex flex-wrap gap-4 text-xs text-muted-foreground" aria-hidden>
        {series.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-[3px]" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
      <div ref={ref} aria-hidden style={{ height: narrow ? groups.length * rowPx + 28 : height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            accessibilityLayer={false}
            data={data}
            layout={narrow ? "vertical" : "horizontal"}
            margin={{ top: narrow ? 18 : 8, right: 8, bottom: 0, left: 0 }}
            barGap={2}
            barCategoryGap={narrow ? 20 : "22%"}
          >
            <CartesianGrid vertical={narrow} horizontal={!narrow} stroke="var(--chart-grid)" />
            {narrow ? (
              <>
                <XAxis type="number" domain={[0, 100]} ticks={[0, 50, 100]} tick={{ fill: "var(--chart-axis)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" hide width={0} />
              </>
            ) : (
              <>
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
              axisLine={{ stroke: "var(--chart-grid)" }}
              tickLine={false}
              interval={0}
              tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)}
            />
            <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={{ fill: "var(--chart-axis)", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
              </>
            )}
            <Tooltip
              cursor={{ fill: "var(--chart-cursor)" }}
              content={({ active, label, payload }) =>
                active && payload?.length ? (
                  <div className="rounded-control border border-border bg-popover px-3 py-2 text-xs shadow-md">
                    <p className="mb-1 text-muted-foreground">{String(label)}</p>
                    {series.map((s) => {
                      const v = (payload[0].payload as Record<string, number | null>)[s.key];
                      return (
                        <p key={s.key} className="flex items-center gap-2">
                          <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: s.color }} />
                          <span className="font-semibold tabular-nums">{v == null ? "Not scored" : `${v}${unit}`}</span>
                          <span className="text-muted-foreground">{s.label}</span>
                        </p>
                      );
                    })}
                  </div>
                ) : null
              }
            />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                fill={s.color}
                maxBarSize={narrow ? 12 : 22}
                radius={narrow ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                isAnimationActive={false}
              >
                {narrow && i === 0 && <LabelList dataKey="label" content={aboveLabel()} />}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption id={`${id}-cap`} className="sr-only">
        {summary}
      </figcaption>
    </figure>
  );
}
