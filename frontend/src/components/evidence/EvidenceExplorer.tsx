"use client";

import { Bookmark, Copy, Info, Layers, Search, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Attribution,
  CATEGORY_META,
  CategoryBadge,
  EvidenceCard,
  fmtDate,
  PROVIDER_LABELS,
  SaveButton,
  SourceLink,
} from "@/components/evidence/EvidenceCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useEvidence, useEvidenceFacets, useSaveEvidence, useThemes } from "@/hooks/useEvidence";
import { useProjects } from "@/hooks/useProjects";
import { cn } from "@/lib/utils";
import type { EvidenceCategory, EvidenceFilters, EvidenceTheme } from "@/types/api";

const CHIPS: { value: EvidenceCategory[] | null; label: string }[] = [
  { value: null, label: "All" },
  { value: ["pain_point"], label: "Pain points" },
  { value: ["buying_intent"], label: "Buying intent" },
  { value: ["feature_request"], label: "Feature requests" },
  { value: ["alternative_seeking", "pricing_objection"], label: "Alternatives & pricing" },
  { value: ["workaround"], label: "Workarounds" },
  { value: ["unclassified"], label: "Not classified" },
];

const CONFIDENCE: Record<string, string> = { high: "High confidence", medium: "Medium confidence", low: "Low confidence" };

function useFilters(): [EvidenceFilters, (patch: Partial<EvidenceFilters>) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filters: EvidenceFilters = {
    project: params.get("project") ?? undefined,
    category: (params.get("category")?.split(",").filter(Boolean) as EvidenceCategory[] | undefined) ?? undefined,
    provider: params.get("provider") ?? undefined,
    cluster: params.get("cluster") ? Number(params.get("cluster")) : undefined,
    q: params.get("q") ?? undefined,
    saved: params.get("saved") === "1",
    page: params.get("page") ? Number(params.get("page")) : undefined,
  };
  const set = (patch: Partial<EvidenceFilters>) => {
    const next = { ...filters, page: undefined, ...patch };
    const q = new URLSearchParams();
    if (next.project) q.set("project", next.project);
    if (next.category?.length) q.set("category", next.category.join(","));
    if (next.provider) q.set("provider", next.provider);
    if (next.cluster) q.set("cluster", String(next.cluster));
    if (next.q) q.set("q", next.q);
    if (next.saved) q.set("saved", "1");
    if (next.page && next.page > 1) q.set("page", String(next.page));
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };
  return [filters, set];
}

