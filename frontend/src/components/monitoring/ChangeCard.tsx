import { ExternalLink, Eye, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { fmtDate } from "@/components/evidence/EvidenceCard";
import { AiLabel } from "@/components/report/parts";
import { Button } from "@/components/ui/button";
import { cn, safeHref } from "@/lib/utils";
import type { Change, Significance } from "@/types/monitoring";

export const SIGNIFICANCE: Record<Significance, { label: string; className: string }> = {
  high: { label: "High", className: "bg-destructive/10 text-destructive-text" },
  medium: { label: "Medium", className: "bg-warning/10 text-warning-text" },
  low: { label: "Low", className: "bg-muted text-muted-strong" },
};

/**
 * One detected change. Everything here that came from a competitor's page (prices, text blocks, URL,
 * label) is rendered as plain text; links go through safeHref. The AI summary is separate and labelled.
 */
export function ChangeCard({
  c,
  highlighted,
  onSeen,
  showProject,
}: {
  c: Change;
  highlighted?: boolean;
  onSeen?: () => void;
  showProject?: boolean;
}) {
  const d = c.details ?? {};
  const href = safeHref(c.after_url) ?? safeHref(c.watch.url); // unsafe redirect target → the watched page
  const added = d.blocks_added ?? [];
  const removed = d.blocks_removed ?? [];
  return (
    <li
      id={`change-${c.id}`}
      tabIndex={-1}
      className={cn(
        "rounded-card border bg-card p-4",
        highlighted ? "border-primary ring-2 ring-primary/20" : "border-border",
        !c.seen && "border-l-4 border-l-primary",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", SIGNIFICANCE[c.significance].className)}>
              {SIGNIFICANCE[c.significance].label}
            </span>
            <span className="min-w-0 break-words">{c.watch.label || c.watch.url}</span>
            {!c.seen && <span className="text-xs font-normal text-primary">New</span>}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Detected {fmtDate(c.detected_at)}
            {c.before_at ? ` · compared with the read from ${fmtDate(c.before_at)}` : ""}
            {showProject && c.project && (
              <>
                {" · "}
                <Link href={`/projects/${c.project.id}/monitoring?change=${c.id}`} className="hover:underline">
                  {c.project.name}
                </Link>
              </>
            )}
          </p>
        </div>
        {onSeen && !c.seen && (
          <Button variant="ghost" onClick={onSeen} aria-label={`Mark the change to ${c.watch.label || c.watch.url} as seen`}>
            <Eye aria-hidden /> Mark seen
          </Button>
        )}
      </div>

      <p className="mt-3 text-sm">{c.summary}</p>
      {c.ai_summary && (
        <div className="mt-2 rounded-control bg-ai/[0.06] p-3 text-sm">
          <AiLabel>AI summary of the diff</AiLabel>
          <p className="mt-1.5">{c.ai_summary}</p>
          {c.ai_watch_for && <p className="mt-1 text-muted-foreground">{c.ai_watch_for}</p>}
        </div>
      )}

      {((d.prices_added?.length ?? 0) > 0 || (d.prices_removed?.length ?? 0) > 0) && (
        <ul className="mt-3 flex flex-wrap gap-1.5 text-xs" aria-label="Price changes">
          {(d.prices_added ?? []).map((p, i) => (
            <li key={`a-${i}-${p}`} className="rounded-full bg-success/10 px-2 py-0.5 text-success-text">
              <Plus className="mr-0.5 inline size-3" aria-hidden />
              <span className="sr-only">Now shown: </span>
              {p}
            </li>
          ))}
          {(d.prices_removed ?? []).map((p, i) => (
            <li key={`r-${i}-${p}`} className="rounded-full bg-muted px-2 py-0.5 text-muted-strong line-through">
              <Minus className="mr-0.5 inline size-3" aria-hidden />
              <span className="sr-only">No longer shown: </span>
              {p}
            </li>
          ))}
        </ul>
      )}

      {(added.length > 0 || removed.length > 0) && (
        <details className="mt-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-primary">
            Show text changes ({d.blocks_added_total ?? added.length} added, {d.blocks_removed_total ?? removed.length} removed)
          </summary>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Added</p>
              <ul className="mt-1 flex flex-col gap-1 text-sm">
                {added.map((b, i) => (
                  <li key={i} className="break-words rounded-control bg-success/[0.06] px-2 py-1">
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Removed</p>
              <ul className="mt-1 flex flex-col gap-1 text-sm">
                {removed.map((b, i) => (
                  <li key={i} className="break-words rounded-control bg-muted px-2 py-1 text-muted-strong">
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Up to 20 blocks each side are shown, exactly as read from the page.</p>
        </details>
      )}

      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm text-primary hover:underline"
        >
          Open the page <ExternalLink className="size-3.5" aria-hidden />
          <span className="sr-only">: {c.watch.label || c.watch.url} (opens in a new tab)</span>
        </a>
      )}
    </li>
  );
}
