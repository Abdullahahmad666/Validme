"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { MetricCard } from "@/components/shared/MetricCard";
import { ProjectCard, ProjectCardSkeleton } from "@/components/shared/ProjectCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDashboardSummary, useProjects } from "@/hooks/useProjects";
import { useMe } from "@/hooks/useSession";

export function DashboardView() {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const me = useMe();
  const summary = useDashboardSummary();
  const projects = useProjects();
  const recent = projects.data?.results.slice(0, 4) ?? [];

  function startResearch(e: React.FormEvent) {
    e.preventDefault();
    const q = idea.trim() ? `?idea=${encodeURIComponent(idea.trim())}` : "";
    router.push(`/research/new${q}`);
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold">
          Welcome back{me.data?.first_name ? `, ${me.data.first_name}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">Here&apos;s your market research overview.</p>
      </header>

      {summary.isError ? (
        <ErrorState title="Couldn't load your usage numbers" onRetry={() => summary.refetch()} />
      ) : (
        <section aria-label="Usage" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <MetricCard label="Research projects" value={summary.data?.projects ?? null} loading={summary.isPending} />
          <MetricCard label="Reports generated" value={summary.data?.reports ?? null} loading={summary.isPending} />
          <MetricCard label="Evidence records" value={summary.data?.evidence ?? null} loading={summary.isPending} />
          <MetricCard label="Active jobs" value={summary.data?.active_jobs ?? null} loading={summary.isPending} />
        </section>
      )}

      <form onSubmit={startResearch} className="rounded-card border border-border bg-card p-6">
        <Label htmlFor="new-idea" className="text-base font-medium">
          Have a new idea?
        </Label>
        <p className="mt-1 text-sm text-muted-foreground">
          Discover demand, analyze competitors and find your first customers.
        </p>
        <Textarea
          id="new-idea"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="e.g. A tool that helps independent restaurants track inventory and reduce food waste."
          className="mt-4"
        />
        <Button type="submit" className="mt-4">
          + New research
        </Button>
      </form>

      <section aria-labelledby="recent-projects" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 id="recent-projects" className="text-base font-medium">
            Recent projects
          </h2>
          {(projects.data?.count ?? 0) > recent.length && (
            <Link href="/projects" className="text-sm font-medium text-primary hover:underline">
              View all ({projects.data?.count})
            </Link>
          )}
        </div>
        {projects.isPending ? (
          <div className="grid gap-4 md:grid-cols-2">
            <ProjectCardSkeleton />
            <ProjectCardSkeleton />
          </div>
        ) : projects.isError ? (
          <ErrorState title="Couldn't load your projects" onRetry={() => projects.refetch()} />
        ) : recent.length === 0 ? (
          <EmptyState
            title="No research projects yet"
            body="Describe an idea, confirm your market, pick sources, and we'll collect evidence with a link to every source."
            actionHref="/research/new"
            actionLabel="Start your first research"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {recent.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