function ThemeList({ themes, active, onPick }: { themes: EvidenceTheme[]; active?: number; onPick: (id?: number) => void }) {
  return (
    <section aria-labelledby="themes-title" className="rounded-card border border-border bg-card p-5">
      <h2 id="themes-title" className="flex items-center gap-2 font-semibold">
        <Layers className="size-4 text-primary" aria-hidden />
        Themes
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        <Sparkles className="mr-1 inline size-3 text-ai" aria-hidden />
        Grouped by AI from the evidence. Confidence comes from how many separate sources back each theme.
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {themes.map((t) => {
          const on = active === t.id;
          return (
            <li key={t.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onPick(on ? undefined : t.id)}
                className={cn(
                  "w-full rounded-control border p-3 text-left transition-colors",
                  on ? "border-primary bg-primary/[0.05]" : "border-border hover:bg-muted",
                )}
              >
                <span className="block text-sm font-medium">{t.name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t.distinct_sources} source{t.distinct_sources === 1 ? "" : "s"} · {CONFIDENCE[t.confidence] ?? "Confidence unknown"}
                  {t.severity && ` · ${t.severity} severity`}
                </span>
                <span className="mt-1.5 block text-xs leading-relaxed text-foreground/80">{t.ai_summary}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function EvidenceExplorer() {
  const [filters, setFilters] = useFilters();
  const projects = useProjects();
  const researched = useMemo(() => (projects.data?.results ?? []).filter((p) => p.status !== "DRAFT"), [projects.data]);

  // Default to the most recent researched project.
  useEffect(() => {
    if (!filters.project && researched[0]) setFilters({ project: researched[0].id });
  }, [filters.project, researched, setFilters]);

  const evidence = useEvidence(filters);
  const facets = useEvidenceFacets(filters.project);
  const themes = useThemes(filters.project);
  const save = useSaveEvidence();
  const [search, setSearch] = useState(filters.q ?? "");

  // Debounced search into the URL.
  useEffect(() => {
    const t = setTimeout(() => {
      if ((filters.q ?? "") !== search.trim()) setFilters({ q: search.trim() || undefined });
    }, 350);
    return () => clearTimeout(t);
  }, [search, filters.q, setFilters]);

  if (projects.isPending) return <Skeleton className="h-96" aria-busy="true" />;
  if (projects.isError) return <ErrorState title="Couldn't load your projects" onRetry={() => projects.refetch()} />;
  if (researched.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">Evidence explorer</h1>
        <EmptyState
          title="No evidence yet"
          body="Evidence appears here once you launch research on an idea. Every record links to its source."
          actionHref="/research/new"
          actionLabel="Start research"
        />
      </div>
    );
  }

  const f = facets.data;
  const chipCount = (cats: EvidenceCategory[] | null) =>
    f ? (cats ? cats.reduce((n, c) => n + (f.categories[c] ?? 0), 0) : f.total) : undefined;
  const activeChip = (cats: EvidenceCategory[] | null) =>
    cats === null ? !filters.category?.length : cats.join(",") === (filters.category ?? []).join(",");
  const page = evidence.data;
  const pageNum = filters.page ?? 1;
  const hasFilters = !!(filters.category?.length || filters.provider || filters.cluster || filters.q || filters.saved);
  const unclassified = f?.categories.unclassified ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Evidence explorer</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Verbatim excerpts from the sources your research searched, each linked to the original.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="project-select">Project</Label>
          <select
            id="project-select"
            value={filters.project ?? ""}
            onChange={(e) => setFilters({ project: e.target.value, cluster: undefined })}
            className="h-11 min-w-56 rounded-control border border-input bg-card px-3 text-sm"
          >
            {researched.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {f && unclassified > 0 && unclassified === f.total && (
        <p className="flex items-start gap-2 rounded-control border border-border bg-card p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          This evidence hasn&apos;t been classified: AI analysis wasn&apos;t available when the research ran. Every record
          is still the source&apos;s own words with its link.
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Filters */}
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search excerpts and titles"
                aria-label="Search evidence"
                className="h-11 pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
              {CHIPS.map((c) => {
                const n = chipCount(c.value);
                if (c.value && n === 0) return null;
                return (
                  <button
                    key={c.label}
                    type="button"
                    aria-pressed={activeChip(c.value)}
                    onClick={() => setFilters({ category: c.value ?? undefined })}
                    className={cn(
                      "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm",
                      activeChip(c.value) ? "border-primary bg-primary/10 font-medium text-primary" : "border-border bg-card hover:bg-muted",
                    )}
                  >
                    {c.label}
                    {n !== undefined && <span className="tabular-nums text-muted-foreground">{n}</span>}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter by source"
                value={filters.provider ?? ""}
                onChange={(e) => setFilters({ provider: e.target.value || undefined })}
                className="h-10 rounded-control border border-input bg-card px-3 text-sm"
              >
                <option value="">All sources</option>
                {Object.entries(f?.providers ?? {}).map(([k, n]) => (
                  <option key={k} value={k}>
                    {PROVIDER_LABELS[k] ?? k} ({n})
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-pressed={!!filters.saved}
                onClick={() => setFilters({ saved: !filters.saved })}
                className={cn(
                  "inline-flex min-h-10 items-center gap-1.5 rounded-control border px-3 text-sm",
                  filters.saved ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-muted",
                )}
              >
                <Bookmark className="size-4" aria-hidden />
                Saved {f ? `(${f.saved})` : ""}
              </button>
              {hasFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setSearch("");
                    setFilters({ category: undefined, provider: undefined, cluster: undefined, q: undefined, saved: false });
                  }}
                >
                  <X aria-hidden />
                  Clear filters
                </Button>
              )}
            </div>
            {page && (
              <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
                {page.count} record{page.count === 1 ? "" : "s"}
                {f && f.duplicates > 0 && (
                  <>
                    {" "}
                    · <Copy className="inline size-3.5" aria-hidden /> {f.duplicates} near-duplicate{f.duplicates === 1 ? "" : "s"} merged
                    into their originals
                  </>
                )}
              </p>
            )}
          </div>

          {/* Results */}
          {evidence.isPending ? (
            <div className="flex flex-col gap-3" aria-busy="true">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          ) : evidence.isError ? (
            <ErrorState title="Couldn't load evidence" onRetry={() => evidence.refetch()} />
          ) : page && page.results.length === 0 ? (
            <div className="rounded-card border border-dashed border-border bg-card p-8 text-center">
              <p className="font-medium">No evidence matches</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                {hasFilters
                  ? "Try clearing a filter or searching for a shorter phrase."
                  : "This research didn't store any evidence. Check which sources ran on the progress page, then try broader queries."}
              </p>
              {!hasFilters && filters.project && (
                <Link href={`/projects/${filters.project}/progress`} className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
                  View research progress
                </Link>
              )}
            </div>
          ) : page ? (
            <>
              {/* Mobile / tablet: cards */}
              <ul className="flex flex-col gap-3 lg:hidden">
                {page.results.map((e) => (
                  <li key={e.id}>
                    <EvidenceCard evidence={e} onToggleSave={() => save.mutate({ id: e.id, saved: !e.saved_by_user })} />
                  </li>
                ))}
              </ul>
              {/* Desktop: table */}
              <div className="hidden overflow-x-auto rounded-card border border-border bg-card lg:block">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Evidence records</caption>
                  <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">Source and excerpt</th>
                      <th scope="col" className="w-40 px-4 py-3 font-medium">Category</th>
                      <th scope="col" className="w-36 px-4 py-3 font-medium">Dates</th>
                      <th scope="col" className="w-24 px-4 py-3 font-medium"><span className="sr-only">Save</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {page.results.map((e) => (
                      <tr key={e.id} className="align-top">
                        <td className="px-4 py-3">
                          <p className="text-xs text-muted-foreground">
                            {PROVIDER_LABELS[e.provider] ?? e.provider}
                            {e.duplicates > 0 && ` · ${e.duplicates} duplicate${e.duplicates > 1 ? "s" : ""} merged`}
                          </p>
                          <SourceLink evidence={e} className="mt-0.5" />
                          <p className="mt-1.5 text-foreground/85">{e.excerpt}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            <Attribution evidence={e} />
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <CategoryBadge evidence={e} />
                          {e.classification.relevance !== null && (
                            <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                              Relevance {Math.round(e.classification.relevance * 100)}%
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          <p>Published {fmtDate(e.published_at)}</p>
                          <p>Retrieved {fmtDate(e.retrieved_at)}</p>
                        </td>
                        <td className="px-2 py-2">
                          <SaveButton evidence={e} onToggle={() => save.mutate({ id: e.id, saved: !e.saved_by_user })} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(page.next || page.previous) && (
                <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
                  <Button variant="outline" disabled={!page.previous} onClick={() => setFilters({ ...filters, page: pageNum - 1 })}>
                    Previous
                  </Button>
                  <span className="text-sm tabular-nums text-muted-foreground">Page {pageNum}</span>
                  <Button variant="outline" disabled={!page.next} onClick={() => setFilters({ ...filters, page: pageNum + 1 })}>
                    Next
                  </Button>
                </nav>
              )}
            </>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4">
          {themes.data && themes.data.length > 0 ? (
            <ThemeList themes={themes.data} active={filters.cluster} onPick={(id) => setFilters({ cluster: id })} />
          ) : (
            <section className="rounded-card border border-border bg-card p-5 text-sm text-muted-foreground">
              <h2 className="flex items-center gap-2 font-semibold text-foreground">
                <Layers className="size-4 text-primary" aria-hidden />
                Themes
              </h2>
              <p className="mt-2">
                No themes yet. Themes appear when AI analysis can group at least two relevant records into the same problem.
              </p>
            </section>
          )}
          {f && Object.keys(f.categories).length > 0 && (
            <section className="rounded-card border border-border bg-card p-5">
              <h2 className="font-semibold">By category</h2>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {Object.entries(f.categories)
                  .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
                  .map(([cat, n]) => (
                    <li key={cat} className="flex items-center justify-between gap-3">
                      <span>{CATEGORY_META[cat as EvidenceCategory]?.label ?? cat}</span>
                      <span className="tabular-nums text-muted-foreground">{n}</span>
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
