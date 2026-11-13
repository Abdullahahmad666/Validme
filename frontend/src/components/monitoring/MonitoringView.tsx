"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Pause, Play, Plus, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { fmtDate } from "@/components/evidence/EvidenceCard";
import { ChangeCard } from "@/components/monitoring/ChangeCard";
import { Panel } from "@/components/report/parts";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useProject } from "@/hooks/useResearch";
import { useMe, meKey } from "@/hooks/useSession";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/services/api";
import type { Cadence, Significance, Watch, WatchStatus } from "@/types/monitoring";

const STATUS: Record<WatchStatus, { label: string; className: string }> = {
  pending: { label: "Not checked yet", className: "text-muted-foreground" },
  baseline: { label: "First read stored", className: "text-muted-foreground" },
  unchanged: { label: "No change", className: "text-muted-foreground" },
  changed: { label: "Changed", className: "text-primary" },
  error: { label: "Couldn't read", className: "text-warning-text" },
  blocked: { label: "Not allowed", className: "text-destructive-text" },
  paused: { label: "Paused", className: "text-muted-strong" },
};
const RESULT: Record<string, string> = {
  baseline: "First read stored. Changes will show from the next check.",
  unchanged: "Checked: no change.",
  changed: "Checked: a change was found below.",
  deferred: "This site was checked moments ago; we'll try again shortly.",
  error: "Couldn't read the page this time.",
  blocked: "This page can't be checked (robots.txt or not a public address).",
  paused: "This watch is waiting on your plan's limit.",
};

function apiMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError) {
    const d = err.details as Record<string, unknown> | undefined;
    const first = d && Object.values(d).flat()[0];
    return typeof first === "string" ? first : err.message;
  }
  return fallback;
}

function useRefresh(projectId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["watches", projectId] });
    qc.invalidateQueries({ queryKey: ["changes", projectId] });
    qc.invalidateQueries({ queryKey: meKey });
  };
}

