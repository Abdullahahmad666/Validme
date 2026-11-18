import { fmtDate } from "@/components/evidence/EvidenceCard";
import { Panel } from "@/components/report/parts";
import type { ScoreSnapshot } from "@/types/radar";

const SOURCE_LABEL = { report: "Research report", revalidation: "Weekly re-check" } as const;

/**
 * Score over time from snapshots (oldest → newest). Unscored points sit on a separate "not scored" line below
 * the 0–100 scale and break the line: never drawn as 0, never interpolated.
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
  const w = 560;
  const top = 10;
  const plotBottom = 120;
  const band = 140;
  const h = 152;
  const pad = 12;
  const x = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, points.length - 1);
  const y = (s: number) => plotBottom - (s / 100) * (plotBottom - top);
  let path = "";
  let open = false;
  points.forEach((p, i) => {
    if (p.score === null) {
      open = false;
      return;
    }
    path += `${open ? "L" : "M"}${x(i).toFixed(1)},${y(p.score).toFixed(1)} `;
    open = true;
  });
  const recent = snapshots.slice(0, 6);
  // Where the scoring rules changed (e.g. score_v2 added the founder's experiments): marked so a jump isn't read as the
  // market moving.
  const change = points.findIndex((p, i) => i > 0 && (p.scoring_version || "") !== (points[i - 1].scoring_version || ""));
  const scored = points.filter((p) => p.score !== null);
  const first = scored[0];
  const last = scored.at(-1);
  return (
    <Panel title="Score over time">
      {first && last && first !== last && (
        <p className="mb-2 text-sm">
          {last.score}/100 on {fmtDate(last.created_at)}, from {first.score}/100 on {fmtDate(first.created_at)} ({points.length}{" "}
          points).
        </p>
      )}
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" aria-hidden>
        {[0, 50, 100].map((v) => (
          <line key={v} x1={pad} x2={w - pad} y1={y(v)} y2={y(v)} className="stroke-border" strokeDasharray="3 4" />
        ))}
        <line x1={pad} x2={w - pad} y1={band} y2={band} className="stroke-border" />
        {change > 0 && <line x1={x(change) - 6} x2={x(change) - 6} y1={top} y2={band} className="stroke-muted-strong" strokeDasharray="2 3" />}
        {path && <path d={path} fill="none" className="stroke-primary" strokeWidth={2} />}
        {points.map((p, i) =>
          p.score === null ? (
            <circle key={p.id} cx={x(i)} cy={band} r={4} fill="none" className="stroke-muted-strong" strokeWidth={1.5} />
          ) : (
            <circle key={p.id} cx={x(i)} cy={y(p.score)} r={p.source === "report" ? 5 : 3.5} className="fill-primary" />
          ),
        )}
      </svg>
      <p className="mt-1 text-xs text-muted-foreground">
        Large points are research reports, small ones weekly re-checks of the same evidence (scores drift as evidence
        ages). Hollow points on the bottom line weren&apos;t scored.
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
            <th scope="col" className="py-1 text-left font-medium">Date</th>
            <th scope="col" className="py-1 text-left font-medium">From</th>
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
    </Panel>
  );
}
