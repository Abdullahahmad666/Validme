"use client";

import { AlertTriangle, ArrowRight, BadgeCheck, Bell, FileCheck2, FlaskConical, Loader2, Radar } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { planLabel } from "@/components/billing/BillingView";
import { fmtDate } from "@/components/evidence/EvidenceCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { MetricCard } from "@/components/shared/MetricCard";
import { ProjectCard, ProjectCardSkeleton } from "@/components/shared/ProjectCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDashboardSummary, useProjects } from "@/hooks/useProjects";
import { useMe } from "@/hooks/useSession";
import type { ActivityEvent, NextAction } from "@/types/api";

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
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            Welcome back{me.data?.first_name ? `, ${me.data.first_name}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">Here&apos;s your market research overview.</p>
        </div>
        {summary.data && (
          <Link
            href="/billing"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-3 text-sm hover:border-primary/40"
          >
            <BadgeCheck className="size-4 text-primary" aria-hidden />
            <span className="font-medium">{planLabel(summary.data.plan)} plan</span>
            <span className="text-muted-foreground">
              · {summary.data.credits} credit{summary.data.credits === 1 ? "" : "s"}
            </span>
          </Link>
        )}
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

      {summary.data && (summary.data.next_actions.length > 0 || summary.data.recent_activity.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          <NextActions actions={summary.data.next_actions} />
          <RecentActivity events={summary.data.recent_activity} />
        </div>
      )}
    </div>
  );
}

const ACTIVITY_ICON = { report: FileCheck2, failed: AlertTriangle, running: Loader2, change: Bell, signal: Radar, lab: FlaskConical } as const;
const ACTIVITY_WORD = { report: "Report", failed: "Failed", running: "Running", change: "Page change", signal: "Radar", lab: "Lab" } as const;

/** Rule-based suggestions from the state of your projects (not AI): each says why and where to do it. */
function NextActions({ actions }: { actions: NextAction[] }) {
  return (
    <section aria-labelledby="next-actions" className="rounded-card border border-border bg-card p-5">
      <h2 id="next-actions" className="text-base font-medium">
        Recommended next
      </h2>
      {actions.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nothing pressing. New suggestions appear as your projects change.</p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-border">
          {actions.map((a) => (
            <li key={`${a.project_id}-${a.title}`}>
              <Link href={a.link} className="group flex min-h-11 items-start justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block text-sm font-medium group-hover:text-primary">{a.title}</span>
                  <span className="block text-xs text-muted-foreground">{a.why}</span>
                </span>
                <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentActivity({ events }: { events: ActivityEvent[] }) {
  return (
    <section aria-labelledby="recent-activity" className="rounded-card border border-border bg-card p-5">
      <h2 id="recent-activity" className="text-base font-medium">
        Recent activity
      </h2>
      {events.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No activity yet. Research runs, page changes and Radar signals show up here.</p>
      ) : (
        <ol className="mt-3 flex flex-col gap-1">
          {events.map((e, i) => {
            const Icon = ACTIVITY_ICON[e.kind];
            return (
              <li key={`${e.kind}-${e.at}-${i}`}>
                <Link href={e.link} className="flex min-h-11 items-start gap-3 rounded-control px-1 py-2 hover:bg-muted/50">
                  <Icon className={e.kind === "failed" ? "mt-0.5 size-4 shrink-0 text-destructive-text" : "mt-0.5 size-4 shrink-0 text-primary"} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm">{e.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {ACTIVITY_WORD[e.kind]} · <time dateTime={e.at}>{fmtDate(e.at)}</time>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
