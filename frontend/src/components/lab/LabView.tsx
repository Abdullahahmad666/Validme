"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ExternalLink, Plus, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fmtDate } from "@/components/evidence/EvidenceCard";
import { SurveyStatusBadge } from "@/components/lab/SurveyEditor";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { labKeys, useLabNotices, useLabSurveys } from "@/hooks/useLab";
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
            Put up a simple landing page with a waitlist, test prices, or ask a short survey, and see what real people do. Pages
            live on their own web address, never run scripts, and keep personal data encrypted. Nobody is contacted for you.
          </p>
        </div>
        <Button className="h-auto min-h-11 w-full whitespace-normal sm:w-auto" onClick={() => create.mutate()} disabled={create.isPending || !project.data}>
          <Plus aria-hidden /> {create.isPending ? "Creating…" : "New test page"}
        </Button>
      </header>
      <Notices projectId={projectId} />
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
      <h2 className="text-xl font-semibold">Test pages</h2>
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
      <Surveys projectId={projectId} canCreate={!!project.data} />
    </div>
  );
}

function Notices({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const notices = useLabNotices(projectId);
  const seen = useMutation({
    mutationFn: () => api.markLabNoticesSeen(projectId),
    onSuccess: () => qc.invalidateQueries({ queryKey: labKeys.notices(projectId) }),
  });
  const open = (notices.data?.results ?? []).filter((n) => !n.seen);
  if (open.length === 0) return null;
  return (
    <section aria-labelledby="notices-h" className="rounded-card border border-warning/40 bg-warning/10 p-4">
      <h2 id="notices-h" className="flex items-center gap-1.5 font-semibold text-warning-text">
        <ShieldAlert className="size-4" aria-hidden /> Data deletion requests
      </h2>
      <ul className="mt-2 list-disc pl-5 text-sm">
        {open.map((n) => (
          <li key={n.id}>
            {fmtDate(n.created_at)}: a respondent asked us to delete their data from &ldquo;{n.source}&rdquo; ({n.removed} item
            {n.removed === 1 ? "" : "s"} removed). If you downloaded a CSV before then, delete them from your copy too.
          </li>
        ))}
      </ul>
      <Button variant="outline" className="mt-3 min-h-11" onClick={() => seen.mutate()} disabled={seen.isPending}>
        Mark as read
      </Button>
      {seen.isError && (
        <p role="alert" className="mt-2 text-sm text-destructive-text">
          Couldn&apos;t update. Please try again.
        </p>
      )}
    </section>
  );
}

function Surveys({ projectId, canCreate }: { projectId: string; canCreate: boolean }) {
  const qc = useQueryClient();
  const router = useRouter();
  const surveys = useLabSurveys(projectId);
  const create = useMutation({
    mutationFn: () => api.createLabSurvey(projectId, { title: "Quick questions", questions: [] }),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: labKeys.surveys(projectId) });
      router.push(`/projects/${projectId}/lab/surveys/${s.id}`);
    },
  });
  return (
    <section aria-labelledby="surveys-h" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="surveys-h" className="text-xl font-semibold">
            Surveys
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Ask the people you reach a few questions about how they handle the problem today. Questions can be suggested from your
            assumptions; answers stay separate from the research evidence.
          </p>
        </div>
        <Button variant="outline" className="h-auto min-h-11 w-full whitespace-normal sm:w-auto" onClick={() => create.mutate()} disabled={create.isPending || !canCreate}>
          <Plus aria-hidden /> {create.isPending ? "Creating…" : "New survey"}
        </Button>
      </div>
      {create.isError && (
        <p role="alert" className="text-sm text-destructive-text">
          {create.error instanceof ApiError ? create.error.message : "Couldn't create the survey. Please try again."}
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
      {surveys.isPending ? (
        <Skeleton className="h-24" aria-busy="true" />
      ) : surveys.isError ? (
        <ErrorState title="Couldn't load your surveys" onRetry={() => surveys.refetch()} />
      ) : surveys.data.length === 0 ? (
        <EmptyState title="No surveys yet" body="Create one: three to six neutral questions about what people do today get the most useful answers." />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-card">
          {surveys.data.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  <Link href={`/projects/${projectId}/lab/surveys/${s.id}`} className="hover:underline">
                    {s.title}
                  </Link>
                  <SurveyStatusBadge status={s.status} />
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.responses} answer{s.responses === 1 ? "" : "s"} · {s.questions.length} question{s.questions.length === 1 ? "" : "s"} · edited{" "}
                  {fmtDate(s.updated_at)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {s.url && safeHref(s.url) && (
                  <a href={safeHref(s.url)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 text-sm text-primary underline">
                    Open live survey <ExternalLink className="size-3.5" aria-hidden />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                )}
                <Button asChild variant="outline" className="min-h-11">
                  <Link href={`/projects/${projectId}/lab/surveys/${s.id}`}>Edit</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
