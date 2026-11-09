import Link from "next/link";
import { StatusPill } from "@/components/shared/StatusPill";
import { Skeleton } from "@/components/ui/skeleton";
import type { Project } from "@/types/api";

const dateFmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });

// Score is intentionally absent: it only appears on completed projects once reports exist (week 4).
export function ProjectCard({ project }: { project: Project }) {
  // Drafts resume the wizard; launched projects open their research progress.
  const href = project.status === "DRAFT" ? `/research/new?project=${project.id}` : `/projects/${project.id}/progress`;
  return (
    <article className="relative flex flex-col gap-3 rounded-card border border-border bg-card p-5 transition-colors hover:border-primary/40 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-primary has-[a:focus-visible]:ring-offset-2">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium leading-snug">
          {/* Stretched link: the whole card is clickable, the accessible name is the project name. */}
          <Link href={href} className="after:absolute after:inset-0 after:rounded-card focus-visible:outline-none">
            {project.name}
          </Link>
        </h3>
        <StatusPill status={project.status} />
      </div>
      <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
      <p className="mt-auto text-xs text-muted-foreground">
        Updated <time dateTime={project.updated_at}>{dateFmt.format(new Date(project.updated_at))}</time>
      </p>
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
