import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({ title, body, onRetry }: { title: string; body?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-card border border-destructive/30 bg-card p-6">
      <p className="flex items-center gap-2 font-medium text-destructive">
        <AlertTriangle size={16} aria-hidden />
        {title}
      </p>
      {body && <p className="mt-1 text-sm text-muted-foreground">{body}</p>}
      {onRetry && (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          <RotateCw aria-hidden />
          Try again
        </Button>
      )}
    </div>
  );
}
