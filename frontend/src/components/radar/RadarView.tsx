"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ScoreTrend } from "@/components/radar/ScoreTrend";
import { SignalCard, type SignalUpdate } from "@/components/radar/SignalCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProject } from "@/hooks/useResearch";
import { SIGNAL_TYPES } from "@/lib/radar";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/services/api";
import type { SignalType } from "@/types/radar";

const VIEWS = [
  { value: "open", label: "Open" },
  { value: "acted", label: "Acted on" },
  { value: "dismissed", label: "Dismissed" },
] as const;
type View = (typeof VIEWS)[number]["value"];

function Pills<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-11 rounded-full border px-3.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring",
            value === o.value ? "border-primary bg-primary/10 font-medium text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function RadarView({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const project = useProject(projectId);
  const params = useSearchParams();
  const focus = Number(params.get("signal")) || null;
  const [view, setView] = useState<View>("open");
  const [type, setType] = useState<SignalType | "all">("all");
  const [page, setPage] = useState(1);
  // Signals that were new when this visit loaded them. The server marks them seen right away; the "New" mark
  // stays for the rest of the visit, even after a refetch.
  const [newThisVisit, setNewThisVisit] = useState<ReadonlySet<number>>(() => new Set());
  const signals = useQuery({
    queryKey: ["signals", projectId, view, type, page],
    queryFn: async () => {
      try {
        const data = await api.listSignals(projectId, { status: view, type: type === "all" ? undefined : type, page });
        const fresh = data.results.filter((s) => s.status === "new").map((s) => s.id);
        if (fresh.length) {
          setNewThisVisit((prev) => new Set([...prev, ...fresh]));
          api.markSignalsSeen(projectId, fresh).catch(() => {});
        }
        return data;
      } catch (err) {
        if (err instanceof ApiError && err.status === 404 && page > 1) setPage(1); // that page no longer exists
        throw err;
      }
    },
    placeholderData: keepPreviousData,
  });
  const history = useQuery({ queryKey: ["score-history", projectId], queryFn: () => api.scoreHistory(projectId) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["signals", projectId] });
  const update = useMutation({
    mutationFn: ({ id, u }: { id: number; u: SignalUpdate }) => api.updateSignal(projectId, id, u),
    onSuccess: (_, { u }) => {
      // Acting on the last card of a later page empties it: step back instead of showing an empty page.
      if (u.status && page > 1 && (signals.data?.results.length ?? 0) <= 1) setPage((p) => p - 1);
      invalidate();
    },
  });
  const refresh = useMutation({
    mutationFn: () => api.refreshRadar(projectId),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["score-history", projectId] });
    },
  });

  // ?signal= focuses that card once, not again after every refetch.
  const focused = useRef(false);
  useEffect(() => {
    if (!focus || focused.current || !signals.data) return;
    const el = document.getElementById(`signal-${focus}`);
    if (!el) return;
    focused.current = true;
    el.scrollIntoView({ block: "center" });
    el.focus({ preventScroll: true });
  }, [focus, signals.data]);

  const goto = (p: number) => {
    setPage(p);
    document.getElementById("radar-list")?.scrollIntoView({ block: "start" });
  };

  if (project.isError && project.error instanceof ApiError && project.error.status === 404) {
    return <EmptyState title="Project not found" body="It may have been deleted, or it belongs to another account." actionHref="/projects" actionLabel="My projects" />;
  }
  const list = signals.data?.results ?? [];

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
            Radar
          </li>
        </ol>
      </nav>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Opportunity Radar</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Signals found in what we already store for this idea: recurring complaints, rising discussion, competitor
            changes and new competitors you confirmed. Every signal links to its sources. A signal is a reason to look
            closer, not proof.
          </p>
        </div>
        <Button variant="outline" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
          <RefreshCw className={cn(refresh.isPending && "animate-spin")} aria-hidden />
          {refresh.isPending ? "Checking…" : "Check now"}
        </Button>
      </header>
      <p className="-mt-3 text-xs text-muted-foreground">
        Check now re-reads the evidence already stored for this idea. It doesn&apos;t run new research or use credits.
      </p>
      {refresh.isSuccess && (
        <p role="status" className="text-sm text-muted-foreground">
          {refresh.data.new_signals
            ? `${refresh.data.new_signals} new signal${refresh.data.new_signals === 1 ? "" : "s"} found.`
            : "Nothing new since the last check."}
        </p>
      )}
      {refresh.isError && (
        <p role="alert" className="text-sm text-destructive-text">
          {refresh.error instanceof ApiError ? refresh.error.message : "Couldn't check right now. Please try again."}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <Pills label="Show" value={view} options={VIEWS} onChange={(v) => (setView(v), setPage(1))} />
        <Pills
          label="Type"
          value={type}
          options={[{ value: "all", label: "All types" }, ...(Object.keys(SIGNAL_TYPES) as SignalType[]).map((t) => ({ value: t, label: SIGNAL_TYPES[t].label }))]}
          onChange={(t) => (setType(t), setPage(1))}
        />
      </div>

      {signals.isPending ? (
        <div aria-busy="true" className="flex flex-col gap-3">
          <span className="sr-only">Loading signals</span>
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : signals.isError ? (
        <ErrorState title="Couldn't load signals" onRetry={() => signals.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          title={view === "open" ? "No open signals" : view === "acted" ? "Nothing marked as acted on yet" : "Nothing dismissed"}
          body={
            view === "open"
              ? "Signals appear when a complaint theme is backed by several sources, discussion rises, a watched competitor changes its prices, or you confirm a new competitor. Research and monitoring feed it; we re-check every week."
              : "Signals you act on or dismiss are kept here, so the same signal isn't suggested again."
          }
          actionHref={view === "open" ? `/projects/${projectId}/monitoring` : undefined}
          actionLabel={view === "open" ? "Watch competitor pages" : undefined}
        />
      ) : (
        <>
          <ul
            id="radar-list"
            aria-busy={signals.isPlaceholderData}
            className={cn("flex scroll-mt-20 flex-col gap-3 transition-opacity", signals.isPlaceholderData && "opacity-60")}
          >
            {list.map((s) => (
              <SignalCard
                key={s.id}
                s={s}
                projectId={projectId}
                highlighted={s.id === focus}
                isNew={s.status === "new" || newThisVisit.has(s.id)}
                busy={update.isPending && update.variables?.id === s.id}
                error={
                  update.isError && update.variables?.id === s.id
                    ? update.error instanceof ApiError
                      ? update.error.message
                      : "Couldn't save that. Please try again."
                    : undefined
                }
                onUpdate={(u) => update.mutate({ id: s.id, u })}
              />
            ))}
          </ul>
          {(signals.data?.previous || signals.data?.next) && (
            <nav aria-label="Signal pages" className="flex items-center gap-2">
              <Button variant="outline" className="min-h-11" disabled={!signals.data?.previous} onClick={() => goto(page - 1)}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {page}</span>
              <Button variant="outline" className="min-h-11" disabled={!signals.data?.next} onClick={() => goto(page + 1)}>
                Next
              </Button>
            </nav>
          )}
        </>
      )}

      {history.isPending ? (
        <Skeleton className="h-48" aria-busy="true" />
      ) : history.isError ? (
        <ErrorState title="Couldn't load the score history" onRetry={() => history.refetch()} />
      ) : (
        <ScoreTrend snapshots={history.data.results} />
      )}
    </div>
  );
}
