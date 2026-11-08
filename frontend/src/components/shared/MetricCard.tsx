export function MetricCard({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-card border border-border bg-card p-5">
      <p className="text-3xl font-semibold tabular-nums">{value ?? "—"}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
