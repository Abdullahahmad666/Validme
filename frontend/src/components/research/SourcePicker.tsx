"use client";

import { Ban, CheckCircle2, CircleDashed, Plug } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { useSources } from "@/hooks/useResearch";
import { SOURCE_GROUPS } from "@/lib/wizard";
import { cn } from "@/lib/utils";
import type { Availability, ResearchSource } from "@/types/api";

const STATE: Record<Availability, { label: string; icon: typeof CheckCircle2; className: string }> = {
  AVAILABLE: { label: "Available", icon: CheckCircle2, className: "text-success-text" },
  LIMITED: { label: "Limited", icon: CircleDashed, className: "text-warning-text" },
  REQUIRES_CONNECTION: { label: "Requires connection", icon: Plug, className: "text-muted-strong" },
  UNAVAILABLE: { label: "Unavailable", icon: Ban, className: "text-muted-strong" },
};

export const isUsable = (s: ResearchSource) => s.availability === "AVAILABLE" || s.availability === "LIMITED";

/** Source cards grouped by stage. Selected ≠ available: only usable sources can be ticked. */
export function SourcePicker({
  value,
  onChange,
  invalid,
}: {
  value: string[];
  onChange: (keys: string[]) => void;
  invalid?: boolean;
}) {
  const sources = useSources();
  if (sources.isPending) return <Skeleton className="h-48" />;
  if (sources.isError) return <ErrorState title="Couldn't load sources" onRetry={() => sources.refetch()} />;
  const all = sources.data.results;
  const unavailable = all.filter((s) => s.stage === null);

  return (
    <div className="flex flex-col gap-5" aria-invalid={invalid || undefined}>
      {SOURCE_GROUPS.map((g) => {
        const group = all.filter((s) => s.stage === g.stage);
        if (!group.length) return null;
        return (
          <fieldset key={g.stage} className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold">{g.title}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {group.map((s) => {
                const usable = isUsable(s);
                const checked = usable && value.includes(s.key);
                const state = STATE[s.availability];
                return (
                  <label
                    key={s.key}
                    className={cn(
                      "flex min-h-11 cursor-pointer gap-3 rounded-control border p-3.5 transition-colors",
                      checked ? "border-primary bg-primary/[0.04]" : "border-border",
                      !usable && "cursor-not-allowed bg-muted/40",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]"
                      checked={checked}
                      disabled={!usable}
                      onChange={(e) => onChange(e.target.checked ? [...value, s.key] : value.filter((k) => k !== s.key))}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{s.label}</span>
                      <span className="block text-xs leading-relaxed text-muted-foreground">{s.contributes}</span>
                      <span className={cn("mt-1 inline-flex items-center gap-1 text-xs font-medium", state.className)}>
                        <state.icon className="size-3.5" aria-hidden />
                        {state.label}
                      </span>
                      {!s.uses_queries && usable && (
                        <span className="block text-xs text-muted-foreground">Reads the links you add below.</span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}
      {unavailable.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Not searched: {unavailable.map((s) => s.label).join(", ")}. These need licensed data, so every report lists
          them as not covered.
        </p>
      )}
    </div>
  );
}
