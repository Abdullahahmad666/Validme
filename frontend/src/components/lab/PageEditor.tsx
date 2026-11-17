"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronRight, Download, ExternalLink, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { fmtDate } from "@/components/evidence/EvidenceCard";
import { BlockFields, blockTitle } from "@/components/lab/BlockFields";
import { StatusBadge } from "@/components/lab/LabView";
import { PagePreview } from "@/components/lab/PagePreview";
import { AiLabel, Panel } from "@/components/report/parts";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { BLOCK_LABELS, emptyBlock, moveItem, RETENTION_OPTIONS, slugify } from "@/lib/lab";
import { cn, safeHref } from "@/lib/utils";
import { API_URL, api, ApiError } from "@/services/api";
import type { Block, BlockType, LabPage } from "@/types/lab";

type Draft = Pick<LabPage, "title" | "slug" | "blocks" | "retention_days">;

function errorList(err: unknown): string[] {
  if (!(err instanceof ApiError)) return ["Something went wrong. Please try again."];
  const d = err.details as Record<string, unknown> | undefined;
  const flat = (v: unknown): string[] => (Array.isArray(v) ? v.flatMap(flat) : typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(flat) : []);
  const fromDetails = d ? flat(d.details ?? d) : [];
  return fromDetails.length ? fromDetails.slice(0, 6) : [err.message];
}

function Stats({ projectId, pageId }: { projectId: string; pageId: number }) {
  const stats = useQuery({ queryKey: ["lab-stats", projectId, pageId], queryFn: () => api.labStats(projectId, pageId) });
  return (
    <Panel title="Results" as="h2" aside={<span className="text-xs text-muted-foreground">Counted by us: no cookies or tracking scripts</span>}>
      {stats.isPending ? (
        <Skeleton className="h-16" />
      ) : stats.isError ? (
        <ErrorState title="Couldn't load the results" onRetry={() => stats.refetch()} />
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-control bg-muted/50 p-3">
              <dt className="text-xs text-muted-foreground">Page views</dt>
              <dd className="text-2xl font-semibold tabular-nums">{stats.data.views}</dd>
            </div>
            <div className="rounded-control bg-muted/50 p-3">
              <dt className="text-xs text-muted-foreground">Sign-ups</dt>
              <dd className="text-2xl font-semibold tabular-nums">{stats.data.signups}</dd>
            </div>
            <div className="rounded-control bg-muted/50 p-3">
              <dt className="text-xs text-muted-foreground">Conversion</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {stats.data.conversion === null ? <span className="text-base text-muted-foreground">No views yet</span> : `${(stats.data.conversion * 100).toFixed(1)}%`}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">
            Views count page loads (bots and repeat loads after joining excluded); without cookies we can&apos;t tell repeat
            visitors apart. {stats.data.current_signups} sign-up{stats.data.current_signups === 1 ? " is" : "s are"} stored now
            (after deletions and expiry). Small numbers say little: a handful of sign-ups isn&apos;t proof of demand.
          </p>
        </>
      )}
    </Panel>
  );
}

