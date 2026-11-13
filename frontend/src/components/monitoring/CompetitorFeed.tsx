"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ChangeCard } from "@/components/monitoring/ChangeCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects } from "@/hooks/useProjects";
import { api } from "@/services/api";

/** Recent competitor changes across all your projects, with links to each project's monitoring page. */
export function CompetitorFeed() {
  const [page, setPage] = useState(1);
  const feed = useQuery({ queryKey: ["monitoring-feed", page], queryFn: () => api.monitoringFeed(page), placeholderData: keepPreviousData });
  const qc = useQueryClient();
  const projects = useProjects();
  // Completed and partially completed research both have usable reports (rule 4).
  const researched = (projects.data?.results ?? []).filter((p) => p.status !== "DRAFT" && p.status !== "RESEARCHING");
  const seen = useMutation({
    mutationFn: ({ projectId, id }: { projectId: string; id: number }) => api.markChangeSeen(projectId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monitoring-feed"] }),
  });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Competitors</h1>
        <p className="mt-1 text-muted-foreground">What changed on the competitor pages you watch, across all your ideas.</p>
      </header>
      {researched.length > 0 && (
        <nav aria-label="Monitoring by project" className="flex flex-wrap gap-2">
          {researched.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}/monitoring`}
              title={p.name}
              className="flex min-h-11 max-w-[18rem] items-center rounded-full border border-border px-3 text-sm hover:border-primary hover:text-primary"
            >
              <span className="truncate">{p.name}</span>
            </Link>
          ))}
        </nav>
      )}
      {feed.isPending ? (
        <div aria-busy="true">
          <span className="sr-only">Loading changes</span>
          <Skeleton className="h-48" />
        </div>
      ) : feed.isError ? (
        <ErrorState title="Couldn't load competitor changes" onRetry={() => feed.refetch()} />
      ) : feed.data.results.length === 0 ? (
        researched.length > 0 ? (
          <EmptyState
            title="No changes yet"
            body="Open one of your projects above and watch a competitor's pricing page. Changes show up here after the next check."
          />
        ) : (
          <EmptyState
            title="No changes yet"
            body="Research an idea first, then watch its competitors' pricing pages from the project's Monitoring page."
            actionHref="/research/new"
            actionLabel="+ New research"
          />
        )
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {feed.data.results.map((c) => (
              <ChangeCard
                key={c.id}
                c={c}
                showProject
                onSeen={c.project ? () => seen.mutate({ projectId: c.project!.id, id: c.id }) : undefined}
              />
            ))}
          </ul>
          {(feed.data.previous || feed.data.next) && (
            <div className="flex gap-2">
              <Button variant="outline" disabled={!feed.data.previous} onClick={() => setPage((p) => p - 1)}>
                Newer
              </Button>
              <Button variant="outline" disabled={!feed.data.next} onClick={() => setPage((p) => p + 1)}>
                Older
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
