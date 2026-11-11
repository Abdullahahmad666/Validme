"use client";

import Link from "next/link";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { ProjectCard, ProjectCardSkeleton } from "@/components/shared/ProjectCard";
import { Button } from "@/components/ui/button";
import { useProjects } from "@/hooks/useProjects";

export function ProjectsView() {
  const projects = useProjects();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">My projects</h1>
          <p className="text-sm text-muted-foreground">
            {projects.data ? `${projects.data.count} project${projects.data.count === 1 ? "" : "s"}` : " "}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(projects.data?.count ?? 0) >= 2 && (
            <Button asChild variant="outline">
              <Link href="/projects/compare">Compare ideas</Link>
            </Button>
          )}
          <Button asChild>
            <Link href="/research/new">+ New research</Link>
          </Button>
        </div>
      </header>
      {projects.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ProjectCardSkeleton />
          <ProjectCardSkeleton />
          <ProjectCardSkeleton />
        </div>
      ) : projects.isError ? (
        <ErrorState title="Couldn't load your projects" onRetry={() => projects.refetch()} />
      ) : projects.data.results.length === 0 ? (
        <EmptyState
          title="No research projects yet"
          body="Start by describing an idea. Drafts are free and never use credits."
          actionHref="/research/new"
          actionLabel="Start your first research"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.data.results.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
