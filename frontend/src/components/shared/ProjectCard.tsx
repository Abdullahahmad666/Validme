import { Check, CircleDashed, Loader2, X } from "lucide-react";
import Link from "next/link";
import { StatusPill } from "@/components/shared/StatusPill";
import { Skeleton } from "@/components/ui/skeleton";
import { STAGE_LABELS } from "@/lib/wizard";
import { cn } from "@/lib/utils";
import type { Project, ProjectProgress } from "@/types/api";

const dateFmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });

const STAGE_ICON = { COMPLETED: Check, PROCESSING: Loader2, FAILED: X, QUEUED: CircleDashed, SKIPPED: CircleDashed } as const;
const STAGE_STYLE = {
  COMPLETED: "bg-success/10 text-success-text",
  PROCESSING: "bg-primary/10 text-primary",
  FAILED: "bg-destructive/10 text-destructive-text",
  QUEUED: "bg-muted text-muted-foreground",
  SKIPPED: "bg-muted text-muted-foreground",
} as const;
const STAGE_WORD = { COMPLETED: "done", PROCESSING: "running", FAILED: "failed", QUEUED: "waiting", SKIPPED: "skipped" } as const;
const RECOMMENDATION = { build: "Build", research_more: "Research more", pivot: "Pivot" } as const;

/** Which research stages ran on the latest run: icon + short label, the state in words for screen readers. */
export function StagesCovered({ stages }: { stages: ProjectProgress["stages"] }) {
  if (stages.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Stages covered">
      {stages.map((s) => {
        const Icon = STAGE_ICON[s.status];
        return (
          <li key={s.name} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", STAGE_STYLE[s.status])}>
            <Icon className={cn("size-3", s.status === "PROCESSING" && "motion-safe:animate-spin")} aria-hidden />
            {STAGE_LABELS[s.name] ?? s.name}
            <span className="sr-only">: {STAGE_WORD[s.status]}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function ProjectCard({ project }: { project: Project }) {
  const p = project.progress;
  return (
    <article className="relative flex flex-col gap-3 rounded-card border border-border bg-card p-5 transition-colors hover:border-primary/40 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-primary has-[a:focus-visible]:ring-offset-2">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium leading-snug">
          {/* Stretched link: the whole card opens the project overview; the accessible name is the project name. */}
          <Link href={`/projects/${project.id}`} className="after:absolute after:inset-0 after:rounded-card focus-visible:outline-none">
            {project.name}
          </Link>
        </h3>
        <StatusPill status={project.status} />
      </div>
      <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
      {p && <StagesCovered stages={p.stages} />}
      <div className="mt-auto flex flex-wrap items-end justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Updated <time dateTime={project.updated_at}>{dateFmt.format(new Date(project.updated_at))}</time>
        </span>
        {/* Score only on completed projects with a report, always with its confidence. */}
        {project.status === "COMPLETED" && p && (p.score !== null || p.confidence) && (
          <span className="text-right">
            <span className="text-sm font-semibold tabular-nums text-foreground">{p.score === null ? "Not scored" : `${p.score}/100`}</span>
            {p.confidence && ` · ${p.confidence} confidence`}
            {p.recommendation && ` · ${RECOMMENDATION[p.recommendation]}`}
          </span>
        )}
      </div>
    </article>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-card p-5" aria-hidden>
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}
