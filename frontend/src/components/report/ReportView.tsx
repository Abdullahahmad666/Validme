"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Clock, ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { fmtDate } from "@/components/evidence/EvidenceCard";
import { Audience, Distribution } from "@/components/report/DistributionSections";
import { ExportMenu, HistorySelect, RerunPanel } from "@/components/report/ReportActions";
import { Competitors, Demand, MarketGaps, Overview, PainPoints } from "@/components/report/ReportSections";
import { StatusPill } from "@/components/shared/StatusPill";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { api, ApiError } from "@/services/api";
import type { Report } from "@/types/report";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "demand", label: "Demand" },
  { key: "evidence", label: "Evidence" },
  { key: "pain-points", label: "Pain points" },
  { key: "competitors", label: "Competitors" },
  { key: "market-gaps", label: "Market gaps" },
  { key: "audience", label: "Audience" },
  { key: "distribution", label: "Distribution" },
] as const;
type TabKey = (typeof TABS)[number]["key"];
const SECTIONS: [string, string, (p: { r: Report }) => React.ReactNode][] = [
  ["overview", "Overview", Overview],
  ["demand", "Demand", Demand],
  ["pain-points", "Pain points", PainPoints],
  ["competitors", "Competitors", Competitors],
  ["market-gaps", "Market gaps", MarketGaps],
  ["audience", "Audience", Audience],
  ["distribution", "Distribution", Distribution],
];

export function ReportView({ projectId }: { projectId: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = (TABS.find((t) => t.key === params.get("tab"))?.key ?? "overview") as TabKey;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const version = Number(params.get("report")) || undefined;
  const report = useQuery({
    queryKey: ["report", projectId, version ?? "latest"],
    queryFn: () => api.getReport(projectId, version),
    retry: false,
  });
  const history = useQuery({ queryKey: ["report-history", projectId], queryFn: () => api.reportHistory(projectId), retry: false });
  const [rerun, setRerun] = useState(false);
  const viewedId = report.data?.id;
  useEffect(() => {
    if (viewedId) track("report_viewed", { tab });
    // Once per report version, not per tab switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewedId]);
  const [printing, setPrinting] = useState(false);

  // PDF export: render every section, open the browser's print dialog (Save as PDF), then restore the tabs.
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done, { once: true });
    const t = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("afterprint", done);
    };
  }, [printing]);

  const go = (next: { tab?: TabKey; report?: number | null }) => {
    const q = new URLSearchParams({ tab: next.tab ?? tab });
    const v = next.report === undefined ? version : next.report;
    if (v) q.set("report", String(v));
    router.replace(`${pathname}?${q}`, { scroll: false });
  };
  const select = (key: TabKey, focus = false) => {
    go({ tab: key });
    if (focus) refs.current[TABS.findIndex((t) => t.key === key)]?.focus();
  };

  if (report.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-80" />
      </div>
    );
  }
  if (report.isError) {
    if (report.error instanceof ApiError && report.error.status === 404) {
      return (
        <EmptyState
          title="No report yet"
          body="The report is built when research finishes. Check progress, or launch research if you haven't yet."
          actionHref={`/projects/${projectId}/progress`}
          actionLabel="View research progress"
        />
      );
    }
    return <ErrorState title="Couldn't load the report" onRetry={() => report.refetch()} />;
  }
  const r = report.data;
  const chips = [r.project.industry, ...r.project.geographies, ...r.project.audiences].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <li>
            <Link href="/projects" className="hover:text-foreground">
              My projects
            </Link>
          </li>
          <ChevronRight className="size-3.5" aria-hidden />
          <li aria-current="page" className="max-w-[16rem] truncate font-medium text-foreground">
            {r.project.name}
          </li>
        </ol>
      </nav>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{r.project.name}</h1>
          <StatusPill status={r.project.status} />
        </div>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="size-3.5" aria-hidden />
          Generated {fmtDate(r.generated_at ?? r.created_at)} · {r.depth} depth
        </p>
        {chips.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <li key={c} className="rounded-full border border-border bg-card px-3 py-1 text-xs">
                {c}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <ExportMenu projectId={projectId} reportId={r.id} onPrint={() => setPrinting(true)} />
          {r.project.status === "COMPLETED" && (
            <Button variant="outline" onClick={() => setRerun((v) => !v)} aria-expanded={rerun}>
              <RefreshCw aria-hidden /> Re-run
            </Button>
          )}
          <Button asChild variant="ghost">
            <Link href={`/projects/${projectId}/progress`}>Research details</Link>
          </Button>
          <HistorySelect
            versions={history.data?.results ?? []}
            value={r.id}
            onChange={(id) => go({ report: id === history.data?.results[0]?.id ? null : id })}
          />
        </div>
        {version && history.data && history.data.results[0]?.id !== r.id && (
          <p className="rounded-control bg-warning/10 px-3 py-2 text-sm text-warning-text print:hidden">
            You&apos;re viewing an earlier version.{" "}
            <button type="button" className="font-medium underline" onClick={() => go({ report: null })}>
              Go to the latest
            </button>
          </p>
        )}
      </header>

      {rerun && <RerunPanel projectId={projectId} onClose={() => setRerun(false)} />}

      {printing && (
        <div className="flex flex-col gap-8">
          {SECTIONS.map(([key, label, Section]) => (
            <section key={key} className="break-inside-avoid-page">
              <h2 className="mb-3 text-xl font-semibold">{label}</h2>
              <Section r={r} />
            </section>
          ))}
        </div>
      )}

      {/* Tabs: keep header context; horizontal scroll on mobile; arrow keys move between tabs. */}
      <div
        role="tablist"
        aria-label="Report sections"
        hidden={printing}
        className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 print:hidden"
        onKeyDown={(e) => {
          const i = TABS.findIndex((t) => t.key === tab);
          if (e.key === "ArrowRight") select(TABS[(i + 1) % TABS.length].key, true);
          if (e.key === "ArrowLeft") select(TABS[(i - 1 + TABS.length) % TABS.length].key, true);
        }}
      >
        {TABS.map((t, i) => (
          <button
            key={t.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`panel-${t.key}`}
            tabIndex={tab === t.key ? 0 : -1}
            onClick={() => select(t.key)}
            className={cn(
              "-mb-px inline-flex min-h-11 shrink-0 items-center whitespace-nowrap border-b-2 px-3 text-sm transition-colors",
              tab === t.key ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} hidden={printing}>
        {tab === "overview" && <Overview r={r} />}
        {tab === "demand" && <Demand r={r} />}
        {tab === "evidence" && (
          <div className="rounded-card border border-border bg-card p-6">
            <p className="text-muted-foreground">
              {r.overview.evidence_count} records with their sources, dates and classification.
            </p>
            <Button asChild className="mt-4">
              <Link href={`/evidence?project=${projectId}`}>
                Open in the evidence explorer <ExternalLink aria-hidden />
              </Link>
            </Button>
          </div>
        )}
        {tab === "pain-points" && <PainPoints r={r} />}
        {tab === "competitors" && <Competitors r={r} />}
        {tab === "market-gaps" && <MarketGaps r={r} />}
        {tab === "audience" && <Audience r={r} />}
        {tab === "distribution" && <Distribution r={r} />}
      </div>

      {r.notes.length > 0 && (
        <p className="text-xs text-muted-foreground">Notes from this run: {r.notes.join("; ")}.</p>
      )}
    </div>
  );
}
