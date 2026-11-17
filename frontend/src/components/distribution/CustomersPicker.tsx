"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { fmtDate } from "@/components/evidence/EvidenceCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects } from "@/hooks/useProjects";

/** Sidebar entry "Audience & distribution": pick an idea to see where to find its customers. */
export function CustomersPicker() {
  const projects = useProjects();
  // Completed and partially completed research both have usable reports (rule 4).
  const researched = (projects.data?.results ?? []).filter((p) => p.status !== "DRAFT" && p.status !== "RESEARCHING");
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Where to find your customers</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          For each researched idea: where your audience already talks, YouTube channels they watch, how many people search
          for it, and experiments for your first 10 customers.
        </p>
      </header>
      {projects.isPending ? (
        <Skeleton className="h-32" aria-busy="true" />
      ) : projects.isError ? (
        <ErrorState title="Couldn't load your projects" onRetry={() => projects.refetch()} />
      ) : researched.length === 0 ? (
        <EmptyState title="No researched ideas yet" body="Run research on an idea first: this page uses its evidence and queries." actionHref="/research/new" actionLabel="New research" />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-card">
          {researched.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projects/${p.id}/customers`}
                className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground">Updated {fmtDate(p.updated_at)}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
