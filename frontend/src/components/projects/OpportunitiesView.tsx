"use client";

import { ArrowRight, GitCompareArrows } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects } from "@/hooks/useProjects";
import type { Project } from "@/types/api";

const RECOMMENDATION = { build: "Build", research_more: "Research more", pivot: "Pivot" } as const;
const CONFIDENCE_STYLE = {
  high: "bg-success/10 text-success-text",
  medium: "bg-warning/10 text-warning-text",
  low: "bg-muted text-muted-foreground",
} as const;

/** Researched ideas ranked by opportunity score: scored first (highest first), unscored after, never shown as 0. */
export function rankOpportunities(projects: Project[]): Project[] {
  return projects
    .filter((p) => p.status === "COMPLETED")
    .sort((a, b) => (b.progress?.score ?? -1) - (a.progress?.score ?? -1) || a.name.localeCompare(b.name));
}

export function OpportunitiesView() {
  const q = useProjects({ status: "COMPLETED" });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Opportunities</h1>
          <p className="mt-1 text-muted-foreground">
            Your researched ideas by opportunity score, with how sure each score is. Open one to see what makes up its score.
          </p>
        </div>
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/projects/compare">
            <GitCompareArrows aria-hidden /> Compare ideas
          </Link>
        </Button>
      </header>

      {q.isPending ? (
        <Skeleton className="h-64" />
      ) : q.isError ? (
        <ErrorState title="Couldn't load your opportunities" onRetry={() => q.refetch()} />
      ) : rankOpportunities(q.data.results).length === 0 ? (
        <EmptyState
          title="No researched ideas yet"
          body="Each finished research report scores its idea from the evidence. Run your first one to see it here."
          actionHref="/research/new"
          actionLabel="Start new research"
        />
      ) : (
        <section aria-labelledby="opps-h" className="rounded-card border border-border bg-card p-5 sm:p-6">
          <h2 id="opps-h" className="sr-only">
            Ideas ranked by score
          </h2>
          <ol className="divide-y divide-border">
            {rankOpportunities(q.data.results).map((p, i) => {
              const pr = p.progress;
              const score = pr?.score ?? null;
              return (
                <li key={p.id} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 py-4 sm:grid-cols-[auto_minmax(0,1fr)_12rem_auto]">
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold tabular-nums text-primary">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <Link href={`/projects/${p.id}`} className="-my-1 inline-block py-1 font-medium hover:text-primary hover:underline">
                      {p.name}
                    </Link>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      {pr?.confidence && (
                        <span className={`rounded-full px-2 py-0.5 font-medium ${CONFIDENCE_STYLE[pr.confidence]}`}>
                          {pr.confidence[0].toUpperCase() + pr.confidence.slice(1)} confidence
                        </span>
                      )}
                      {pr?.recommendation && <span>Recommendation: {RECOMMENDATION[pr.recommendation]}</span>}
                    </p>
                  </div>
                  <div className="col-span-2 flex items-center gap-3 sm:col-span-1">
                    {score === null ? (
                      <span className="text-sm italic text-muted-foreground">Not scored</span>
                    ) : (
                      <>
                        <span className="w-14 text-right text-lg font-semibold tabular-nums">{score}</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                          <span className="block h-full rounded-full bg-primary" style={{ width: `${score}%` }} />
                        </span>
                        <span className="sr-only">{score} out of 100</span>
                      </>
                    )}
                  </div>
                  <Link
                    href={`/projects/${p.id}/report?tab=market-gaps`}
                    className="col-span-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline sm:col-span-1 sm:justify-self-end"
                  >
                    Score breakdown <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ol>
          <p className="mt-2 text-xs text-muted-foreground">
            Scores compare fairly only when their confidence is similar: a higher score on low confidence isn&apos;t a better idea
            yet.
          </p>
        </section>
      )}
    </div>
  );
}