function Signups({ projectId, pageId }: { projectId: string; pageId: number }) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["lab-signups", projectId, pageId], queryFn: () => api.labSignups(projectId, pageId) });
  const [confirmAll, setConfirmAll] = useState(false);
  const del = useMutation({
    mutationFn: (body: { ids?: number[]; all?: boolean }) => api.deleteLabSignups(projectId, pageId, body),
    onSuccess: () => {
      setConfirmAll(false);
      qc.invalidateQueries({ queryKey: ["lab-signups", projectId, pageId] });
      qc.invalidateQueries({ queryKey: ["lab-stats", projectId, pageId] });
    },
  });
  const rows = list.data?.results ?? [];
  return (
    <Panel
      title="Waitlist"
      as="h2"
      aside={
        rows.length > 0 ? (
          <a href={`${API_URL}/projects/${encodeURIComponent(projectId)}/lab-pages/${pageId}/signups-export`} className="inline-flex min-h-11 items-center gap-1 text-sm text-primary underline">
            <Download className="size-4" aria-hidden /> Export CSV
          </a>
        ) : undefined
      }
    >
      <p className="mb-2 text-sm text-muted-foreground">
        Emails are stored encrypted and deleted automatically after the retention period. Use them only to tell these
        people about this product, as they agreed. If someone asks to be removed, delete them here.
      </p>
      {list.isPending ? (
        <Skeleton className="h-16" />
      ) : list.isError ? (
        <ErrorState title="Couldn't load the waitlist" onRetry={() => list.refetch()} />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sign-ups yet.</p>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {rows.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block break-all font-medium">{s.email ?? "Unavailable (can't be decrypted)"}</span>
                  <span className="text-xs text-muted-foreground">
                    Joined {fmtDate(s.joined_at)} · deleted after {fmtDate(s.expires_at)}
                  </span>
                </span>
                <Button size="icon" variant="ghost" className="size-11" disabled={del.isPending} onClick={() => del.mutate({ ids: [s.id] })} aria-label={`Delete ${s.email ?? "this sign-up"}`}>
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {confirmAll ? (
              <>
                <span className="text-sm">Delete all {rows.length} sign-ups permanently?</span>
                <Button variant="destructive" className="min-h-11" disabled={del.isPending} onClick={() => del.mutate({ all: true })}>
                  Delete all
                </Button>
                <Button variant="ghost" className="min-h-11" onClick={() => setConfirmAll(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="outline" className="min-h-11" onClick={() => setConfirmAll(true)}>
                Delete all…
              </Button>
            )}
          </div>
        </>
      )}
      {del.isError && (
        <p role="alert" className="mt-2 text-sm text-destructive-text">
          Couldn&apos;t delete. Please try again.
        </p>
      )}
    </Panel>
  );
}

function Editor({ projectId, page }: { projectId: string; page: LabPage }) {
  const qc = useQueryClient();
  const router = useRouter();
  const ids = { title: useId(), slug: useId(), retention: useId(), add: useId() };
  const [draft, setDraft] = useState<Draft>({ title: page.title, slug: page.slug, blocks: page.blocks, retention_days: page.retention_days });
  const [dirty, setDirty] = useState(false);
  const [slugNote, setSlugNote] = useState("");
  const [addType, setAddType] = useState<BlockType>("problem");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const live = page.status === "published";
  const edit = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };
  const refresh = (p: LabPage) => {
    qc.setQueryData(["lab-page", projectId, page.id], p);
    qc.invalidateQueries({ queryKey: ["lab-pages", projectId] });
  };
  const save = useMutation({
    mutationFn: () => api.updateLabPage(projectId, page.id, { ...draft, slug: draft.slug || null }),
    onSuccess: (p) => {
      setDirty(false);
      refresh(p);
    },
  });
  const publish = useMutation({
    mutationFn: async (on: boolean) => {
      if (on && dirty) await api.updateLabPage(projectId, page.id, { ...draft, slug: draft.slug || null });
      return api.setLabPagePublished(projectId, page.id, on);
    },
    onSuccess: (p) => {
      setDirty(false);
      refresh(p);
    },
  });
  const suggest = useMutation({ mutationFn: () => api.labSuggest(projectId) });
  const remove = useMutation({
    mutationFn: () => api.deleteLabPage(projectId, page.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lab-pages", projectId] });
      router.push(`/projects/${projectId}/lab`);
    },
  });
  const checkSlug = async () => {
    if (!draft.slug) return setSlugNote("");
    try {
      const r = await api.labSlug(draft.slug, page.id);
      setSlugNote(r.available ? "Available" : r.reason);
    } catch {
      setSlugNote("");
    }
  };
  const applySuggested = (blocks: Block[]) => {
    const keep = draft.blocks.filter((b) => b.type === "pricing" || b.type === "waitlist");
    edit({ blocks: [...blocks, ...keep] });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-5">
        <Panel title="Page" as="h2" aside={<StatusBadge status={page.status} />}>
          <div className="grid gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor={ids.title}>Title (browser tab and your list)</Label>
              <Input id={ids.title} value={draft.title} maxLength={80} onChange={(e) => edit({ title: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={ids.slug}>Web address</Label>
              <div className="flex items-center gap-1 text-sm">
                <span className="shrink-0 text-muted-foreground">{page.base_url}</span>
                <Input
                  id={ids.slug}
                  value={draft.slug ?? ""}
                  maxLength={48}
                  disabled={live}
                  placeholder={slugify(draft.title) || "your-idea"}
                  onChange={(e) => edit({ slug: slugify(e.target.value) || null })}
                  onBlur={checkSlug}
                  aria-describedby={`${ids.slug}-hint`}
                />
              </div>
              <p id={`${ids.slug}-hint`} className={cn("text-xs", slugNote && slugNote !== "Available" ? "text-destructive-text" : "text-muted-foreground")}>
                {live ? "Unpublish to change the address (links people have would break)." : slugNote || "Lowercase letters, numbers and hyphens."}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={ids.retention}>Keep sign-ups for</Label>
              <select
                id={ids.retention}
                className="h-11 rounded-control border border-input bg-background px-3 text-sm"
                value={draft.retention_days}
                onChange={(e) => edit({ retention_days: Number(e.target.value) })}
              >
                {RETENTION_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} days
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Shown to people when they join; each sign-up is deleted after it.</p>
            </div>
          </div>
        </Panel>

        <Panel title="Blocks" as="h2">
          <div className="mb-3 flex flex-wrap gap-2">
            <Button variant="outline" className="min-h-11" onClick={() => suggest.mutate()} disabled={suggest.isPending}>
              <Sparkles aria-hidden /> {suggest.isPending ? "Writing…" : "Suggest copy with AI"}
            </Button>
          </div>
          {suggest.isError && (
            <p role="alert" className="mb-3 text-sm text-destructive-text">
              {suggest.error instanceof ApiError ? suggest.error.message : "Couldn't get suggestions."}
            </p>
          )}
          {suggest.isSuccess && (
            <div className="mb-4 rounded-control bg-ai/[0.06] p-3 text-sm">
              <AiLabel>AI suggestion: edit before publishing</AiLabel>
              <p className="mt-1 text-muted-foreground">
                A draft of the hero, problem, benefits and FAQ from your idea. It contains no numbers, prices or claims; check every
                sentence is true for you.
              </p>
              <ul className="mt-2 list-disc pl-5">
                {suggest.data.blocks.map((b, i) => (
                  <li key={i}>
                    <span className="font-medium">{blockTitle(b)}:</span>{" "}
                    {b.type === "hero" ? b.headline : b.type === "problem" ? b.body.slice(0, 90) + "…" : `${"items" in b ? b.items.length : 0} items`}
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <Button className="min-h-11" onClick={() => applySuggested(suggest.data.blocks)}>
                  Use these (keeps your prices and waitlist)
                </Button>
                <Button variant="ghost" className="min-h-11" onClick={() => suggest.reset()}>
                  Dismiss
                </Button>
              </div>
            </div>
          )}
          {draft.blocks.length === 0 && <p className="mb-3 text-sm text-muted-foreground">No blocks yet. A page needs a hero and a waitlist form.</p>}
          <ol className="flex flex-col gap-3">
            {draft.blocks.map((b, i) => (
              <li key={i} className="rounded-control border border-border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    {i + 1}. {blockTitle(b)}
                  </h3>
                  <span className="flex gap-1">
                    <Button size="icon" variant="ghost" className="size-11" onClick={() => edit({ blocks: moveItem(draft.blocks, i, i - 1) })} disabled={i === 0} aria-label={`Move ${blockTitle(b)} up`}>
                      <ArrowUp aria-hidden />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-11" onClick={() => edit({ blocks: moveItem(draft.blocks, i, i + 1) })} disabled={i === draft.blocks.length - 1} aria-label={`Move ${blockTitle(b)} down`}>
                      <ArrowDown aria-hidden />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-11" onClick={() => edit({ blocks: draft.blocks.filter((_, j) => j !== i) })} aria-label={`Remove ${blockTitle(b)}`}>
                      <Trash2 aria-hidden />
                    </Button>
                  </span>
                </div>
                <BlockFields block={b} onChange={(nb) => edit({ blocks: draft.blocks.map((x, j) => (j === i ? nb : x)) })} />
              </li>
            ))}
          </ol>
          {draft.blocks.length < 12 && (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor={ids.add} className="text-xs">
                  Add a block
                </Label>
                <select id={ids.add} className="h-11 rounded-control border border-input bg-background px-3 text-sm" value={addType} onChange={(e) => setAddType(e.target.value as BlockType)}>
                  {(Object.keys(BLOCK_LABELS) as BlockType[]).map((t) => (
                    <option key={t} value={t}>
                      {BLOCK_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <Button variant="outline" className="min-h-11" onClick={() => edit({ blocks: [...draft.blocks, emptyBlock(addType)] })}>
                Add
              </Button>
            </div>
          )}
        </Panel>

        <div className="sticky bottom-16 z-10 flex flex-wrap items-center gap-2 rounded-card border border-border bg-card p-3 shadow-sm lg:bottom-4">
          <Button className="min-h-11" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
            {save.isPending ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </Button>
          {live ? (
            <Button variant="outline" className="min-h-11" onClick={() => publish.mutate(false)} disabled={publish.isPending}>
              Unpublish
            </Button>
          ) : (
            <Button variant="outline" className="min-h-11" onClick={() => publish.mutate(true)} disabled={publish.isPending}>
              {publish.isPending ? "Publishing…" : dirty ? "Save and publish" : "Publish"}
            </Button>
          )}
          {page.url && safeHref(page.url) && (
            <a href={safeHref(page.url)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 text-sm text-primary underline">
              Open live page <ExternalLink className="size-3.5" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
          <span className="ml-auto">
            {confirmDelete ? (
              <span className="flex items-center gap-2 text-sm">
                Delete the page and its sign-ups?
                <Button variant="destructive" className="min-h-11" onClick={() => remove.mutate()} disabled={remove.isPending}>
                  Delete
                </Button>
                <Button variant="ghost" className="min-h-11" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </span>
            ) : (
              <Button variant="ghost" className="min-h-11" onClick={() => setConfirmDelete(true)}>
                Delete page…
              </Button>
            )}
          </span>
          {(save.isError || publish.isError) && (
            <ul role="alert" className="w-full list-disc pl-5 text-sm text-destructive-text">
              {errorList(save.error ?? publish.error).map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
          {publish.isSuccess && (
            <p role="status" className="w-full text-sm text-muted-foreground">
              {live ? "Your page is live." : "Your page is unpublished: its address now shows “not found”."}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <section aria-labelledby="preview-h" className="lg:sticky lg:top-4">
          <h2 id="preview-h" className="mb-2 font-semibold">
            Preview
          </h2>
          <PagePreview blocks={draft.blocks} retentionDays={draft.retention_days} />
        </section>
        <Stats projectId={projectId} pageId={page.id} />
        <Signups projectId={projectId} pageId={page.id} />
      </div>
    </div>
  );
}

export function PageEditor({ projectId, pageId }: { projectId: string; pageId: number }) {
  const page = useQuery({ queryKey: ["lab-page", projectId, pageId], queryFn: () => api.labPage(projectId, pageId), enabled: Number.isFinite(pageId) });
  if (page.isError && page.error instanceof ApiError && page.error.status === 404) {
    return <EmptyState title="Page not found" body="It may have been deleted, or it belongs to another account." actionHref={`/projects/${projectId}/lab`} actionLabel="Validation Lab" />;
  }
  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <Link href={`/projects/${projectId}/lab`} className="hover:text-foreground">
              Validation Lab
            </Link>
            <ChevronRight className="size-3.5" aria-hidden />
          </li>
          <li aria-current="page" className="max-w-[16rem] truncate font-medium text-foreground">
            {page.data?.title ?? "Test page"}
          </li>
        </ol>
      </nav>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{page.data?.title ?? "Test page"}</h1>
      {page.isPending ? (
        <Skeleton className="h-96" aria-busy="true" />
      ) : page.isError ? (
        <ErrorState title="Couldn't load the page" onRetry={() => page.refetch()} />
      ) : (
        <Editor key={page.data.updated_at} projectId={projectId} page={page.data} />
      )}
    </div>
  );
}
