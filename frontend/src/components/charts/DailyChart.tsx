"use client";

import { useId } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { type DayRow, fmtDay, fmtMonth, fmtPeriod, num, type Period, summarize } from "@/components/charts/daily";

export type DailySeries = { key: string; label: string; kind: "bar" | "line"; color: string };

/**
 * Day-by-day counts that share one unit (e.g. views and sign-ups, both people per day): one axis, bars for the main
 * series and a 2px line for the rest. Legend above (rect for bars, line for lines), a tooltip that lists every series
 * at the hovered day (values first), a one-line summary for screen readers, and the same numbers as a table.
 * Series colours come from the validated --series-* tokens, in fixed order.
 */
export function DailyChart({
  rows,
  series,
  height = 220,
  period = "day",
  emptyText = "Nothing counted in this period yet.",
}: {
  rows: DayRow[];
  series: DailySeries[];
  height?: number;
  period?: Period;
  emptyText?: string;
}) {
  const id = useId();
  const summary = summarize(rows, series, period);
  const tick = (k: string) => (period === "month" ? fmtMonth(k) : fmtDay(k));
  const anyData = rows.some((r) => series.some((s) => num(r, s.key) > 0));
  return (
    <figure className="flex flex-col gap-2" aria-labelledby={`${id}-cap`}>
      <ul className="flex flex-wrap gap-4 text-xs text-muted-foreground" aria-hidden>
        {series.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1.5">
            {s.kind === "bar" ? (
              <span className="inline-block size-2.5 rounded-[3px]" style={{ background: s.color }} />
            ) : (
              <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: s.color }} />
            )}
            {s.label}
          </li>
        ))}
      </ul>
      <div aria-hidden className="w-full" style={{ height }}>
        {anyData ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap="20%">
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="0" />
              <XAxis
                dataKey="day"
                tickFormatter={tick}
                tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
                axisLine={{ stroke: "var(--chart-grid)" }}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis allowDecimals={false} tick={{ fill: "var(--chart-axis)", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                cursor={{ fill: "rgb(49 94 170 / 0.08)" }}
                content={({ active, label, payload }) =>
                  active && payload?.length ? (
                    <div className="rounded-control border border-border bg-popover px-3 py-2 text-xs shadow-md">
                      <p className="mb-1 text-muted-foreground">{fmtPeriod(String(label), period)}</p>
                      {series.map((s) => {
                        const v = payload.find((p) => p.dataKey === s.key)?.value ?? 0;
                        return (
                          <p key={s.key} className="flex items-center gap-2">
                            <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: s.color }} />
                            <span className="font-semibold tabular-nums text-foreground">{String(v)}</span>
                            <span className="text-muted-foreground">{s.label.toLowerCase()}</span>
                          </p>
                        );
                      })}
                    </div>
                  ) : null
                }
              />
              {series.map((s) =>
                s.kind === "bar" ? (
                  <Bar key={s.key} dataKey={s.key} fill={s.color} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                ) : (
                  <Line
                    key={s.key}
                    dataKey={s.key}
                    stroke={s.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                    type="monotone"
                    isAnimationActive={false}
                  />
                ),
              )}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-control border border-dashed border-border text-sm text-muted-foreground">
            {emptyText}
          </div>
        )}
      </div>
      <figcaption id={`${id}-cap`} className="text-xs text-muted-foreground">
        {summary}
      </figcaption>
      <details className="text-xs">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium text-primary">Show as a table</summary>
        <div className="max-h-56 overflow-auto rounded-control border border-border">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-card text-muted-foreground">
              <tr>
                <th scope="col" className="px-2 py-1 font-medium">
                  {period === "month" ? "Month" : period === "week" ? "Week of" : "Day"}
                </th>
                {series.map((s) => (
                  <th key={s.key} scope="col" className="px-2 py-1 text-right font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...rows].reverse().map((r) => (
                <tr key={r.day}>
                  <th scope="row" className="px-2 py-1 font-normal">
                    {tick(r.day)}
                  </th>
                  {series.map((s) => (
                    <td key={s.key} className="px-2 py-1 text-right tabular-nums">
                      {num(r, s.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
