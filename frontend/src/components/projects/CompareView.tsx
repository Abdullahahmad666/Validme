"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { fmtDate } from "@/components/evidence/EvidenceCard";
import { ConfidenceBadge } from "@/components/report/parts";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import type { Project } from "@/types/api";
import type { CompareRow, Recommendation } from "@/types/report";

const REC: Record<Recommendation, string> = {
  build: "Promising",
  research_more: "Research more",
  pivot: "Weak signal",
};
const MAX = 4;
const MAX_PAGES = 20; // 500 projects; plenty for a picker

/** Every researched project (all pages), so ideas past the first page can be picked too. */
async function allResearched(): Promise<Project[]> {
  const out: Project[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await api.listProjects({ page });
    out.push(...res.results.filter((p) => p.status !== "DRAFT"));
    if (!res.next) break;
  }
  return out;
}

function Cell({ row, dimKey }: { row: CompareRow; dimKey: string }) {
  const d = row.dimensions.find((x) => x.key === dimKey);
  if (!d) return <span className="text-muted-foreground">—</span>;
  if (!d.available) return <span className="text-xs italic text-muted-foreground">Not scored</span>;
  return (
    <span className="flex flex-wrap items-center justify-end gap-2">
      <span className="tabular-nums">{d.score}</span>
      <ConfidenceBadge level={d.confidence} />
    </span>
  );
}

const sticky = "sticky left-0 z-10 bg-card px-4 py-3 text-left";

