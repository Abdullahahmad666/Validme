"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ExternalLink, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fmtDate } from "@/components/evidence/EvidenceCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProject } from "@/hooks/useResearch";
import { starterBlocks } from "@/lib/lab";
import { cn, safeHref } from "@/lib/utils";
import { api, ApiError } from "@/services/api";

export const STATUS_LABEL = { draft: "Draft", published: "Live", unpublished: "Unpublished" } as const;
const STATUS_STYLE = {
  draft: "bg-muted text-muted-strong",
  published: "bg-success/10 text-success-text",
  unpublished: "bg-warning/10 text-warning-text",
} as const;

export function StatusBadge({ status }: { status: keyof typeof STATUS_LABEL }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_STYLE[status])}>{STATUS_LABEL[status]}</span>;
}

export function LabView({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const project = useProject(projectId);
  const pages = useQuery({ queryKey: ["lab-pages", projectId], queryFn: () => api.labPages(projectId) });
  const create = useMutation({
    mutationFn: () =>
      api.createLabPage(projectId, { title: project.data?.name.slice(0, 80) || "Test page", blocks: starterBlocks(project.data?.name || "Your headline") }),
    onSuccess: (page) => {
      qc.invalidateQueries({ queryKey: ["lab-pages", projectId] });
      router.push(`/projects/${projectId}/lab/${page.id}`);
    },
  });

  if (project.isError && project.error instanceof ApiError && project.error.status === 404) {
    return <EmptyState title="Project not found" body="It may have been deleted, or it belongs to another account." actionHref="/projects" actionLabel="My projects" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <Link href="/projects" className="hover:text-foreground">
              My projects
            </Link>
            <ChevronRight className="size-3.5" aria-hidden />
          </li>
          <li className="flex min-w-0 items-center gap-1.5">
            <Link href={`/projects/${projectId}/report`} title={project.data?.name} className="max-w-[14rem] truncate hover:text-foreground">
              {project.data?.name ?? "Project"}
            </Link>
            <ChevronRight className="size-3.5" aria-hidden />
          </li>
          <li aria-current="page" className="font-medium text-foreground">
            Validation Lab
          </li>
        </ol>
      </nav>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Validation Lab</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Put up a simple landing page with a waitlist and see whether real people sign up. Pages live on their own web
            address, never run scripts, and keep sign-ups encrypted. Nobody is contacted for you.
          </p>
        </div>
        <Button className="h-auto min-h-11 w-full whitespace-normal sm:w-auto" onClick={() => create.mutate()} disabled={create.isPending || !project.data}>
          <Plus aria-hidden /> {create.isPending ? "Creating…" : "New test page"}
        </Button>
      </header>
      {create.isError && (
        <p role="alert" className="text-sm text-destructive-text">
          {create.error instanceof ApiError ? create.error.message : "Couldn't create the page. Please try again."}
          {create.error instanceof ApiError && create.error.status === 403 && (
            <>
              {" "}
              <Link href="/billing" className="font-medium underline">
                See plans
              </Link>
            </>
          )}
        </p>
      )}
      {pages.isPending ? (
        <Skeleton className="h-32" aria-busy="true" />
      ) : pages.isError ? (
        <ErrorState title="Couldn't load your test pages" onRetry={() => pages.refetch()} />
      ) : pages.data.length === 0 ? (
        <EmptyState
          title="No test pages yet"
          body="Create one: start from your idea's name, add the problem, a few benefits and a waitlist, then publish when it reads right."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-card">
          {pages.data.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  <Link href={`/projects/${projectId}/lab/${p.id}`} className="hover:underline">
                    {p.title}
                  </Link>
                  <StatusBadge status={p.status} />
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.signups} sign-up{p.signups === 1 ? "" : "s"} · edited {fmtDate(p.updated_at)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {p.url && safeHref(p.url) && (
                  <a href={safeHref(p.url)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 text-sm text-primary underline">
                    Open live page <ExternalLink className="size-3.5" aria-hidden />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                )}
                <Button asChild variant="outline" className="min-h-11">
                  <Link href={`/projects/${projectId}/lab/${p.id}`}>Edit</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
