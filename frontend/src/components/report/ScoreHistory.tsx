import { fmtDate } from "@/components/evidence/EvidenceCard";
import { Panel } from "@/components/report/parts";
import type { ReportVersion } from "@/types/report";

/**
 * Score per report version, oldest → newest. Unscored versions break the line and sit in a
 * separate "not scored" band below the 0–100 scale: never drawn as a score, never interpolated.
 */
export function ScoreHistory({ versions, currentId }: { versions: ReportVersion[]; currentId: number }) {
  if (versions.length < 2) return null;
  const points = [...versions].reverse();
  const w = 560;
  const top = 10;
  const plotBottom = 120; // y of score 0
  const band = 140; // "not scored" band, below the scale
  const h = 152;
  const pad = 12;
  const x = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, points.length - 1);
  const y = (s: number) => plotBottom - (s / 100) * (plotBottom - top);

  // One path segment per run of consecutive scored versions: a gap breaks the line.
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
  const scored = points.filter((p) => p.score !== null);
  const first = scored[0]?.score;
  const last = scored.at(-1)?.score;

  return (
    <Panel
      title="Score history"
      aside={
        first != null && last != null && scored.length > 1 ? (
          <span className="text-xs text-muted-foreground">
            {last - first >= 0 ? "+" : ""}
            {last - first} since the first scored version
          </span>
        ) : undefined
      }
    >
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" aria-hidden>
        {[0, 50, 100].map((v) => (
          <line key={v} x1={pad} x2={w - pad} y1={y(v)} y2={y(v)} className="stroke-border" strokeDasharray="3 4" />
        ))}
        <line x1={pad} x2={w - pad} y1={band} y2={band} className="stroke-border" />
        {path && <path d={path} fill="none" className="stroke-primary" strokeWidth={2} />}
        {points.map((p, i) =>
          p.score === null ? (
            <circle key={p.id} cx={x(i)} cy={band} r={4} fill="none" className="stroke-muted-strong" strokeWidth={1.5} />
          ) : (
            <circle key={p.id} cx={x(i)} cy={y(p.score)} r={p.id === currentId ? 5.5 : 4} className="fill-primary" />
          ),
        )}
      </svg>
      <p className="mt-1 text-xs text-muted-foreground">
        Dashed lines: 0, 50 and 100. Hollow points on the bottom line are versions that weren&apos;t scored (not enough evidence).
      </p>
      <table className="mt-3 w-full text-sm">
        <caption className="sr-only">Score by report version</caption>
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="py-1 text-left font-medium">Version</th>
            <th scope="col" className="py-1 text-left font-medium">Depth</th>
            <th scope="col" className="py-1 text-right font-medium">Score</th>
          </tr>
        </thead>
        <tbody>
          {[...versions].map((v) => (
            <tr key={v.id} className="border-t border-border">
              <th scope="row" className="py-1.5 text-left font-normal">
                #{v.id} · {fmtDate(v.created_at)}
                {v.id === currentId && <span className="ml-1 text-xs text-muted-foreground">(viewing)</span>}
              </th>
              <td className="py-1.5 capitalize">{v.depth}</td>
              <td className="py-1.5 text-right tabular-nums">
                {v.score === null ? <span className="italic text-muted-foreground">Not scored</span> : `${v.score}/100`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted-foreground">
        Scores are computed from evidence counts, so they move as research adds or changes evidence.
      </p>
    </Panel>
  );
}
