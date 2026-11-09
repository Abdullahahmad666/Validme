import { ExternalLink, Gauge, Sparkles } from "lucide-react";
import { CATEGORY_META, PROVIDER_LABELS, fmtDate } from "@/components/evidence/EvidenceCard";
import { cn } from "@/lib/utils";
import type { Level, ReportEvidence } from "@/types/report";

export const LEVEL_STYLE: Record<Level, string> = {
  high: "bg-success/10 text-success-text",
  medium: "bg-warning/10 text-warning-text",
  low: "bg-muted text-muted-strong",
};

export function ConfidenceBadge({ level, prefix = "" }: { level: Level | ""; prefix?: string }) {
  if (!level) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", LEVEL_STYLE[level])}>
      <Gauge className="size-3" aria-hidden />
      {prefix}
      {level[0].toUpperCase() + level.slice(1)} confidence
    </span>
  );
}

export function AiLabel({ children = "AI summary" }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-ai/10 px-2 py-0.5 text-[11px] font-medium text-ai">
      <Sparkles className="size-3" aria-hidden />
      {children}
    </span>
  );
}

/** Horizontal bar (design system: horizontal bars for distributions, no pies). */
export function HBar({ label, value, max, tone = "bg-primary" }: { label: string; value: number; max: number; tone?: string }) {
  return (
    <li>
      <div className="mb-1 flex justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
      </div>
    </li>
  );
}

export function EvidenceQuote({ e }: { e: ReportEvidence }) {
  return (
    <li className="rounded-control border border-border p-3">
      <a
        href={e.source_url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="inline-flex items-start gap-1 text-sm font-medium hover:text-primary hover:underline"
      >
        {e.title || e.source_url}
        <ExternalLink className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span className="sr-only">(opens source)</span>
      </a>
      <p className="mt-1 text-sm leading-relaxed text-foreground/85">“{e.excerpt}”</p>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {PROVIDER_LABELS[e.provider] ?? e.provider} · {CATEGORY_META[e.category]?.label ?? e.category} · published {fmtDate(e.published_at)}
      </p>
    </li>
  );
}

/** Evidence links for a finding: shows cited records available in the snapshot, plus a count. */
export function Cited({ ids, index, max = 3 }: { ids: number[]; index: Record<string, ReportEvidence>; max?: number }) {
  const shown = ids.map((id) => index[String(id)]).filter(Boolean).slice(0, max);
  if (!ids.length) return <p className="text-xs text-muted-foreground">No supporting evidence.</p>;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">
        Backed by {ids.length} record{ids.length === 1 ? "" : "s"}
      </p>
      {shown.length > 0 && (
        <ul className="flex flex-col gap-2">
          {shown.map((e) => (
            <EvidenceQuote key={e.id} e={e} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function Panel({ title, children, className, aside }: { title: string; children: React.ReactNode; className?: string; aside?: React.ReactNode }) {
  return (
    <section className={cn("rounded-card border border-border bg-card p-5", className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}
