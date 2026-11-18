import { CheckCircle2, CircleHelp, FlaskConical, XCircle } from "lucide-react";
import { VERDICT_MAJORITY_PCT, VERDICT_MIN_ANSWERS } from "@/lib/apiScopes";
import { cn } from "@/lib/utils";
import type { Assumption } from "@/types/report";

const VERDICT = {
  supported: { label: "Supported by your survey", icon: CheckCircle2, style: "text-success-text" },
  contradicted: { label: "Contradicted by your survey", icon: XCircle, style: "text-destructive-text" },
  inconclusive: { label: "Survey inconclusive so far", icon: CircleHelp, style: "text-muted-foreground" },
} as const;

/**
 * What the founder's own survey answers say about an assumption (tier 1), with the counts behind it. Kept apart from
 * the founder's status: it's shown even when they overrode it.
 */
export function ExperimentVerdict({ a, className }: { a: Pick<Assumption, "auto_status" | "auto_refs">; className?: string }) {
  if (!a.auto_status) return null;
  const V = VERDICT[a.auto_status];
  return (
    <div className={cn("rounded-control bg-muted/50 p-2 text-sm", className)}>
      <p className={cn("flex items-center gap-1.5 font-medium", V.style)}>
        <FlaskConical className="size-4 shrink-0" aria-hidden />
        <V.icon className="size-4 shrink-0" aria-hidden />
        {V.label}
      </p>
      <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
        {a.auto_refs.map((r) => (
          <li key={`${r.survey_id}-${r.question_id}`}>
            {r.late_rule && (
              <span className="mr-1 rounded-full bg-warning/10 px-1.5 py-0.5 font-semibold text-warning-text">Advisory: changed after answers</span>
            )}
            {r.ai_drafted && <span className="mr-1 rounded-full bg-ai/10 px-1.5 py-0.5 font-semibold text-ai">AI-drafted question</span>}
            {r.basis}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-muted-foreground">
        Supported when the whole 95% range of supporting answers is above {VERDICT_MAJORITY_PCT}%, contradicted when it&apos;s
        all below, with at least {VERDICT_MIN_ANSWERS} answers. Answers without an email can&apos;t be told apart, so one person
        could answer more than once.
      </p>
    </div>
  );
}
