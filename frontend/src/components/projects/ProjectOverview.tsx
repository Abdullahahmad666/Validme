"use client";

import { BarChart3, ChevronRight, FileText, FlaskConical, Loader2, Radar, ScanEye, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DeleteProjectDialog } from "@/components/projects/DeleteProjectDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { StagesCovered } from "@/components/shared/ProjectCard";
import { StatusPill } from "@/components/shared/StatusPill";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProject } from "@/hooks/useResearch";
import { ApiError } from "@/services/api";
import type { Project } from "@/types/api";

const RECOMMENDATION = { build: "Build", research_more: "Research more", pivot: "Pivot" } as const;

function tools(p: Project) {
  const base = `/projects/${p.id}`;
  const researched = p.status === "COMPLETED";
  return [
    { href: `${base}/report`, label: "Report", body: "Demand, pain points, competitors, gaps and your first-10 plan.", icon: FileText, ready: researched },
    { href: `${base}/progress`, label: "Research progress", body: "Stages and what each source found.", icon: Loader2, ready: p.status !== "DRAFT" },
    { href: `${base}/lab`, label: "Validation Lab", body: "Test pages, surveys, price tests and predicted vs actual.", icon: FlaskConical, ready: researched },
    { href: `${base}/radar`, label: "Opportunity Radar", body: "Signals worth a closer look, and score over time.", icon: Radar, ready: researched },
    { href: `${base}/monitoring`, label: "Monitoring", body: "Watch competitor pages for price and content changes.", icon: ScanEye, ready: researched },
    { href: `${base}/customers`, label: "Where to find customers", body: "Channels, YouTube and search demand.", icon: Users, ready: researched },
  ];
}

/** /projects/[id]: one place to see where a project stands and open each of its tools. */
export function ProjectOverview({ projectId }: { projectId: string }) {
  const q = useProject(projectId);
  if (q.isError && q.error instanceof ApiError && q.error.status === 404) {
    return <EmptyState title="Project not found" body="It may have been deleted, or it belongs to another account." actionHref="/projects" actionLabel="My projects" />;
  }
  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <Link href="/projects" className="inline-flex min-h-11 items-center hover:text-foreground">
              My projects
            </Link>
            <ChevronRight className="size-3.5" aria-hidden />
          </li>
          <li aria-current="page" className="max-w-[16rem] truncate font-medium text-foreground">
            {q.data?.name ?? "Project"}
          </li>
        </ol>
      </nav>
      {q.isPending ? (
        <Skeleton className="h-72" aria-busy="true" />
      ) : q.isError ? (
        <ErrorState title="Couldn't load the project" onRetry={() => q.refetch()} />
      ) : (
        <Overview p={q.data} />
      )}
    </div>
  );
}

function DeleteProjectButton({ project }: { project: Project }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" className="min-h-11 text-destructive-text hover:bg-destructive/5" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden />
        Delete
      </Button>
      {open && <DeleteProjectDialog project={project} open onOpenChange={setOpen} redirectTo="/projects" />}
    </>
  );
}

function Overview({ p }: { p: Project }) {
  const prog = p.progress;
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            {p.name} <StatusPill status={p.status} />
          </h1>
          <p className="mt-2 text-muted-foreground">{p.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {p.status === "DRAFT" ? (
            <Button asChild className="min-h-11">
              <Link href={`/research/new?project=${p.id}`}>Continue setup</Link>
            </Button>
          ) : p.status === "COMPLETED" ? (
            <Button asChild className="min-h-11">
              <Link href={`/projects/${p.id}/report`}>Open report</Link>
            </Button>
          ) : null}
          <DeleteProjectButton project={p} />
        </div>
      </header>

      {p.status === "COMPLETED" && prog && (
        <section aria-labelledby="score-h" className="rounded-card border border-border bg-card p-5">
          <h2 id="score-h" className="flex items-center gap-2 text-base font-medium">
            <BarChart3 className="size-4 text-primary" aria-hidden /> Latest score
          </h2>
          <p className="mt-2 text-sm">
            <span className="text-2xl font-semibold tabular-nums">{prog.score === null ? "Not scored" : `${prog.score}/100`}</span>
            {prog.confidence && <span className="text-muted-foreground"> · {prog.confidence} confidence</span>}
            {prog.recommendation && <span className="text-muted-foreground"> · {RECOMMENDATION[prog.recommendation]}</span>}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">From your latest report. The breakdown and what would change it are on the report.</p>
        </section>
      )}

      {prog && prog.stages.length > 0 && (
        <section aria-labelledby="stages-h" className="rounded-card border border-border bg-card p-5">
          <h2 id="stages-h" className="text-base font-medium">
            Latest research run
          </h2>
          <div className="mt-3">
            <StagesCovered stages={prog.stages} />
          </div>
        </section>
      )}

      <section aria-labelledby="tools-h">
        <h2 id="tools-h" className="mb-3 text-base font-medium">
          Project tools
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tools(p).map((t) => (
            <li key={t.href}>
              {t.ready ? (
                <Link href={t.href} className="group flex h-full min-h-11 items-start gap-3 rounded-card border border-border bg-card p-4 hover:border-primary/40">
                  <t.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                  <span>
                    <span className="block font-medium group-hover:text-primary">{t.label}</span>
                    <span className="block text-sm text-muted-foreground">{t.body}</span>
                  </span>
                </Link>
              ) : (
                <div className="flex h-full items-start gap-3 rounded-card border border-dashed border-border p-4 opacity-70" aria-disabled="true">
                  <t.icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
                  <span>
                    <span className="block font-medium">{t.label}</span>
                    <span className="block text-sm text-muted-foreground">
                      {p.status === "DRAFT" ? "Available after you launch research." : "Available when the report is ready."}
                    </span>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
