"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtDay } from "@/components/charts/daily";
import { fmtDate } from "@/components/evidence/EvidenceCard";
import { Panel } from "@/components/report/parts";
import type { ScoreSnapshot } from "@/types/radar";

const SOURCE_LABEL = { report: "Research report", revalidation: "Weekly re-check" } as const;

/**
 * Score over time from snapshots (oldest → newest). Unscored points break the line and are counted in words: never
 * drawn as 0, never interpolated.
 */
export function ScoreTrend({ snapshots }: { snapshots: ScoreSnapshot[] }) {
  if (snapshots.length < 2) {
    return (
      <Panel title="Score over time">
        <p className="text-sm text-muted-foreground">
          The score is re-checked every week from your stored evidence. The chart appears once there are two points.
        </p>
      </Panel>
    );
  }
  const points = [...snapshots].reverse();
  const recent = snapshots.slice(0, 6);
  const scored = points.filter((p) => p.score !== null);
  const first = scored[0];
  const last = scored.at(-1);
  const unscored = points.length - scored.length;
  // Where the scoring rules changed (e.g. score_v2 added the founder's experiments): marked so a jump isn't read as the
  // market moving.
  const change = points.findIndex((p, i) => i > 0 && (p.scoring_version || "") !== (points[i - 1].scoring_version || ""));
  // A real time axis, so a missed week shows as a wider gap instead of evenly spaced points.
  const data = points.map((p) => ({ ...p, t: Date.parse(p.created_at) }));
  const tickDay = (t: number) => fmtDay(new Date(t).toISOString().slice(0, 10));
  return (
    <Panel title="Score over time">
      {first && last && first !== last && (
        <p className="mb-2 text-sm">
          {last.score}/100 on {fmtDate(last.created_at)}, from {first.score}/100 on {fmtDate(first.created_at)} ({points.length}{" "}
          points).
        </p>
      )}
      <ul className="mb-1 flex flex-wrap gap-4 text-xs text-muted-foreground" aria-hidden>
        <li className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full" style={{ background: "var(--series-1)" }} /> Research report
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="inline-block size-1.5 rounded-full" style={{ background: "var(--series-1)" }} /> Weekly re-check
        </li>
        {change > 0 && (
          <li className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-0 border-l border-dashed" style={{ borderColor: "var(--chart-axis)" }} /> Scoring rules changed
          </li>
        )}
      </ul>
      <div aria-hidden className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart accessibilityLayer={false} data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={tickDay}
              tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
              axisLine={{ stroke: "var(--chart-grid)" }}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={{ fill: "var(--chart-axis)", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
            {change > 0 && (
              <ReferenceLine x={data[change].t} stroke="var(--chart-axis)" strokeDasharray="3 4" />
            )}
            <Tooltip
              cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "2 3" }}
              content={({ active, payload }) => {
                const p = active && payload?.[0] ? (payload[0].payload as ScoreSnapshot & { t: number }) : null;
                return p ? (
                  <div className="rounded-control border border-border bg-popover px-3 py-2 text-xs shadow-md">
                    <p className="text-muted-foreground">{fmtDate(p.created_at)}</p>
                    <p className="font-semibold tabular-nums">{p.score === null ? "Not scored" : `${p.score}/100`}</p>
                    <p className="text-muted-foreground">{SOURCE_LABEL[p.source]}</p>
                  </div>
                ) : null;
              }}
            />
            <Line
              dataKey="score"
              stroke="var(--series-1)"
              strokeWidth={2}
              connectNulls={false}
              isAnimationActive={false}
              dot={(props) => {
                const { cx, cy, payload, index } = props as { cx?: number; cy?: number; payload: ScoreSnapshot; index: number };
                if (payload.score === null || cx === undefined || cy === undefined) return <g key={index} />;
                return <circle key={index} cx={cx} cy={cy} r={payload.source === "report" ? 5 : 3} fill="var(--series-1)" stroke="var(--card)" strokeWidth={2} />;
              }}
              activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Large points are research reports, small ones weekly re-checks of the same evidence (scores drift as evidence ages).
        {unscored > 0 && ` ${unscored} point${unscored === 1 ? " wasn't" : "s weren't"} scored and ${unscored === 1 ? "is" : "are"} left as a gap, not drawn as 0.`}
      </p>
      {change > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          The dashed line marks {fmtDate(points[change].created_at)}, when the scoring rules changed (your own experiments now
          count): scores before and after aren&apos;t directly comparable.
        </p>
      )}
      <table className="mt-3 w-full text-sm">
        <caption className="sr-only">Most recent scores</caption>
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="w-[36%] py-1 text-left font-medium">Date</th>
            <th scope="col" className="w-[40%] py-1 text-left font-medium">From</th>
            <th scope="col" className="py-1 text-right font-medium">Score</th>
          </tr>
        </thead>
        <tbody>
          {recent.map((s) => (
            <tr key={s.id} className="border-t border-border">
              <th scope="row" className="py-1.5 text-left font-normal">{fmtDate(s.created_at)}</th>
              <td className="py-1.5">{SOURCE_LABEL[s.source]}</td>
              <td className="py-1.5 text-right tabular-nums">
                {s.score === null ? <span className="italic text-muted-foreground">Not scored</span> : `${s.score}/100`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {snapshots.length > recent.length && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Show all {snapshots.length} scores</summary>
          <table className="mt-2 w-full text-sm">
            <caption className="sr-only">Older scores</caption>
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="w-[36%] py-1 text-left font-medium">Date</th>
                <th scope="col" className="w-[40%] py-1 text-left font-medium">From</th>
                <th scope="col" className="py-1 text-right font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.slice(recent.length).map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <th scope="row" className="py-1.5 text-left font-normal">{fmtDate(s.created_at)}</th>
                  <td className="py-1.5">{SOURCE_LABEL[s.source]}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {s.score === null ? <span className="italic text-muted-foreground">Not scored</span> : `${s.score}/100`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </Panel>
  );
}
