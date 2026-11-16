import { Check, ExternalLink, ThumbsDown, ThumbsUp, X } from "lucide-react";
import Link from "next/link";
import { PROVIDER_LABELS, fmtDate } from "@/components/evidence/EvidenceCard";
import { AiLabel, ConfidenceBadge } from "@/components/report/parts";
import { Button } from "@/components/ui/button";
import { SIGNAL_TYPES, basisLine, confidenceReason, level, scoresByKind } from "@/lib/radar";
import { cn, safeHref } from "@/lib/utils";
import type { Signal, SignalFeedback } from "@/types/radar";

export type SignalUpdate = { status?: "dismissed" | "acted"; feedback?: SignalFeedback };

function Meter({ label, value }: { label: string; value: number }) {
  const word = level(value);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      {label}
      <span className="inline-flex gap-0.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn("h-2 w-3 rounded-sm", i <= ["low", "medium", "high"].indexOf(word) ? "bg-primary" : "bg-muted")}
          />
        ))}
      </span>
      <span className="font-medium text-foreground">{word}</span>
    </span>
  );
}

/**
 * One Radar signal. Source text (titles, excerpts, competitor names) is rendered as plain text and links go
 * through safeHref. The rule-based facts come first; the AI rationale is optional, separate and labelled.
 */
export function SignalCard({
  s,
  projectId,
  highlighted,
  isNew,
  busy,
  error,
  onUpdate,
}: {
  s: Signal;
  projectId: string;
  highlighted?: boolean;
  /** New on this visit (the server may already have it as "seen"). */
  isNew?: boolean;
  busy?: boolean;
  error?: string;
  onUpdate?: (u: SignalUpdate) => void;
}) {
  const type = SIGNAL_TYPES[s.type];
  const open = s.status === "new" || s.status === "seen";
  const more = s.evidence_count - s.evidence.length;
  return (
    <li
      id={`signal-${s.id}`}
      tabIndex={-1}
      className={cn(
        "rounded-card border bg-card p-4",
        highlighted ? "border-primary ring-2 ring-primary/20" : "border-border",
        (isNew ?? s.status === "new") && "border-l-4 border-l-primary",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", type.className)}>{type.label}</span>
        <ConfidenceBadge level={s.confidence} />
        {(isNew ?? s.status === "new") && <span className="text-xs font-medium text-primary">New</span>}
        {s.status === "acted" && <span className="text-xs font-medium text-success-text">Acted on</span>}
        {s.status === "dismissed" && <span className="text-xs text-muted-foreground">Dismissed</span>}
        <span className="ml-auto text-xs text-muted-foreground">Found {fmtDate(s.discovered_at)}</span>
      </div>
      <h3 className="mt-2 break-words font-semibold">{s.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">Based on: {basisLine(s)}</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <Meter label="Relevance" value={s.relevance} />
        <Meter label="Impact" value={s.impact} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {scoresByKind(s)
          ? "Relevance and impact are set by the kind of signal, not measured."
          : "Relevance and impact are rule-based scores from the records below."}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{confidenceReason(s)}</p>
      {s.kind === "complaint_theme" && (
        <p className="mt-1 text-xs text-muted-foreground">The theme&apos;s name was written by AI; the counts come from the records.</p>
      )}

      {s.ai_rationale && (
        <div className="mt-3 rounded-control bg-ai/[0.06] p-3 text-sm">
          <AiLabel>AI view: why it may matter</AiLabel>
          <p className="mt-1.5">{s.ai_rationale}</p>
          {s.ai_action && (
            <p className="mt-1 text-muted-foreground">
              <span className="font-medium text-foreground">Suggested next step: </span>
              {s.ai_action}
            </p>
          )}
        </div>
      )}

      {s.evidence.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-medium text-primary">
            Evidence ({s.evidence_count} record{s.evidence_count === 1 ? "" : "s"})
          </summary>
          <ul className="mt-2 space-y-2">
            {s.evidence.map((e) => {
              const href = safeHref(e.source_url);
              return (
                <li key={e.id} className="rounded-control border border-border p-2.5">
                  <p className="break-words">{e.excerpt}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {PROVIDER_LABELS[e.provider] ?? e.provider}
                    {e.published_at ? ` · ${fmtDate(e.published_at)}` : " · date not given"}
                    {href && (
                      <>
                        {" · "}
                        <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline">
                          Source<span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      </>
                    )}
                  </p>
                </li>
              );
            })}
          </ul>
          {more > 0 && (
            <p className="mt-2 text-xs">
              {more} more record{more === 1 ? "" : "s"} behind this signal.{" "}
              <Link href={`/evidence?project=${projectId}`} className="text-primary underline">
                See all project evidence
              </Link>
            </p>
          )}
        </details>
      )}
      {s.change && (
        <p className="mt-3 text-sm">
          <Link href={`/projects/${projectId}/monitoring?change=${s.change.id}`} className="font-medium text-primary underline">
            See the change
          </Link>
          {safeHref(s.change.page) && (
            <>
              {" · "}
              <a href={safeHref(s.change.page)} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline">
                Open the page <ExternalLink className="inline size-3" aria-hidden />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </>
          )}
        </p>
      )}
      {s.candidate && safeHref(s.candidate.launch_post) && (
        <p className="mt-3 text-sm">
          <a href={safeHref(s.candidate.launch_post)} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline">
            Launch post for {s.candidate.name}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      )}

      {onUpdate && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          {open && (
            <>
              <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => onUpdate({ status: "acted" })}>
                <Check aria-hidden /> Mark as acted on
              </Button>
              <Button variant="ghost" className="min-h-11" disabled={busy} onClick={() => onUpdate({ status: "dismissed" })}>
                <X aria-hidden /> Dismiss
              </Button>
            </>
          )}
          <span role="group" aria-label="Was this signal useful?" className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <span aria-hidden>Useful?</span>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Useful signal"
              aria-pressed={s.feedback === "useful"}
              disabled={busy}
              onClick={() => onUpdate({ feedback: s.feedback === "useful" ? "" : "useful" })}
              className={cn("size-11", s.feedback === "useful" && "text-success-text")}
            >
              <ThumbsUp aria-hidden />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Not a useful signal"
              aria-pressed={s.feedback === "not_useful"}
              disabled={busy}
              onClick={() => onUpdate({ feedback: s.feedback === "not_useful" ? "" : "not_useful" })}
              className={cn("size-11", s.feedback === "not_useful" && "text-destructive-text")}
            >
              <ThumbsDown aria-hidden />
            </Button>
          </span>
          {error && (
            <p role="alert" className="w-full text-sm text-destructive-text">
              {error}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
