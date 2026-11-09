"use client";

import { AlertTriangle, ArrowLeft, CheckCircle2, Coins, Info, Loader2, Pencil, Rocket } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { WizardActions } from "@/components/research/WizardActions";
import { isUsable } from "@/components/research/SourcePicker";
import { useWizard } from "@/components/research/wizard-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useEstimate, useLaunch, useQueries, useSources } from "@/hooks/useResearch";
import { OBJECTIVES } from "@/lib/validation";
import { DEPTHS, launchKey, type StepNumber } from "@/lib/wizard";
import { ApiError } from "@/services/api";
import type { ResearchJob } from "@/types/api";

function Block({ title, step, children }: { title: string; step?: StepNumber; children: React.ReactNode }) {
  const { goTo } = useWizard();
  return (
    <section className="flex flex-col gap-2 border-t border-border pt-5 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {step && (
          <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={() => goTo(step)}>
            <Pencil aria-hidden />
            Edit
          </Button>
        )}
      </div>
      <div className="text-sm text-foreground/85">{children}</div>
    </section>
  );
}

function Launched({ job, projectId }: { job: ResearchJob; projectId: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="py-6 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success/10 text-success">
        <CheckCircle2 className="size-7" aria-hidden />
      </span>
      <h1 ref={ref} tabIndex={-1} className="mt-5 text-2xl font-semibold tracking-tight outline-none">
        Research launched
      </h1>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground">
        {job.credits_charged} credit{job.credits_charged === 1 ? "" : "s"} used. You can leave this page; progress is
        saved and shown on the project.
      </p>
      <Button asChild size="lg" className="mt-6">
        <Link href={`/projects/${projectId}/progress`}>View research progress</Link>
      </Button>
    </div>
  );
}