function AddWatch({ projectId, canDaily, full }: { projectId: string; canDaily: boolean; full: boolean }) {
  const uid = useId();
  const refresh = useRefresh(projectId);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [cadence, setCadence] = useState<Cadence>("weekly");
  const add = useMutation({
    mutationFn: () => api.createWatch(projectId, { url: url.trim(), label: label.trim(), cadence }),
    onSuccess: () => {
      setUrl("");
      setLabel("");
      refresh();
    },
  });
  return (
    <form
      className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto_auto] md:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        if (url.trim() && !full) add.mutate();
      }}
    >
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${uid}-url`}>Page to watch</Label>
        <Input
          id={`${uid}-url`}
          type="url"
          inputMode="url"
          placeholder="https://competitor.com/pricing"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="h-11"
          disabled={full}
          aria-invalid={add.isError}
          aria-describedby={add.isError ? `${uid}-err` : undefined}
          required
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${uid}-label`}>Name (optional)</Label>
        <Input id={`${uid}-label`} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} className="h-11" disabled={full} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${uid}-cadence`}>Check</Label>
        <select
          id={`${uid}-cadence`}
          value={cadence}
          onChange={(e) => setCadence(e.target.value as Cadence)}
          className="h-11 rounded-control border border-input bg-card px-2 text-sm"
          disabled={full}
        >
          <option value="weekly">Weekly</option>
          <option value="daily" disabled={!canDaily}>
            Daily{canDaily ? "" : " (paid plans)"}
          </option>
        </select>
      </div>
      <Button type="submit" className="h-11" disabled={add.isPending || !url.trim() || full}>
        <Plus aria-hidden /> {add.isPending ? "Adding…" : "Watch"}
      </Button>
      {add.isError && (
        <p id={`${uid}-err`} role="alert" className="text-sm text-destructive-text md:col-span-4">
          {apiMessage(add.error, "Couldn't add this page.")}
        </p>
      )}
    </form>
  );
}

function FromReport({ projectId, watchedUrls, slots }: { projectId: string; watchedUrls: Set<string>; slots: number }) {
  const refresh = useRefresh(projectId);
  const report = useQuery({ queryKey: ["report", projectId, "latest"], queryFn: () => api.getReport(projectId), retry: false });
  const [picked, setPicked] = useState<number[]>([]);
  const add = useMutation({
    mutationFn: () => api.watchFromReport(projectId, picked),
    onSuccess: () => {
      setPicked([]);
      refresh();
    },
  });
  const candidates = (report.data?.competitors ?? []).filter((c) => c.website && !watchedUrls.has(c.pricing?.source_url || c.website));
  if (!report.data || candidates.length === 0 || slots <= 0) return null;
  return (
    <fieldset className="rounded-control border border-dashed border-border p-4">
      <legend className="px-1 text-sm font-medium">Watch competitors from your report</legend>
      <p className="mb-2 text-xs text-muted-foreground">
        You can pick {slots} more on your plan. We watch the pricing page the report read, or their website.
      </p>
      <ul className="flex flex-wrap gap-2">
        {candidates.map((c) => {
          const on = picked.includes(c.id);
          const full = !on && picked.length >= slots;
          return (
            <li key={c.id}>
              <label
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm",
                  on ? "border-primary bg-primary/[0.06] text-primary" : "border-border",
                  full && "cursor-not-allowed opacity-50",
                )}
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={full}
                  onChange={() => setPicked((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))}
                />
                {c.name}
              </label>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="outline" disabled={picked.length === 0 || add.isPending} onClick={() => add.mutate()}>
          {picked.length ? `Watch ${picked.length} selected` : "Watch selected"}
        </Button>
        {add.isSuccess && (
          <p role="status" className="text-xs text-success-text">
            Added {add.data.created}
            {add.data.skipped ? `, skipped ${add.data.skipped} (not a public page or already watched)` : ""}.
          </p>
        )}
        {add.isError && (
          <p role="alert" className="text-xs text-destructive-text">
            {apiMessage(add.error, "Couldn't add them.")}
          </p>
        )}
      </div>
    </fieldset>
  );
}

function WatchRow({ w, projectId, canDaily }: { w: Watch; projectId: string; canDaily: boolean }) {
  const uid = useId();
  const refresh = useRefresh(projectId);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState("");
  const update = useMutation({ mutationFn: (b: Parameters<typeof api.updateWatch>[2]) => api.updateWatch(projectId, w.id, b), onSuccess: refresh });
  const check = useMutation({
    mutationFn: () => api.checkWatch(projectId, w.id),
    onSuccess: (r) => {
      setNote(r.queued ? "Check queued: results appear here in about a minute." : (RESULT[r.result ?? ""] ?? "Checked."));
      refresh();
      if (r.queued) window.setTimeout(refresh, 60_000);
    },
  });
  const remove = useMutation({ mutationFn: () => api.deleteWatch(projectId, w.id), onSuccess: refresh });
  const S = STATUS[w.last_status];
  const err = update.error ?? check.error ?? remove.error;
  const name = w.label || w.url;
  const cadence = update.isPending && update.variables?.cadence ? update.variables.cadence : w.cadence;

  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="break-words font-medium">{name}</p>
        {w.label && <p className="break-all text-xs text-muted-foreground">{w.url}</p>}
        <p className="mt-1 text-xs">
          <span className={S.className}>{S.label}</span>
          <span className="text-muted-foreground">
            {w.last_checked_at ? ` · checked ${fmtDate(w.last_checked_at)}` : ""}
            {w.active ? ` · next ${fmtDate(w.next_run_at)}` : ""}
            {` · ${w.changes} change${w.changes === 1 ? "" : "s"}`}
          </span>
        </p>
        {w.last_error && <p className="mt-1 break-words text-xs text-warning-text">{w.last_error}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <Label htmlFor={`${uid}-cad`} className="sr-only">
          How often to check {name}
        </Label>
        <select
          id={`${uid}-cad`}
          value={cadence}
          disabled={update.isPending}
          onChange={(e) => update.mutate({ cadence: e.target.value as Cadence })}
          className="h-11 rounded-control border border-input bg-card px-2 text-sm"
        >
          <option value="weekly">Weekly</option>
          <option value="daily" disabled={!canDaily && w.cadence !== "daily"}>
            Daily
          </option>
        </select>
        <Button variant="outline" onClick={() => check.mutate()} disabled={!w.active || check.isPending} aria-label={`Check ${name} now`}>
          <RefreshCw aria-hidden className={cn(check.isPending && "animate-spin")} /> {check.isPending ? "Checking…" : "Check now"}
        </Button>
        <Button variant="ghost" onClick={() => update.mutate({ active: !w.active })} aria-label={`${w.active ? "Pause" : "Resume"} ${name}`}>
          {w.active ? <Pause aria-hidden /> : <Play aria-hidden />} {w.active ? "Pause" : "Resume"}
        </Button>
        {!confirming && (
          <Button variant="ghost" onClick={() => setConfirming(true)} aria-label={`Remove ${name}`}>
            <Trash2 aria-hidden /> Remove
          </Button>
        )}
      </div>
      {confirming && (
        <div className="flex flex-col gap-2 rounded-control border border-destructive/30 bg-destructive/[0.04] p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            Removing also deletes its {w.changes} recorded change{w.changes === 1 ? "" : "s"}. Pause instead to keep them.
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setConfirming(false)} autoFocus>
              Keep
            </Button>
            <Button variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>
              Stop watching
            </Button>
          </div>
        </div>
      )}
      <p role="status" aria-live="polite" className="min-h-0 text-xs text-muted-foreground">
        {note}
      </p>
      {err && (
        <p role="alert" className="text-sm text-destructive-text">
          {apiMessage(err, "Something went wrong.")}
        </p>
      )}
    </li>
  );
}

function Timeline({ projectId, watches }: { projectId: string; watches: Watch[] }) {
  const qc = useQueryClient();
  const params = useSearchParams();
  const highlight = Number(params.get("change")) || null;
  const [watch, setWatch] = useState<number | undefined>();
  const [significance, setSignificance] = useState<Significance | undefined>();
  const [page, setPage] = useState(1);
  const changes = useQuery({
    queryKey: ["changes", projectId, watch, significance, page],
    queryFn: () => api.listChanges(projectId, { watch, significance, page }),
    placeholderData: keepPreviousData,
  });
  const seen = useMutation({
    mutationFn: (id: number) => api.markChangeSeen(projectId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["changes", projectId] }),
  });
  useEffect(() => {
    if (!highlight || !changes.data) return;
    const el = document.getElementById(`change-${highlight}`);
    el?.scrollIntoView({ block: "center" });
    el?.focus();
  }, [highlight, changes.data]);
  const filtered = watch !== undefined || significance !== undefined;
  const goto = (p: number) => {
    setPage(p);
    document.getElementById("timeline-top")?.scrollIntoView({ block: "start" });
  };

  return (
    <Panel title="Change timeline" aside={<span className="text-xs text-muted-foreground">Newest first</span>}>
      <div id="timeline-top" className="mb-4 flex flex-wrap gap-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Page</span>
          <select
            value={watch ?? ""}
            onChange={(e) => (setWatch(e.target.value ? Number(e.target.value) : undefined), setPage(1))}
            className="h-11 max-w-[16rem] rounded-control border border-input bg-card px-2 text-sm"
          >
            <option value="">All pages</option>
            {watches.map((w) => (
              <option key={w.id} value={w.id}>
                {(w.label || w.url).slice(0, 60)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Significance</span>
          <select
            value={significance ?? ""}
            onChange={(e) => (setSignificance((e.target.value || undefined) as Significance | undefined), setPage(1))}
            className="h-11 rounded-control border border-input bg-card px-2 text-sm"
          >
            <option value="">Any</option>
            <option value="high">High (prices)</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
      </div>
      {changes.isPending ? (
        <div aria-busy="true">
          <span className="sr-only">Loading changes</span>
          <Skeleton className="h-32" />
        </div>
      ) : changes.isError ? (
        <ErrorState title="Couldn't load changes" onRetry={() => changes.refetch()} />
      ) : changes.data.results.length === 0 ? (
        filtered ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            No changes match these filters.
            <Button variant="ghost" onClick={() => (setWatch(undefined), setSignificance(undefined), setPage(1))}>
              Clear filters
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No changes yet. The first check stores a baseline; changes appear when a later check finds different prices or text.
          </p>
        )
      ) : (
        <>
          <ul className={cn("flex flex-col gap-3", changes.isFetching && "opacity-60")} aria-busy={changes.isFetching}>
            {changes.data.results.map((c) => (
              <ChangeCard key={c.id} c={c} highlighted={c.id === highlight} onSeen={() => seen.mutate(c.id)} />
            ))}
          </ul>
          {(changes.data.previous || changes.data.next) && (
            <div className="mt-4 flex gap-2">
              <Button variant="outline" disabled={!changes.data.previous} onClick={() => goto(page - 1)}>
                Newer
              </Button>
              <Button variant="outline" disabled={!changes.data.next} onClick={() => goto(page + 1)}>
                Older
              </Button>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

export function MonitoringView({ projectId }: { projectId: string }) {
  const project = useProject(projectId);
  const me = useMe();
  const watches = useQuery({ queryKey: ["watches", projectId], queryFn: () => api.listWatches(projectId) });
  const lim = me.data?.monitoring;
  const canDaily = !!lim?.cadences.includes("daily");
  const list = watches.data ?? [];
  const slots = lim ? Math.max(0, lim.max_watches - lim.used) : 0;
  const full = !!lim && slots === 0;

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
            Monitoring
          </li>
        </ol>
      </nav>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Competitor monitoring</h1>
        <p className="mt-1 text-muted-foreground">
          We re-read the pages you watch and record what changed: prices first, then text. Every change shows exactly what we
          read and when.
        </p>
      </header>

      <Panel
        title="Watched pages"
        aside={
          lim ? (
            <span className="text-xs text-muted-foreground">
              {lim.used} of {lim.max_watches} pages watched · {canDaily ? "daily or weekly checks" : "weekly checks"}
            </span>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-4">
          {full && (
            <p className="rounded-control bg-warning/10 p-3 text-sm text-warning-text">
              You&apos;re watching as many pages as your plan allows.{" "}
              <Link href="/billing" className="font-medium underline">
                A credit pack raises the limit
              </Link>
              , or remove a page below.
            </p>
          )}
          <AddWatch projectId={projectId} canDaily={canDaily} full={full} />
          {watches.isSuccess && <FromReport projectId={projectId} watchedUrls={new Set(list.map((w) => w.url))} slots={slots} />}
          {watches.isPending ? (
            <div aria-busy="true">
              <span className="sr-only">Loading watched pages</span>
              <Skeleton className="h-24" />
            </div>
          ) : watches.isError ? (
            <ErrorState title="Couldn't load watched pages" onRetry={() => watches.refetch()} />
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing watched yet. Add a competitor&apos;s pricing or features page above.</p>
          ) : (
            <ul className="divide-y divide-border">
              {list.map((w) => (
                <WatchRow key={w.id} w={w} projectId={projectId} canDaily={canDaily} />
              ))}
            </ul>
          )}
        </div>
      </Panel>

      <Timeline projectId={projectId} watches={list} />
    </div>
  );
}
