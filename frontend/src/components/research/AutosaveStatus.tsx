import { AlertCircle, Check, Cloud, Loader2 } from "lucide-react";
import type { SaveState } from "@/hooks/useAutosave";

/** Saving / Saved / Save failed, as icon + text (never colour only). */
export function AutosaveStatus({ state, onRetry }: { state: SaveState; onRetry?: () => void }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status" aria-live="polite">
      {state === "saving" || state === "pending" ? (
        <>
          <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden />
          Saving…
        </>
      ) : state === "saved" ? (
        <>
          <Check className="size-3.5 text-success" aria-hidden />
          Saved
        </>
      ) : state === "error" ? (
        <>
          <AlertCircle className="size-3.5 text-destructive" aria-hidden />
          <span className="text-destructive">Save failed.</span>
          {onRetry && (
            <button type="button" onClick={onRetry} className="font-medium text-primary underline-offset-2 hover:underline">
              Retry
            </button>
          )}
        </>
      ) : (
        <>
          <Cloud className="size-3.5" aria-hidden />
          Drafts save automatically
        </>
      )}
    </p>
  );
}
