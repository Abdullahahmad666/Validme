import type { LucideIcon } from "lucide-react";

export type Segment = { key: string; label: string; value: number; color: string; icon: LucideIcon };

/**
 * A thin segmented bar (8px, 2px gaps, rounded ends) for parts of one whole, e.g. assumption statuses. The legend
 * carries icon + label + count, so the meaning never rests on colour; zero segments are skipped in the bar but kept in
 * the legend.
 */
export function SegmentBar({ segments, label }: { segments: Segment[]; label: string }) {
  const total = segments.reduce((n, s) => n + s.value, 0);
  if (total === 0) return null;
  return (
    <figure className="flex flex-col gap-2" aria-label={label}>
      <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden>
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <span key={s.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
          ))}
      </div>
      <figcaption>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {segments.map((s) => (
            <li key={s.key} className="inline-flex items-center gap-1">
              <s.icon className="size-3.5" style={{ color: s.color }} aria-hidden />
              <span className="font-semibold tabular-nums text-foreground">{s.value}</span> {s.label}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
