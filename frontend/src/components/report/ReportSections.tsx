"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, ExternalLink, FlaskConical, HelpCircle, Info, Lightbulb, MinusCircle, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CATEGORY_META, PROVIDER_LABELS, fmtDate } from "@/components/evidence/EvidenceCard";
import { BarList } from "@/components/charts/BarList";
import { DailyChart } from "@/components/charts/DailyChart";
import { priceLadder } from "@/components/charts/prices";
import { ScoreBreakdown, ScoreRing } from "@/components/charts/ScoreCharts";
import { AiLabel, Cited, ConfidenceBadge, EvidenceQuote, LEVEL_STYLE, Panel } from "@/components/report/parts";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn, safeHref } from "@/lib/utils";
import type { EvidenceCategory } from "@/types/api";
import type { Recommendation, Report, ReportCompetitor } from "@/types/report";

const RECOMMENDATION: Record<Recommendation, { label: string; className: string }> = {
  build: { label: "Promising: validate with customers", className: "bg-success/10 text-success-text" },
  research_more: { label: "Research more before deciding", className: "bg-warning/10 text-warning-text" },
  pivot: { label: "Weak signal: consider a different angle", className: "bg-destructive/10 text-destructive-text" },
};

export function Overview({ r }: { r: Report }) {
  const o = r.overview;
  const rec = RECOMMENDATION[o.recommendation];
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
        <section className="rounded-card border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Opportunity score</p>
          <div className="mt-3">
            <ScoreRing score={o.score} />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <ConfidenceBadge level={o.confidence} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Based on {r.opportunity.scored_weight}% of the scoring model; the rest needs evidence this research can&apos;t provide.
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Evidence</dt>
              <dd className="font-semibold tabular-nums">{o.evidence_count}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Competitors</dt>
              <dd className="font-semibold tabular-nums">{o.competitor_count}</dd>
            </div>
          </dl>
        </section>
        <section className="rounded-card border border-border bg-card p-5">
          <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", rec.className)}>{rec.label}</span>
          <p className="mt-3 leading-relaxed">{o.summary}</p>
          <h3 className="mt-5 text-sm font-medium text-muted-foreground">Key findings</h3>
          {o.key_findings.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{r.demand.classified ? "No findings yet: the research didn't collect relevant evidence." : "No findings: the evidence wasn't classified (AI was unavailable for this run), so nothing is presented as a finding. Browse the raw records in the Evidence tab."}</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-3">
              {o.key_findings.map((f) => (
                <li key={f.text} className="rounded-control border border-border p-3">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {f.text}
                    {f.ai && <AiLabel>AI theme</AiLabel>}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{f.detail}</p>
                  <div className="mt-2">
                    <Cited ids={f.evidence_ids} index={r.evidence_index} max={1} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-5 flex items-start gap-2 rounded-control bg-primary/[0.06] p-3 text-sm">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span>
              <span className="font-semibold">Recommended next step: </span>
              {o.next_step}
            </span>
          </p>
        </section>
      </div>
      <Panel title="What the score is made of" aside={<span className="text-xs text-muted-foreground">Each part out of 100 · weight after the name</span>}>
        <ScoreBreakdown dimensions={r.opportunity.dimensions} />
        <p className="mt-2 text-xs text-muted-foreground">Explanations and evidence for each part are on the Market gaps tab.</p>
      </Panel>
    </div>
  );
}

export function Demand({ r }: { r: Report }) {
  const d = r.demand;
  const cats = Object.entries(d.by_category).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)) as [EvidenceCategory, number][];
  const sources = Object.entries(d.by_source);
  const total = sources.reduce((n, [, v]) => n + v, 0);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Signals by category" aside={!d.classified ? <span className="text-xs text-muted-foreground">Not classified</span> : <AiLabel>AI classification</AiLabel>}>
        {!d.classified ? (
          <p className="text-sm text-muted-foreground">Evidence wasn&apos;t classified (AI unavailable when this ran), so signals can&apos;t be broken down.</p>
        ) : (
          <BarList rows={cats.map(([c, n]) => ({ label: CATEGORY_META[c]?.label ?? c, value: n }))} unit="records" />
        )}
      </Panel>
      <Panel title="Evidence by source">
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">No evidence collected.</p>
        ) : (
          <BarList
            rows={[...sources].sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ label: PROVIDER_LABELS[k] ?? k, value: n }))}
            unit="records"
          />
        )}
        <p className="mt-5 text-sm text-muted-foreground">
          {d.date_range ? `Published ${fmtDate(d.date_range[0])} – ${fmtDate(d.date_range[1])}.` : "Publication dates unavailable."}{" "}
          Sources searched:{" "}
          {Object.entries(r.coverage)
            .map(([k, v]) => `${PROVIDER_LABELS[k] ?? k} (${v.toLowerCase()})`)
            .join(", ") || "none"}
          .
        </p>
      </Panel>
      {d.by_month && d.by_month.length > 1 && (
        <Panel title="Published over time" className="lg:col-span-2">
          <DailyChart
            rows={d.by_month.map((m) => ({ day: m.month, records: m.records }))}
            series={[{ key: "records", label: "Records", kind: "bar", color: "var(--series-1)" }]}
            period="month"
            height={200}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            By the date each post or page was published (last 24 months at most).
            {d.undated ? ` ${d.undated} record${d.undated === 1 ? " has" : "s have"} no publication date and ${d.undated === 1 ? "isn't" : "aren't"} shown.` : ""}
          </p>
        </Panel>
      )}
      <Panel title="Buying intent" className="lg:col-span-2">
        {d.buying_intent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No buying-intent evidence found. That doesn&apos;t mean none exists, only that these sources didn&apos;t show it.</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {d.buying_intent.map((e) => (
              <EvidenceQuote key={e.id} e={e} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export function PainPoints({ r }: { r: Report }) {
  if (r.pain_points.length === 0) {
    return (
      <Panel title="Pain points">
        <p className="text-sm text-muted-foreground">
          No themes yet. Themes need classified evidence with at least two related records. See the Demand tab for what was collected.
        </p>
      </Panel>
    );
  }
  const ranked = [...r.pain_points].sort((a, b) => b.distinct_sources - a.distinct_sources);
  return (
    <div className="flex flex-col gap-4">
    <Panel title="Themes by number of separate sources" aside={<AiLabel>AI themes</AiLabel>}>
      <BarList
        rows={ranked.map((t) => ({
          label: t.name,
          value: t.distinct_sources,
          note: `${t.records} records · severity (AI): ${t.severity || "not rated"}`,
        }))}
        unit="sources"
        labelWidth={190}
      />
      <p className="mt-1 text-xs text-muted-foreground">Separate sources, not posts: several posts from one page count once.</p>
    </Panel>
    <ul className="grid gap-4 lg:grid-cols-2">
      {r.pain_points.map((t) => (
        <li key={t.id} className="rounded-card border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-semibold">{t.name}</h3>
            <ConfidenceBadge level={t.confidence} />
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Sources</dt>
              <dd className="tabular-nums">{t.distinct_sources}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Authors</dt>
              <dd className="tabular-nums">{t.distinct_authors ?? "Unavailable"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Severity (AI)</dt>
              <dd className="capitalize">{t.severity || "—"}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm leading-relaxed">
            <AiLabel /> <span className="ml-1">{t.ai_summary}</span>
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {t.samples.map((e) => (
              <EvidenceQuote key={e.id} e={e} />
            ))}
          </ul>
          <Link href={`/evidence?project=${r.project.id}&cluster=${t.id}`} className="mt-3 inline-flex min-h-10 items-center gap-1 text-sm font-medium text-primary hover:underline">
            All {t.records} records <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
    </div>
  );
}

function Pricing({ c }: { c: ReportCompetitor }) {
  if (c.pricing.status !== "verified") return <span className="italic text-muted-foreground">Unavailable</span>;
  return (
    <span className="flex flex-col">
      {c.pricing.plans.slice(0, 3).map((p) => (
        <span key={`${p.name}-${p.price}`} className="tabular-nums">
          {p.name ? `${p.name}: ` : ""}
          {p.price}
          {p.period && ` ${p.period}`}
        </span>
      ))}
      <span className="text-xs text-success-text">
        <CheckCircle2 className="mr-0.5 inline size-3" aria-hidden />
        Verified on page{c.pricing.retrieved_at ? `, ${fmtDate(c.pricing.retrieved_at)}` : ""}
      </span>
    </span>
  );
}

/** Verified monthly prices on one scale, cheapest first (only what their own pricing pages said). */
function PriceLadderPanel({ competitors }: { competitors: ReportCompetitor[] }) {
  const { currency, points, excluded } = priceLadder(competitors);
  if (points.length === 0) return null;
  return (
    <Panel title="Verified monthly prices" aside={<span className="text-xs text-muted-foreground">From their own pricing pages</span>}>
      <BarList rows={points} unit={`${currency} per month`} labelWidth={200} additive={false} />
      <p className="mt-1 text-xs text-muted-foreground">
        Only prices shown exactly on a competitor&apos;s page and billed monthly in {currency}.
        {excluded > 0 && ` ${excluded} other plan${excluded === 1 ? " (free, yearly, per-seat, another currency or no exact price) is" : "s (free, yearly, per-seat, another currency or no exact price) are"} not drawn.`}{" "}
        Unverified prices are never shown.
      </p>
    </Panel>
  );
}

export function Competitors({ r }: { r: Report }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<ReportCompetitor | null>(null);
  const list = useMemo(
    () => r.competitors.filter((c) => `${c.name} ${c.positioning} ${c.identified_gap}`.toLowerCase().includes(q.toLowerCase())),
    [r.competitors, q],
  );
  if (r.competitors.length === 0) {
    return (
      <Panel title="Competitors">
        <p className="text-sm text-muted-foreground">
          No competitors were found in the searched sources, and none were listed. Add competitor websites in the setup of your next
          research to compare pricing and complaints.
        </p>
      </Panel>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <PriceLadderPanel competitors={r.competitors} />
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search competitors" aria-label="Search competitors" className="h-11 pl-9" />
      </div>
      <div className="overflow-x-auto rounded-card border border-border bg-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">Competitors</caption>
          <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Competitor</th>
              <th scope="col" className="px-4 py-3 font-medium">Pricing</th>
              <th scope="col" className="px-4 py-3 font-medium">Identified gap</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.map((c) => (
              <tr key={c.id} className="align-top">
                <td className="px-4 py-3">
                  <button type="button" onClick={() => setOpen(c)} className="text-left font-medium text-primary hover:underline">
                    {c.name}
                  </button>
                  <p className="text-xs text-muted-foreground">{c.kind === "listed" ? "Listed by you" : "Mentioned in evidence"}</p>
                  {c.positioning && <p className="mt-1 line-clamp-2 text-xs text-foreground/80">{c.positioning}</p>}
                </td>
                <td className="px-4 py-3">
                  <Pricing c={c} />
                </td>
                <td className="px-4 py-3">
                  {c.identified_gap ? (
                    <>
                      <p>{c.identified_gap}</p>
                      <p className="mt-1 text-xs text-muted-foreground">From {c.complaint_ids.length} complaint{c.complaint_ids.length === 1 ? "" : "s"} (AI summary)</p>
                    </>
                  ) : (
                    <span className="italic text-muted-foreground">{c.complaint_ids.length ? `${c.complaint_ids.length} complaints, no summary` : "No complaints found"}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Sheet open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent side="right" className="w-[min(100vw,480px)] overflow-y-auto sm:max-w-[480px]">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle>{open.name}</SheetTitle>
                <SheetDescription>{open.kind === "listed" ? "Profile from its own website" : "Named in the collected evidence"}</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-5 px-4 pb-6 text-sm">
                {open.website && (
                  <a href={safeHref(open.website)} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                    {open.website} <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                )}
                {open.positioning && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Positioning (their words)</p>
                    <p className="mt-1">“{open.positioning}”</p>
                  </div>
                )}
                <div>
                  <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    Audience & features {open.ai_extracted && <AiLabel>AI extracted from page</AiLabel>}
                  </p>
                  <p className="mt-1">{open.audience || "Unavailable"}</p>
                  {open.features.length > 0 ? (
                    <ul className="mt-2 list-disc pl-5">
                      {open.features.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">Features unavailable.</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Plans</p>
                  <div className="mt-1">
                    <Pricing c={open} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Complaints and gap</p>
                  {open.identified_gap && <p className="mt-1">{open.identified_gap}</p>}
                  <div className="mt-2">
                    <Cited ids={open.complaint_ids} index={r.evidence_index} max={5} />
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** `assumptions` replaces the read-only list with the interactive tracker (in the app; print/tests keep the list). */
export function MarketGaps({ r, assumptions }: { r: Report; assumptions?: React.ReactNode }) {
  const o = r.opportunity;
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Score breakdown" aside={<span className="text-xs text-muted-foreground">Computed from evidence counts, not by AI</span>}>
        <div className="mb-4">
          <ScoreBreakdown dimensions={o.dimensions} />
        </div>
        {o.experiment_rules && <p className="mb-3 text-xs text-muted-foreground">{o.experiment_rules}</p>}
        <ul className="flex flex-col gap-4">
          {o.dimensions.map((d) => (
            <li key={d.key} className="rounded-control border border-border p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">
                  {d.label} <span className="font-normal text-muted-foreground">· {d.weight}%</span>
                </p>
                {d.available ? (
                  <span className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums">{d.score}/100</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", LEVEL_STYLE[d.confidence])}>{d.confidence}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-strong">
                    <MinusCircle className="size-3.5" aria-hidden /> Not scored
                  </span>
                )}
              </div>
              {d.available && (
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${d.score}%` }} />
                </div>
              )}
              {d.experiment?.counted && (
                <div className="mt-2 flex flex-col gap-1">
                  <p className="inline-flex w-fit items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    <FlaskConical className="size-3" aria-hidden /> Includes your experiment (60% of this dimension)
                    {d.research_score != null && ` · research alone: ${d.research_score}/100`}
                  </p>
                  {d.experiment.sources.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      From:{" "}
                      {d.experiment.sources.map((s, i) => (
                        <span key={`${s.kind}-${s.id}`}>
                          {i > 0 && ", "}
                          <Link href={`/projects/${r.project.id}/lab/${s.id}`} className="underline hover:text-foreground">
                            {s.title}
                          </Link>
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              )}
              <p className="mt-2 text-sm text-muted-foreground">{d.explanation}</p>
              {d.evidence_ids.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-medium text-primary">Show evidence</summary>
                  <div className="mt-2">
                    <Cited ids={d.evidence_ids} index={r.evidence_index} max={5} />
                  </div>
                </details>
              )}
            </li>
          ))}
        </ul>
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="What would change the score">
          <ul className="flex flex-col gap-2 text-sm">
            {o.what_would_change.map((w) => (
              <li key={w} className="flex gap-2">
                <ArrowRight className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                {w}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Market size">
          <p className="flex items-start gap-2 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              <span className="font-medium">TAM, SAM and SOM: unavailable. </span>
              <span className="text-muted-foreground">{o.market_size.reason}</span>
            </span>
          </p>
        </Panel>
        {assumptions ?? (
        <Panel title="Assumptions to test">
          {o.assumptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">None recorded.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {o.assumptions.map((a) => (
                <li key={a.text} className="flex items-start gap-2">
                  <HelpCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span>
                    {a.text} <span className="text-xs text-muted-foreground">({a.source === "founder" ? "yours" : "AI suggested"})</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        )}
        <Panel title="Risks">
          {o.risks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No risks flagged from the evidence.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {o.risks.map((x) => (
                <li key={x} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-text" aria-hidden />
                  {x}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