export function StepReview() {
  const { project: maybeProject, goTo, reportSave } = useWizard();
  const project = maybeProject!;
  const sources = useSources();
  const queries = useQueries(project.id);
  const estimate = useEstimate(project.id, project.depth);
  const launch = useLaunch(project.id);
  const [agreed, setAgreed] = useState(false);
  const [problem, setProblem] = useState<{ kind: "credits" | "conflict" | "other"; message: string } | null>(null);

  // Nothing to autosave on this step.
  useEffect(() => reportSave({ state: "saved", flush: async () => {}, retry: () => {} }), [reportSave]);

  if (launch.data) return <Launched job={launch.data} projectId={project.id} />;

  const all = sources.data?.results ?? [];
  const selected = all.filter((s) => project.sources.includes(s.key) && isUsable(s));
  const excluded = all.filter((s) => !selected.includes(s));
  const enabledQueries = (queries.data ?? []).filter((q) => q.enabled);
  const depth = DEPTHS.find((d) => d.value === project.depth)!;
  const deliverables = OBJECTIVES.filter((o) => project.objectives.includes(o.value)).map((o) => o.label);

  async function submit() {
    setProblem(null);
    const key = launchKey(project.id, typeof window !== "undefined" ? window.sessionStorage : null);
    try {
      await launch.mutateAsync(key);
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) setProblem({ kind: "credits", message: err.message });
      else if (err instanceof ApiError && err.status === 409) setProblem({ kind: "conflict", message: err.message });
      else setProblem({ kind: "other", message: "We couldn't launch the research. Nothing was charged; please try again." });
    }
  }

  const est = estimate.data;
  const canLaunch = agreed && selected.length > 0 && !!est?.sufficient && !launch.isPending;

  return (
    <div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Review and launch.</h1>
      <p className="mt-2 text-muted-foreground">Check the scope before any credits are used.</p>

      <div className="mt-8 flex flex-col gap-5">
        <Block title="Idea" step={1}>
          <p className="font-medium">{project.name}</p>
          <p className="mt-1 line-clamp-3 text-muted-foreground">{project.description}</p>
        </Block>

        <Block title="Market" step={2}>
          <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 gap-y-1.5">
            <dt className="text-muted-foreground">Audiences</dt>
            <dd>{project.audiences.join(", ") || "—"}</dd>
            <dt className="text-muted-foreground">Customer type</dt>
            <dd>{project.customer_type || "—"}</dd>
            <dt className="text-muted-foreground">Geography</dt>
            <dd>{project.geographies.join(", ") || "Not specified"}</dd>
            {project.industry && (
              <>
                <dt className="text-muted-foreground">Industry</dt>
                <dd>{project.industry}</dd>
              </>
            )}
          </dl>
        </Block>

        <Block title="Sources" step={3}>
          {sources.isPending ? (
            <Skeleton className="h-12" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-success-text">
                  <CheckCircle2 className="size-3.5" aria-hidden /> Will be searched
                </p>
                <ul className="list-disc pl-5">
                  {selected.map((s) => (
                    <li key={s.key}>
                      {s.label}
                      {!s.uses_queries && (
                        <span className="text-muted-foreground">
                          {" "}
                          ({(s.key === "competitor_pages" ? project.competitor_urls : project.evidence_urls).length} links)
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-strong">
                  <Info className="size-3.5" aria-hidden /> Not included
                </p>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {excluded.map((s) => (
                    <li key={s.key}>{s.label}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </Block>

        <Block title="Queries" step={3}>
          {enabledQueries.length > 0 ? (
            <p>
              {enabledQueries.length} quer{enabledQueries.length === 1 ? "y" : "ies"} included; up to{" "}
              {est?.budget.queries ?? "…"} run at {depth.label} depth.
            </p>
          ) : (
            <p className="text-muted-foreground">No queries yet. We&apos;ll search using your idea description.</p>
          )}
        </Block>

        <Block title="Deliverables">
          <p>{deliverables.join(" · ") || "—"}</p>
        </Block>

        <Block title="Depth and credits" step={3}>
          {estimate.isPending ? (
            <Skeleton className="h-16" />
          ) : est ? (
            <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
              <p>
                <span className="font-semibold">{depth.label}</span> · {est.credits} credit{est.credits > 1 ? "s" : ""}
              </p>
              <p className="flex items-center gap-1.5 tabular-nums">
                <Coins className="size-4 text-muted-foreground" aria-hidden />
                Balance {est.balance} → <span className="font-semibold">{Math.max(est.balance_after, 0)}</span> after launch
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">Estimate unavailable.</p>
          )}
        </Block>

        <Alert>
          <Info aria-hidden />
          <AlertDescription>
            Research covers only the sources listed above. If one fails, the others still run and the report says what
            is missing. Findings are evidence to weigh, not a guarantee of demand.
          </AlertDescription>
        </Alert>

        {est && !est.sufficient && (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden />
            <AlertDescription>
              This needs {est.credits} credits and you have {est.balance}. Choose a lighter depth, or{" "}
              <Link href="/billing" className="font-medium underline">
                get more credits
              </Link>
              .
            </AlertDescription>
          </Alert>
        )}

        {problem && (
          <Alert variant="destructive" role="alert">
            <AlertTriangle aria-hidden />
            <AlertDescription>
              {problem.message}{" "}
              {problem.kind === "conflict" && (
                <Link href={`/projects/${project.id}/progress`} className="font-medium underline">
                  View progress
                </Link>
              )}
            </AlertDescription>
          </Alert>
        )}

        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-control border border-border p-4">
          <input
            type="checkbox"
            className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span className="text-sm">
            I have reviewed the scope and usage. {est ? `${est.credits} credit${est.credits > 1 ? "s" : ""} will be used.` : ""}
          </span>
        </label>
      </div>

      <WizardActions>
        <Button type="button" variant="ghost" onClick={() => goTo(3)}>
          <ArrowLeft aria-hidden />
          Back
        </Button>
        <Button type="button" size="lg" onClick={submit} disabled={!canLaunch}>
          {launch.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Rocket aria-hidden />}
          Launch research
        </Button>
      </WizardActions>
    </div>
  );
}
