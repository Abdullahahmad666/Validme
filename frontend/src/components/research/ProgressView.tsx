"use client";

import { AlertTriangle, Ban, CheckCircle2, ChevronRight, Clock, Loader2, MinusCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useLatestJob, useProject, useSources } from "@/hooks/useResearch";
import { STAGE_LABELS } from "@/lib/wizard";
import { cn } from "@/lib/utils";
import type { CoverageStatus, JobStatus, StageStatus } from "@/types/api";

const STAGE: Record<StageStatus, { label: string; icon: typeof Clock; className: string; spin?: boolean }> = {
  QUEUED: { label: "Queued", icon: Clock, className: "text-muted-strong" },
  PROCESSING: { label: "Processing", icon: Loader2, className: "text-primary", spin: true },
  COMPLETED: { label: "Complete", icon: CheckCircle2, className: "text-success-text" },
  FAILED: { label: "Failed", icon: XCircle, className: "text-destructive-text" },
  SKIPPED: { label: "Skipped", icon: MinusCircle, className: "text-muted-strong" },
};

const COVERAGE: Record<CoverageStatus, { label: string; icon: typeof Clock; className: string }> = {
  COMPLETED: { label: "Searched", icon: CheckCircle2, className: "text-success-text" },
  FAILED: { label: "Failed", icon: XCircle, className: "text-destructive-text" },
  UNAVAILABLE: { label: "Unavailable", icon: Ban, className: "text-muted-strong" },
  SKIPPED: { label: "Nothing to read", icon: MinusCircle, className: "text-muted-strong" },
};

const HEADLINE: Record<JobStatus, string> = {
  PENDING: "Research is queued",
  RUNNING: "Research in progress",
  COMPLETED: "Research complete",
  PARTIALLY_COMPLETED: "Research finished with gaps",
  FAILED: "Research didn't complete",
  CANCELLED: "Research cancelled",
};

/** Real backend stages and per-source coverage. No elapsed-time percentages. */
export function ProgressView({ projectId }: { projectId: string }) {
  const project = useProject(projectId);
  const job = useLatestJob(projectId);
  const sources = useSources();
  const label = (key: string) => sources.data?.results.find((s) => s.key === key)?.label ?? key.replace(/_/g, " ");

  if (project.isPending || job.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-72" />
      </div>
    );
  }
  if (project.isError || job.isError) {
    return <ErrorState title="Couldn't load this research" onRetry={() => (project.refetch(), job.refetch())} />;
  }
  const j = job.data;
  if (!j) {
    return (
      <EmptyState
        title="No research launched yet"
        body="Finish the setup to launch research on this idea. Drafts are free."
        actionHref={`/research/new?project=${projectId}`}
        actionLabel="Continue setup"
      />
    );
  }
  const running = j.status === "PENDING" || j.status === "RUNNING";
  const failedSources = Object.entries(j.coverage).filter(([, v]) => v === "FAILED").map(([k]) => label(k));

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <li>
            <Link href="/projects" className="hover:text-foreground">
              My projects
            </Link>
          </li>
          <ChevronRight className="size-3.5" aria-hidden />
          <li aria-current="page" className="max-w-[16rem] truncate font-medium text-foreground">
            {project.data.name}
          </li>
        </ol>
      </nav>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{HEADLINE[j.status]}</h1>
        <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
          {running
            ? "You can leave this page. Progress is saved and updates here as each stage finishes."
            : `${j.depth[0].toUpperCase()}${j.depth.slice(1)} depth · ${j.credits_charged} credit${j.credits_charged === 1 ? "" : "s"} used`}
        </p>
      </header>

      {j.status === "PARTIALLY_COMPLETED" && failedSources.length > 0 && (
        <p className="flex items-start gap-2 rounded-control border border-warning/30 bg-warning/[0.06] p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-text" aria-hidden />
          {failedSources.join(", ")} couldn&apos;t be searched. Everything else ran, and results will say what&apos;s missing.
        </p>
      )}
      {j.status === "FAILED" && (
        <p className="flex items-start gap-2 rounded-control border border-destructive/30 bg-destructive/[0.05] p-3 text-sm">
          <XCircle className="mt-0.5 size-4 shrink-0 text-destructive-text" aria-hidden />
          No source returned results. The project is back in draft so you can adjust sources or queries.
          <Link href={`/research/new?project=${projectId}&step=3`} className="font-medium text-primary underline">
            Adjust setup
          </Link>
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="stages-title" className="rounded-card border border-border bg-card p-5">
          <h2 id="stages-title" className="font-semibold">
            Stages
          </h2>
          <ol className="mt-4 flex flex-col">
            {j.stages.map((s, i) => {
              const st = STAGE[s.status];
              return (
                <li key={s.name} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < j.stages.length - 1 && <span className="absolute left-[11px] top-7 h-[calc(100%-1.5rem)] w-px bg-border" aria-hidden />}
                  <st.icon className={cn("relative mt-0.5 size-6 shrink-0 rounded-full bg-card", st.className, st.spin && "motion-safe:animate-spin")} aria-hidden />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <span className="font-medium">{STAGE_LABELS[s.name]}</span>
                      <span className={cn("text-xs font-medium", st.className)}>{st.label}</span>
                    </p>
                    {s.detail && <p className="mt-0.5 text-sm text-muted-foreground">{s.detail}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <aside aria-labelledby="coverage-title" className="rounded-card border border-border bg-card p-5">
          <h2 id="coverage-title" className="font-semibold">
            Source coverage
          </h2>
          {Object.keys(j.coverage).length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{running ? "Appears as sources finish." : "No sources ran."}</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2.5 text-sm">
              {Object.entries(j.coverage).map(([key, status]) => {
                const c = COVERAGE[status];
                return (
                  <li key={key} className="flex items-center justify-between gap-3">
                    <span>{label(key)}</span>
                    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", c.className)}>
                      <c.icon className="size-3.5" aria-hidden />
                      {c.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {!running && (
            <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
              Evidence is stored with its source link and dates. Classification, the evidence explorer and the opportunity
              report arrive in the next releases.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
