/** Shared markers so every form says which fields are required and which are optional. */
export function RequiredMark() {
  return (
    <>
      <span aria-hidden className="-ml-1 text-destructive">
        *
      </span>
      <span className="sr-only">(required)</span>
    </>
  );
}

export function OptionalTag() {
  return (
    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-normal leading-none text-muted-foreground">
      Optional
    </span>
  );
}

/** One line under a step's heading: what the asterisk means. */
export function RequiredLegend({ className }: { className?: string }) {
  return (
    <p className={className ?? "mt-1 text-xs text-muted-foreground"}>
      Fields marked <span className="text-destructive">*</span> are required.
    </p>
  );
}
