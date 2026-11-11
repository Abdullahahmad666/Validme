"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, CheckCircle2, ExternalLink, Minus, SearchCheck } from "lucide-react";
import { fmtDate } from "@/components/evidence/EvidenceCard";
import { AiLabel, Cited, Panel } from "@/components/report/parts";
import { ErrorState } from "@/components/shared/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { safeHref } from "@/lib/utils";
import { api } from "@/services/api";
import type { Report } from "@/types/report";

const MAX_FEATURE_ROWS = 15;

/** Pricing comparison, feature grid and gap candidates from this report's own competitor data. */
export function CompetitiveMatrix({ r }: { r: Report }) {
  const m = useQuery({
    queryKey: ["competitive-matrix", r.project.id, r.id],
    queryFn: () => api.competitiveMatrix(r.project.id, r.id),
    staleTime: Infinity, // a report snapshot never changes
  });
  if (m.isPending)
    return (
      <div aria-busy="true">
        <span className="sr-only">Loading the competitor comparison</span>
        <Skeleton className="h-48" />
      </div>
    );
  if (m.isError) return <ErrorState title="Couldn't load the comparison" onRetry={() => m.refetch()} />;
  const d = m.data;
  if (d.competitor_count === 0) return null;
  const names = new Map(d.pricing.map((p) => [p.competitor_id, p.name]));
  const cols = d.pricing.map((p) => p.competitor_id);
  const rows = d.features.slice(0, MAX_FEATURE_ROWS);

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Pricing compared" aside={<span className="text-xs text-muted-foreground">Verified prices only</span>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <caption className="sr-only">Competitor pricing</caption>
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="py-2 pr-3 font-medium">Competitor</th>
                <th scope="col" className="py-2 pr-3 font-medium">Plans</th>
                <th scope="col" className="py-2 pr-3 font-medium">Lowest</th>
                <th scope="col" className="py-2 font-medium">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {d.pricing.map((p) => (
                <tr key={p.competitor_id} className="align-top">
                  <th scope="row" className="py-2.5 pr-3 font-medium">{p.name}</th>
                  <td className="py-2.5 pr-3">
                    {p.status === "verified" ? (
                      <ul className="flex flex-col gap-0.5">
                        {p.plans.map((pl) => (
                          <li key={`${pl.name}-${pl.price}`} className="tabular-nums">
                            {pl.name ? `${pl.name}: ` : ""}
                            {pl.price}
                            {pl.period ? ` ${pl.period}` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="italic text-muted-foreground">Unavailable</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums">
                    {p.status !== "verified" ? (
                      "—"
                    ) : p.has_free ? (
                      "Free plan"
                    ) : p.lowest ? (
                      `${p.lowest.price}${p.lowest.period ? ` ${p.lowest.period}` : ""}`
                    ) : (
                      <span className="text-xs text-muted-foreground">{p.mixed_periods ? "Billed differently" : "—"}</span>
                    )}
                  </td>
                  <td className="py-2.5">
                    {p.status === "verified" && safeHref(p.source_url) ? (
                      <a
                        href={safeHref(p.source_url)}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="inline-flex items-center gap-1 text-xs text-success-text hover:underline"
                      >
                        <CheckCircle2 className="size-3" aria-hidden />
                        Pricing page, read {fmtDate(p.retrieved_at)}
                        <ExternalLink className="size-3" aria-hidden />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not found on their pages</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {rows.length > 0 && (
        <Panel
          title="Features compared"
          aside={d.features_ai_extracted ? <AiLabel>AI extracted from their pages</AiLabel> : undefined}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <caption className="sr-only">Which competitors list which features</caption>
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-medium">Feature</th>
                  {cols.map((id) => (
                    <th key={id} scope="col" className="px-2 py-2 text-center font-medium">
                      {names.get(id)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((f) => (
                  <tr key={f.feature}>
                    <th scope="row" className="py-2 pr-3 font-normal">{f.feature}</th>
                    {cols.map((id) => (
                      <td key={id} className="px-2 py-2 text-center">
                        {f.competitor_ids.includes(id) ? (
                          <>
                            <Check className="mx-auto size-4 text-success-text" aria-hidden />
                            <span className="sr-only">Listed</span>
                          </>
                        ) : (
                          <>
                            <Minus className="mx-auto size-4 text-muted-strong" aria-hidden />
                            <span className="sr-only">Not listed</span>
                          </>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Based on what each competitor lists on its own pages. &ldquo;Not listed&rdquo; doesn&apos;t prove they lack it.
            {d.features.length > MAX_FEATURE_ROWS ? ` Showing the ${MAX_FEATURE_ROWS} most common of ${d.features.length}.` : ""}
          </p>
        </Panel>
      )}

      <Panel title="Gap candidates" aside={<SearchCheck className="size-4 text-muted-foreground" aria-hidden />}>
        {d.gap_candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No complaint or request theme falls outside what competitors list. That can change as more evidence arrives.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {d.gap_candidates.map((g) => (
              <li key={g.theme} className="rounded-control border border-border p-3">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {g.theme} <AiLabel>AI theme</AiLabel>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {g.records} records · {g.distinct_sources} sources{g.confidence ? ` · ${g.confidence} confidence` : ""}
                </p>
                <div className="mt-2">
                  <Cited ids={g.evidence_ids} index={r.evidence_index} max={2} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">{d.method}</p>
      </Panel>
    </div>
  );
}
