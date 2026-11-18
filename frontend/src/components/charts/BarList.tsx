"use client";

import { useId } from "react";
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { aboveLabel, labelColumn, leftTick, STACK_BELOW } from "@/components/charts/ticks";
import { useWidth } from "@/components/charts/useWidth";

export type BarRow = { label: string; value: number; note?: string };

/**
 * Horizontal bars for "how many per category / source / theme" (design system: horizontal bars for distributions, no
 * pies). One colour (--series-1), value labels at the bar ends in text colour, a tooltip with any note, a one-line
 * summary for screen readers, and the same numbers as a table. Rows keep the order given (sort before passing).
 */
export function BarList({
  rows,
  unit,
  color = "var(--series-1)",
  rowHeight = 34,
  labelWidth,
  max,
  additive = true,
  emptyText = "Nothing to show yet.",
}: {
  rows: BarRow[];
  unit: string;
  color?: string;
  rowHeight?: number;
  labelWidth?: number; // max width of the label column; it shrinks to the longest label
  max?: number;
  /** Whether the values can be summed (counts of things). Prices or overlapping search volumes can't: no total. */
  additive?: boolean;
  emptyText?: string;
}) {
  const id = useId();
  const [box, width] = useWidth<HTMLDivElement>();
  const stacked = width !== null && width < STACK_BELOW;
  const total = rows.reduce((n, r) => n + r.value, 0);
  if (rows.length === 0 || total === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  const top = rows.reduce((a, b) => (b.value > a.value ? b : a));
  const col = labelColumn(
    rows.map((r) => r.label),
    labelWidth ?? 220,
  );
  const low = rows.reduce((a, b) => (b.value < a.value ? b : a));
  const summary = additive
    ? `${rows.length} ${rows.length === 1 ? "row" : "rows"}, ${total} ${unit} in all; most: ${top.label} (${top.value}).`
    : `${rows.length} ${rows.length === 1 ? "row" : "rows"} (${unit}), from ${low.value} (${low.label}) to ${top.value} (${top.label}).`;
  return (
    <figure className="flex flex-col gap-1" aria-labelledby={`${id}-cap`}>
      <div ref={box} aria-hidden style={{ height: rows.length * (stacked ? rowHeight + 14 : rowHeight) + 8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart accessibilityLayer={false} data={rows} layout="vertical" margin={{ top: stacked ? 18 : 4, right: 40, bottom: 4, left: 0 }} barCategoryGap={stacked ? "34%" : 8}>
            <XAxis type="number" hide domain={[0, max ?? "dataMax"]} />
            <YAxis type="category" dataKey="label" width={stacked ? 0 : col} hide={stacked} tickLine={false} axisLine={false} tick={leftTick(col)} />
            <Tooltip
              cursor={{ fill: "var(--chart-cursor)" }}
              content={({ active, payload }) => {
                const row = active && payload?.[0] ? (payload[0].payload as BarRow) : null;
                return row ? (
                  <div className="max-w-xs rounded-control border border-border bg-popover px-3 py-2 text-xs shadow-md">
                    <p className="font-semibold tabular-nums text-foreground">
                      {row.value} <span className="font-normal text-muted-foreground">{unit}</span>
                    </p>
                    <p className="text-muted-foreground">{row.label}</p>
                    {row.note && <p className="mt-1 text-muted-foreground">{row.note}</p>}
                  </div>
                ) : null;
              }}
            />
            <Bar dataKey="value" fill={color} maxBarSize={20} barSize={stacked ? 14 : undefined} radius={[0, 4, 4, 0]} isAnimationActive={false}>
              <LabelList dataKey="value" position="right" style={{ fill: "var(--foreground)", fontSize: 12, fontVariantNumeric: "tabular-nums" }} />
              {stacked && <LabelList dataKey="label" content={aboveLabel()} />}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption id={`${id}-cap`} className="sr-only">
        {summary}
      </figcaption>
      <details className="text-xs">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium text-primary">Show as a table</summary>
        <table className="w-full text-left">
          <thead className="text-muted-foreground">
            <tr>
              <th scope="col" className="py-1 pr-2 font-medium">
                Name
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                {unit ? unit[0].toUpperCase() + unit.slice(1) : "Value"}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row" className="py-1 pr-2 font-normal">
                  {r.label}
                  {r.note && <span className="block text-muted-foreground">{r.note}</span>}
                </th>
                <td className="py-1 text-right tabular-nums">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
