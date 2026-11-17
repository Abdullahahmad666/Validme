import { AlertTriangle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type SlugCheck = { state: "idle" } | { state: "available" } | { state: "taken"; reason: string } | { state: "error" };

/** Under the web-address field: availability with an icon + text, announced politely when it changes. */
export function SlugHint({ id, live, check }: { id: string; live: boolean; check: SlugCheck }) {
  const bad = !live && (check.state === "taken" || check.state === "error");
  return (
    <p id={id} aria-live="polite" className={cn("flex items-start gap-1 text-xs", bad ? "text-destructive-text" : "text-muted-foreground")}>
      {live ? (
        "Unpublish to change the address (links people have would break)."
      ) : check.state === "available" ? (
        <>
          <Check className="mt-px size-3.5 shrink-0 text-success-text" aria-hidden /> Available
        </>
      ) : check.state === "taken" ? (
        <>
          <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden /> {check.reason}
        </>
      ) : check.state === "error" ? (
        <>
          <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden /> Couldn&apos;t check the address. It&apos;s checked again when you save.
        </>
      ) : (
        "Lowercase letters, numbers and hyphens."
      )}
    </p>
  );
}
