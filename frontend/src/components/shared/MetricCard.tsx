import { Skeleton } from "@/components/ui/skeleton";

/** `null` = unavailable (shows an em dash, never a made-up number). */
export function MetricCard({ label, value, loading }: { label: string; value: number | null; loading?: boolean }) {
  return (
    <div className="rounded-card border border-border bg-card p-5">
      {loading ? (
        <div role="status">
          <Skeleton className="h-9 w-14" />
          <span className="sr-only">Loading</span>
        </div>
      ) : (
        <p className="text-3xl font-semibold tabular-nums">
          {value ?? (
            <>
              <span aria-hidden>—</span>
              <span className="sr-only">Unavailable</span>
            </>
          )}
        </p>
      )}
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
