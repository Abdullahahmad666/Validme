import { CheckCircle2, HelpCircle, Loader2, RotateCw } from "lucide-react";
import { AISuggestedBadge } from "@/components/shared/AISuggestedBadge";
import { Button } from "@/components/ui/button";
import type { Interpretation } from "@/types/api";

/** "How we understood it": the AI restatement, kept apart from the founder's words. */
export function InterpretationCard({
  interpretation,
  confirmed,
  onConfirm,
  onRetry,
  retrying,
  compact = false,
}: {
  interpretation: Interpretation;
  confirmed: boolean;
  onConfirm?: () => void;
  onRetry?: () => void;
  retrying?: boolean;
  compact?: boolean;
}) {
  const rows: [string, React.ReactNode][] = [
    ["Problem", interpretation.problem],
    ["Solution", interpretation.solution],
    ["Customers", interpretation.target_customers.join(", ") || "—"],
    ["Category", interpretation.category],
  ];
  return (
    <section aria-labelledby="interpretation-title" className="rounded-card border border-ai/25 bg-ai/[0.03] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="interpretation-title" className="font-semibold">
          How we understood it
        </h2>
        {confirmed ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success-text">
            <CheckCircle2 className="size-3.5" aria-hidden />
            Confirmed by you
          </span>
        ) : (
          <AISuggestedBadge />
        )}
      </div>
      <dl className="mt-4 grid grid-cols-[96px_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {!compact && interpretation.assumptions.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium">Assumptions research will test</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-foreground/85">
            {interpretation.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}
      {!compact && interpretation.clarifying_questions.length > 0 && (
        <div className="mt-4 rounded-control bg-card p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <HelpCircle className="size-4 text-warning-text" aria-hidden />
            Worth clarifying in your description
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {interpretation.clarifying_questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}
      {(onConfirm || onRetry) && (
        <div className="mt-5 flex flex-wrap gap-2">
          {onConfirm && !confirmed && (
            <Button type="button" onClick={onConfirm}>
              <CheckCircle2 aria-hidden />
              Looks right
            </Button>
          )}
          {onRetry && (
            <Button type="button" variant="outline" onClick={onRetry} disabled={retrying}>
              {retrying ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCw aria-hidden />}
              Try again
            </Button>
          )}
        </div>
      )}
      {!compact && (
        <p className="mt-4 text-xs text-muted-foreground">
          Not quite right? Edit your description above and try again. Your own words are never rewritten.
        </p>
      )}
    </section>
  );
}
