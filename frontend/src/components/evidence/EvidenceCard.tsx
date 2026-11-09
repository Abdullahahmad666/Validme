import { Bookmark, BookmarkCheck, Copy, ExternalLink, Sparkles } from "lucide-react";
import { cn, safeHref } from "@/lib/utils";
import type { Evidence, EvidenceCategory } from "@/types/api";

export const CATEGORY_META: Record<EvidenceCategory, { label: string; className: string }> = {
  pain_point: { label: "Pain point", className: "bg-destructive/10 text-destructive-text" },
  buying_intent: { label: "Buying intent", className: "bg-success/10 text-success-text" },
  feature_request: { label: "Feature request", className: "bg-primary/10 text-primary" },
  alternative_seeking: { label: "Seeking alternatives", className: "bg-primary/10 text-primary" },
  pricing_objection: { label: "Pricing objection", className: "bg-warning/10 text-warning-text" },
  workaround: { label: "Workaround", className: "bg-warning/10 text-warning-text" },
  positive_feedback: { label: "Positive feedback", className: "bg-success/10 text-success-text" },
  irrelevant: { label: "Not relevant", className: "bg-muted text-muted-strong" },
  unclassified: { label: "Not classified", className: "bg-muted text-muted-strong" },
};

export const PROVIDER_LABELS: Record<string, string> = {
  web_search: "Web search",
  hackernews: "Hacker News",
  stackexchange: "Stack Exchange",
  user_urls: "Your link",
  competitor_pages: "Competitor page",
};

const dateFmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });
export const fmtDate = (d: string | null) => (d ? dateFmt.format(new Date(d)) : "Unknown");

export function CategoryBadge({ evidence }: { evidence: Evidence }) {
  const meta = CATEGORY_META[evidence.classification.category];
  const ai = evidence.classification.ai_classified;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", meta.className)}>
      {ai && <Sparkles className="size-3" aria-hidden />}
      {meta.label}
      {ai && <span className="sr-only">(AI classification)</span>}
    </span>
  );
}

export function SourceLink({ evidence, className }: { evidence: Evidence; className?: string }) {
  return (
    <a
      href={safeHref(evidence.source_url)}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={cn("inline-flex items-start gap-1 font-medium hover:text-primary hover:underline", className)}
    >
      <span>{evidence.title || evidence.source_url}</span>
      <ExternalLink className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span className="sr-only">(opens source in a new tab)</span>
    </a>
  );
}

/** Licence attribution (e.g. CC BY-SA for Stack Exchange) is part of the record, not optional. */
export function Attribution({ evidence }: { evidence: Evidence }) {
  if (!evidence.license && !evidence.author_name) return null;
  return (
    <span>
      {evidence.author_name &&
        (evidence.author_url ? (
          <a href={safeHref(evidence.author_url)} target="_blank" rel="noopener noreferrer nofollow" className="underline-offset-2 hover:underline">
            {evidence.author_name}
          </a>
        ) : (
          evidence.author_name
        ))}
      {evidence.license && <> · {evidence.license}</>}
    </span>
  );
}

export function SaveButton({ evidence, onToggle, busy }: { evidence: Evidence; onToggle: () => void; busy?: boolean }) {
  const saved = evidence.saved_by_user;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      aria-pressed={saved}
      className={cn(
        "inline-flex min-h-10 items-center gap-1.5 rounded-control px-3 text-sm font-medium transition-colors",
        saved ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {saved ? <BookmarkCheck className="size-4" aria-hidden /> : <Bookmark className="size-4" aria-hidden />}
      {saved ? "Saved" : "Save"}
    </button>
  );
}

export function EvidenceCard({ evidence, onToggleSave }: { evidence: Evidence; onToggleSave: () => void }) {
  const relevance = evidence.classification.relevance;
  return (
    <article className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium">
          {PROVIDER_LABELS[evidence.provider] ?? evidence.provider}
        </span>
        <CategoryBadge evidence={evidence} />
        {relevance !== null && (
          <span className="text-[11px] tabular-nums text-muted-foreground">Relevance {Math.round(relevance * 100)}%</span>
        )}
      </div>
      <SourceLink evidence={evidence} className="text-sm leading-snug" />
      <blockquote className="border-l-2 border-border pl-3 text-sm leading-relaxed text-foreground/85">{evidence.excerpt}</blockquote>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex flex-wrap gap-x-2">
          <span>Published {fmtDate(evidence.published_at)}</span>
          <span>Retrieved {fmtDate(evidence.retrieved_at)}</span>
          {evidence.duplicates > 0 && (
            <span className="inline-flex items-center gap-1">
              <Copy className="size-3" aria-hidden />
              {evidence.duplicates} duplicate{evidence.duplicates > 1 ? "s" : ""} merged
            </span>
          )}
          <Attribution evidence={evidence} />
        </span>
        <SaveButton evidence={evidence} onToggle={onToggleSave} />
      </div>
    </article>
  );
}
