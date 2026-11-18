"use client";

import { useId } from "react";
import { Bar, BarChart, LabelList, PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { aboveLabel, labelColumn, leftTick, STACK_BELOW } from "@/components/charts/ticks";
import { useWidth } from "@/components/charts/useWidth";
import type { Dimension } from "@/types/report";

/** The headline score as a ring (0–100). Not scored → no ring, just the words (never drawn as 0). */
export function ScoreRing({ score, size = 148 }: { score: number | null; size?: number }) {
  if (score === null) return <p className="text-lg font-semibold">Not enough evidence to score</p>;
  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`Opportunity score ${score} out of 100`}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart accessibilityLayer={false} innerRadius="78%" outerRadius="100%" data={[{ value: score }]} startAngle={90} endAngle={-270} barSize={12}>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
          <RadialBar dataKey="value" cornerRadius={6} fill="var(--series-1)" background={{ fill: "var(--chart-track)" }} isAnimationActive={false} />
        </RadialBarChart>
      </ResponsiveContainer>
      <p className="absolute inset-0 flex flex-col items-center justify-center leading-none" aria-hidden>
        <span className="text-4xl font-semibold tabular-nums">{score}</span>
        <span className="mt-1 text-xs text-muted-foreground">out of 100</span>
      </p>
    </div>
  );
}

type Row = { label: string; score: number; research?: number; weight: number };

/**
 * Each scored part of the opportunity score (0–100). Where the founder's experiment counted, a second bar shows the
 * research-only score, so the experiment's effect is visible. Parts that weren't scored are listed in words below,
 * never drawn as 0.
 */
export function ScoreBreakdown({ dimensions }: { dimensions: Dimension[] }) {
  const id = useId();
  const [box, width] = useWidth<HTMLDivElement>();
  const stacked = width !== null && width < STACK_BELOW;
  const scored = dimensions.filter((d) => d.score !== null);
  const notScored = dimensions.filter((d) => d.score === null);
  const rows: Row[] = scored.map((d) => ({
    label: `${d.label} · ${d.weight}%`,
    score: d.score as number,
    research: d.experiment?.counted && d.research_score != null ? d.research_score : undefined,
    weight: d.weight,
  }));
  const withResearch = rows.some((r) => r.research !== undefined);
  const col = labelColumn(rows.map((r) => r.label));
  const summary = [
    ...rows.map((r) => `${r.label}: ${r.score}/100${r.research !== undefined ? ` (research alone ${r.research})` : ""}`),
    notScored.length ? `Not scored: ${notScored.map((d) => d.label).join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("; ");
  return (
    <figure className="flex flex-col gap-2" aria-labelledby={`${id}-cap`}>
      {withResearch && (
        <ul className="flex flex-wrap gap-4 text-xs text-muted-foreground" aria-hidden>
          <li className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-[3px]" style={{ background: "var(--series-1)" }} /> Score (with your experiment)
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-[3px]" style={{ background: "var(--series-2)" }} /> Research alone
          </li>
        </ul>
      )}
      {rows.length > 0 && (
        <div ref={box} aria-hidden style={{ height: rows.length * ((withResearch ? 52 : 36) + (stacked ? 16 : 0)) + 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart accessibilityLayer={false}
              data={rows}
              layout="vertical"
              margin={{ top: stacked ? 18 : 4, right: 36, bottom: 4, left: 0 }}
              barCategoryGap={stacked ? "30%" : withResearch ? 10 : 8}
              barGap={2}
            >
              <XAxis type="number" domain={[0, 100]} hide />
              <YAxis type="category" dataKey="label" width={stacked ? 0 : col} hide={stacked} tickLine={false} axisLine={false} tick={leftTick(col)} />
              <Tooltip
                cursor={{ fill: "var(--chart-cursor)" }}
                content={({ active, payload }) => {
                  const r = active && payload?.[0] ? (payload[0].payload as Row) : null;
                  return r ? (
                    <div className="rounded-control border border-border bg-popover px-3 py-2 text-xs shadow-md">
                      <p className="text-muted-foreground">{r.label}</p>
                      <p>
                        <span className="font-semibold tabular-nums">{r.score}/100</span> <span className="text-muted-foreground">score</span>
                      </p>
                      {r.research !== undefined && (
                        <p>
                          <span className="font-semibold tabular-nums">{r.research}/100</span> <span className="text-muted-foreground">research alone</span>
                        </p>
                      )}
                    </div>
                  ) : null;
                }}
              />
              <Bar dataKey="score" fill="var(--series-1)" maxBarSize={16} barSize={stacked ? 12 : undefined} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                <LabelList dataKey="score" position="right" style={{ fill: "var(--foreground)", fontSize: 12 }} />
                {stacked && <LabelList dataKey="label" content={aboveLabel()} />}
              </Bar>
              {withResearch && (
                <Bar dataKey="research" fill="var(--series-2)" maxBarSize={10} barSize={stacked ? 8 : undefined} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  <LabelList dataKey="research" position="right" style={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                </Bar>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {notScored.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Not scored (no evidence yet, so left out rather than counted as 0): {notScored.map((d) => d.label).join(", ")}.
        </p>
      )}
      <figcaption id={`${id}-cap`} className="sr-only">
        {summary}
      </figcaption>
    </figure>
  );
}
