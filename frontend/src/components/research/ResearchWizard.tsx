"use client";

import { Check, ChevronRight, Lightbulb } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AutosaveStatus } from "@/components/research/AutosaveStatus";
import { StepConfigure } from "@/components/research/StepConfigure";
import { StepIdea } from "@/components/research/StepIdea";
import { StepMarket } from "@/components/research/StepMarket";
import { StepReview } from "@/components/research/StepReview";
import { WizardContext, type SaveHandle, type WizardContextValue } from "@/components/research/wizard-context";
import { ErrorState } from "@/components/shared/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useProject } from "@/hooks/useResearch";
import { STEPS, type StepNumber } from "@/lib/wizard";
import { cn } from "@/lib/utils";

const HELP: Record<StepNumber, { title: string; tips: string[] }> = {
  1: {
    title: "Describe it like you'd explain it to a friend",
    tips: [
      "Say who has the problem and what it costs them today.",
      "It's fine to be rough. You'll confirm how we understood it before anything runs.",
      "Drafts are free and never use credits.",
    ],
  },
  2: {
    title: "Narrow the market",
    tips: [
      "Specific audiences give sharper evidence: “single-location restaurant owners” beats “restaurants”.",
      "Values marked AI suggested come from your description. Edit anything that's off.",
    ],
  },
  3: {
    title: "Decide what to search",
    tips: [
      "Queries are written the way customers talk. Edit or add your own.",
      "Only sources marked Available or Limited are searched, and the report lists every one.",
      "Add competitor sites or threads you've already found; we'll read those pages too.",
    ],
  },
  4: {
    title: "Check before you spend",
    tips: [
      "Credits are charged once, when you launch. Retrying or double-clicking won't charge twice.",
      "If a source fails, the rest still run and the report says what's missing.",
    ],
  },
};

function parseStep(raw: string | null): StepNumber {
  const n = Number(raw);
  return n === 2 || n === 3 || n === 4 ? n : 1;
}

export function ResearchWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const projectId = params.get("project");
  const step = parseStep(params.get("step"));
  const project = useProject(projectId);
  const [save, setSave] = useState<SaveHandle | null>(null);
  const saveRef = useRef<SaveHandle | null>(null);

  const reportSave = useCallback((handle: SaveHandle) => {
    saveRef.current = handle;
    setSave((prev) => (prev?.state === handle.state ? prev : handle));
  }, []);

  const goTo = useCallback(
    async (next: StepNumber, id = projectId) => {
      await saveRef.current?.flush();
      const q = new URLSearchParams();
      if (id) q.set("project", id);
      if (next !== 1) q.set("step", String(next));
      router.push(`/research/new?${q.toString()}`);
      window.scrollTo({ top: 0 });
    },
    [projectId, router],
  );

  // Launched or finished projects can't be edited: send them to their progress page.
  useEffect(() => {
    if (project.data && project.data.status !== "DRAFT") router.replace(`/projects/${project.data.id}/progress`);
  }, [project.data, router]);

  const ctx = useMemo<WizardContextValue>(
    () => ({ project: project.data ?? null, step, goTo: (s) => goTo(s), reportSave }),
    [project.data, step, goTo, reportSave],
  );

  const canVisit = (n: StepNumber) => n === 1 || !!project.data;
  const help = HELP[step];

  if (projectId && project.isPending) {
    return (
      <div className="grid gap-8 lg:grid-cols-[230px_minmax(0,1fr)]" aria-busy="true">
        <Skeleton className="hidden h-48 lg:block" />
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (projectId && project.isError) {
    return <ErrorState title="We couldn't load this draft" body="It may have been deleted." onRetry={() => project.refetch()} />;
  }

  return (
    <WizardContext.Provider value={ctx}>
      <div className="flex flex-col gap-6">
        {/* Breadcrumbs + autosave status */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <li>
                <Link href="/projects" className="hover:text-foreground">
                  My projects
                </Link>
              </li>
              <ChevronRight className="size-3.5" aria-hidden />
              <li aria-current="page" className="max-w-[16rem] truncate font-medium text-foreground">
                {project.data?.name || "New research"}
              </li>
            </ol>
          </nav>
          {project.data && save && <AutosaveStatus state={save.state} onRetry={save.retry} />}
        </div>

        {/* Mobile / tablet compact step bar */}
        <ol className="flex items-center gap-1 lg:hidden" aria-label="Steps">
          {STEPS.map((s) => (
            <li key={s.n} className="flex flex-1 flex-col gap-1.5">
              <span className={cn("h-1.5 rounded-full", s.n <= step ? "bg-primary" : "bg-border")} aria-hidden />
              <span
                aria-current={s.n === step ? "step" : undefined}
                className={cn("text-[11px]", s.n === step ? "font-semibold text-foreground" : "text-muted-foreground")}
              >
                {s.short}
              </span>
            </li>
          ))}
        </ol>

        <div className="grid gap-8 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)_280px]">
          {/* Desktop stepper */}
          <nav aria-label="Steps" className="hidden lg:block">
            <ol className="sticky top-6 flex flex-col gap-1">
              {STEPS.map((s) => {
                const current = s.n === step;
                const done = s.n < step;
                const enabled = canVisit(s.n as StepNumber) && !current;
                const inner = (
                  <>
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                        current && "border-primary bg-primary text-primary-foreground",
                        done && "border-primary/40 bg-primary/10 text-primary",
                        !current && !done && "border-border text-muted-foreground",
                      )}
                    >
                      {done ? <Check className="size-3.5" aria-label="completed" /> : s.n}
                    </span>
                    {s.title}
                  </>
                );
                return (
                  <li key={s.n}>
                    {enabled ? (
                      <button
                        type="button"
                        onClick={() => goTo(s.n as StepNumber)}
                        className="flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        {inner}
                      </button>
                    ) : (
                      <span
                        aria-current={current ? "step" : undefined}
                        className={cn(
                          "flex min-h-11 items-center gap-3 rounded-control px-3 text-sm",
                          current ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground/70",
                        )}
                      >
                        {inner}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>

          <section className="min-w-0 max-w-[720px] rounded-card border border-border bg-card p-5 sm:p-7">
            <p className="text-xs font-medium text-muted-foreground">Step {step} of 4</p>
            {step === 1 && <StepIdea onCreated={(id) => goTo(1, id)} />}
            {step === 2 && project.data && <StepMarket />}
            {step === 3 && project.data && <StepConfigure />}
            {step === 4 && project.data && <StepReview />}
          </section>

          <aside aria-label="Help" className="hidden xl:block">
            <div className="sticky top-6 rounded-card border border-border bg-card p-5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Lightbulb className="size-4 text-primary" aria-hidden />
                {help.title}
              </p>
              <ul className="mt-3 flex flex-col gap-2.5 text-sm text-muted-foreground">
                {help.tips.map((t) => (
                  <li key={t} className="leading-relaxed">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </WizardContext.Provider>
  );
}
