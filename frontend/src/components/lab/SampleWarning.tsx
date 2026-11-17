import { AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SampleNote } from "@/types/lab";

/** The server's own sample-size message, with an icon and text (never colour alone). Nothing shown when there's no data. */
export function SampleWarning({ sample, className }: { sample: SampleNote; className?: string }) {
  if (sample.level === "none") return null;
  const warn = sample.level === "too_small" || sample.level === "small";
  return (
    <p
      className={cn(
        "mt-2 flex items-start gap-1.5 rounded-control p-2 text-sm",
        warn ? "bg-warning/10 text-warning-text" : "bg-muted/50 text-muted-foreground",
        className,
      )}
    >
      {warn ? <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> : <Info className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <span>
        <span className="sr-only">{warn ? "Small sample: " : "Sample size: "}</span>
        {sample.message}
      </span>
    </p>
  );
}