/** Side-by-side latest reports for 2–4 of your ideas. Selection lives in the URL (?ids=a,b). */
export function CompareView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const projects = useQuery({ queryKey: ["projects", "researched-all"], queryFn: allResearched });
  const candidates = projects.data ?? [];
  const requested = (params.get("ids") ?? "").split(",").filter(Boolean);
  // Ids from the URL that aren't (or are no longer) your researched projects are dropped, and we say so.
  const selected = projects.data ? requested.filter((id) => candidates.some((p) => p.id === id)).slice(0, MAX) : [];
  const dropped = projects.data ? requested.length - selected.length : 0;
  const compare = useQuery({
    queryKey: ["compare", selected],
    queryFn: () => api.compareProjects(selected),
    enabled: selected.length >= 2,
  });
  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id].slice(0, MAX);
    router.replace(next.length ? `${pathname}?ids=${next.join(",")}` : pathname, { scroll: false });
  };
  const rows = compare.data?.results ?? [];
  const dims = rows[0]?.dimensions ?? [];

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <Link href="/projects" className="hover:text-foreground">
              My projects
            </Link>
            <ChevronRight className="size-3.5" aria-hidden />
          </li>
          <li aria-current="page" className="font-medium text-foreground">
            Compare
          </li>
        </ol>
      </nav>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Compare ideas</h1>
        <p className="mt-1 text-muted-foreground">Pick 2 to 4 researched ideas. Each column is that idea&apos;s latest report.</p>
      </header>

      {projects.isPending ? (
        <div aria-busy="true">
          <span className="sr-only">Loading your projects</span>
          <Skeleton className="h-16" />
        </div>
      ) : projects.isError ? (
        <ErrorState title="Couldn't load your projects" onRetry={() => projects.refetch()} />
      ) : candidates.length < 2 ? (
        <EmptyState
          title="You need two researched ideas to compare"
          body="Research another idea, then come back to see them side by side."
          actionHref="/research/new"
          actionLabel="+ New research"
        />
      ) : (
        <>
          <fieldset className="rounded-card border border-border bg-card p-4">
            <legend className="px-1 text-sm font-medium">
              Ideas ({selected.length}/{MAX})
            </legend>
            {dropped > 0 && (
              <p className="mb-2 text-xs text-muted-foreground" role="status">
                {dropped} idea{dropped === 1 ? " in the link isn't" : "s in the link aren't"} available any more, so{" "}
                {dropped === 1 ? "it was" : "they were"} left out.
              </p>
            )}
            <ul className="flex flex-wrap gap-2">
              {candidates.map((p) => {
                const on = selected.includes(p.id);
                const full = !on && selected.length >= MAX;
                return (
                  <li key={p.id}>
                    <label
                      className={cn(
                        "flex min-h-11 max-w-[18rem] cursor-pointer items-center gap-2 rounded-full border px-3 text-sm",
                        on ? "border-primary bg-primary/[0.06] text-primary" : "border-border",
                        full && "cursor-not-allowed opacity-50",
                      )}
                    >
                      <input type="checkbox" checked={on} disabled={full} onChange={() => toggle(p.id)} />
                      <span className="truncate">{p.name}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          {selected.length < 2 ? (
            <EmptyState title="Pick at least two ideas" body="The comparison shows score, confidence, each scoring dimension and evidence counts." />
          ) : compare.isPending ? (
            <div aria-busy="true">
              <span className="sr-only">Comparing</span>
              <Skeleton className="h-64" />
            </div>
          ) : compare.isError ? (
            <ErrorState title="Couldn't compare these ideas" onRetry={() => compare.refetch()} />
          ) : (
            <div className="overflow-x-auto rounded-card border border-border bg-card">
              <table className="w-full min-w-[560px] text-sm">
                <caption className="sr-only">Idea comparison</caption>
                <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className={cn(sticky, "bg-muted font-medium")}>
                      <span className="sr-only">Measure</span>
                    </th>
                    {rows.map((r) => (
                      <th key={r.id} scope="col" className="px-4 py-3 text-right font-medium">
                        {r.report_id ? (
                          <Link href={`/projects/${r.id}/report`} className="text-foreground hover:text-primary hover:underline">
                            {r.name}
                          </Link>
                        ) : (
                          r.name
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <th scope="row" className={cn(sticky, "font-medium")}>Score</th>
                    {rows.map((r) => (
                      <td key={r.id} className="px-4 py-3 text-right">
                        {r.score === null ? (
                          <span className="italic text-muted-foreground">Not scored</span>
                        ) : (
                          <span className="flex flex-col items-end gap-1">
                            <span className="text-lg font-semibold tabular-nums">{r.score}</span>
                            {r.confidence === "low" && (
                              <span className="inline-flex items-center gap-1 text-xs text-warning-text">
                                <AlertTriangle className="size-3" aria-hidden /> Low confidence
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className={cn(sticky, "font-medium")}>Confidence</th>
                    {rows.map((r) => (
                      <td key={r.id} className="px-4 py-3 text-right capitalize">{r.confidence ?? "—"}</td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className={cn(sticky, "font-medium")}>Recommendation</th>
                    {rows.map((r) => (
                      <td key={r.id} className="px-4 py-3 text-right">{r.recommendation ? REC[r.recommendation] : "No report"}</td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className={cn(sticky, "font-medium")}>Model scored</th>
                    {rows.map((r) => (
                      <td key={r.id} className="px-4 py-3 text-right tabular-nums">{r.scored_weight == null ? "—" : `${r.scored_weight}%`}</td>
                    ))}
                  </tr>
                  {dims.map((d) => (
                    <tr key={d.key}>
                      <th scope="row" className={cn(sticky, "font-normal text-muted-foreground")}>
                        {d.label} <span className="text-xs">· {d.weight}%</span>
                      </th>
                      {rows.map((r) => (
                        <td key={r.id} className="px-4 py-3 text-right">
                          <Cell row={r} dimKey={d.key} />
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <th scope="row" className={cn(sticky, "font-medium")}>Evidence · competitors</th>
                    {rows.map((r) => (
                      <td key={r.id} className="px-4 py-3 text-right tabular-nums">
                        {r.evidence_count} · {r.competitor_count}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row" className={cn(sticky, "font-medium")}>Report date</th>
                    {rows.map((r) => (
                      <td key={r.id} className="px-4 py-3 text-right">{r.generated_at ? fmtDate(r.generated_at) : "—"}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
              <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                Scores only compare fairly when the same share of the model was scored and confidence is similar. A higher score
                on low confidence isn&apos;t a better idea yet.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
