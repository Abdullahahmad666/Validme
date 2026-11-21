import { Gauge, AlertTriangle, ArrowRight, CheckCircle2, ExternalLink, Info, Link2, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { Pill } from "@/components/marketing/DashboardMockup";
import { FinalCTASection } from "@/components/marketing/FinalCTASection";
import { AudienceFeatureMockup, CompetitorFeatureMockup, PlanStepMockup } from "@/components/marketing/mockups";
import { InViewGroup } from "@/components/marketing/InViewGroup";
import { Container, SampleDataBadge } from "@/components/marketing/primitives";
import { ReportTabs } from "@/components/marketing/ReportTabs";
import { TrackView } from "@/components/marketing/TrackView";
import { SectionHook, StickyReportCta, TryYourIdea } from "@/components/marketing/SampleReportHooks";
import { pageMetadata } from "@/lib/seo";
import { PageJsonLd } from "@/components/marketing/PageJsonLd";

export const metadata: Metadata = pageMetadata("sampleReport");

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "demand", label: "Demand" },
  { id: "evidence", label: "Evidence" },
  { id: "pain-points", label: "Pain points" },
  { id: "competitors", label: "Competitors" },
  { id: "opportunity", label: "Market gaps" },
  { id: "audience", label: "Audience" },
  { id: "distribution", label: "Distribution" },
];

// ---- Sample data (illustrative; no real sources, URLs or companies) ----
const FINDINGS = [
  { t: "Single-location owners spend 1–3 hours a week on manual stock counts.", n: 11, conf: "High" },
  { t: "Existing tools are seen as built for chains: too complex and priced per location.", n: 8, conf: "Medium" },
  { t: "Several owners say they'd pay for counts and reorder alerts alone.", n: 6, conf: "Medium" },
];

const SIGNALS = [
  { label: "Pain points", n: 14 },
  { label: "Workarounds", n: 7 },
  { label: "Buying intent", n: 6 },
  { label: "Feature requests", n: 5 },
  { label: "Pricing objections", n: 4 },
];

const BY_SOURCE = [
  { label: "Web search", n: 15, tone: "bg-primary" },
  { label: "Hacker News", n: 9, tone: "bg-navy" },
  { label: "Competitor pages", n: 4, tone: "bg-success" },
  { label: "Links you added", n: 3, tone: "bg-warning" },
];

const EVIDENCE = [
  { q: "Counting takes my chef two hours every Sunday. It's a clipboard and a spreadsheet.", src: "Hacker News", pub: "Mar 2026", cat: "Pain point", tone: "destructive" as const, dup: 1 },
  { q: "I'd pay for counts alone. I don't need a full ERP with recipe costing.", src: "Web search", pub: "Jan 2026", cat: "Buying intent", tone: "success" as const, dup: 0 },
  { q: "We tried an inventory app but it wanted us to set up every supplier first. Gave up.", src: "Link you added", pub: "Feb 2026", cat: "Competitor gap", tone: "primary" as const, dup: 0 },
  { q: "Our workaround is photos of the walk-in shelves in a group chat.", src: "Hacker News", pub: "Dec 2025", cat: "Workaround", tone: "warning" as const, dup: 2 },
];

const CLUSTERS = [
  { t: "Waste from untracked stock", records: 14, authors: 11, sev: "High", conf: "High", quote: "We throw out produce every week because nobody knows what's in the walk-in." },
  { t: "Manual counts take hours", records: 9, authors: 8, sev: "Medium", conf: "Medium", quote: "Counting takes my chef two hours every Sunday." },
  { t: "Tools built for chains", records: 6, authors: 5, sev: "Medium", conf: "Low", quote: "Both apps assume a full-time manager whose whole job is ordering." },
];

const DIMENSIONS = [
  { d: "Demand evidence", w: 25, s: 78, why: "Recurring threads across two sources over 6 months." },
  { d: "Pain intensity", w: 20, s: 84, why: "Waste and time cost described concretely and repeatedly." },
  { d: "Willingness to pay", w: 20, s: 57, why: "6 buying-intent records; few mention a price." },
  { d: "Competitive gap", w: 15, s: 70, why: "Competitors target chains; setup is a frequent complaint." },
  { d: "Audience accessibility", w: 10, s: 66, why: "Owners gather in local groups; less in public forums." },
  { d: "Product feasibility", w: 10, s: 75, why: "No hard integrations needed for a counts-first MVP." },
];

// Score = the weighted dimensions, so the headline number and the breakdown always agree.
const SCORE = Math.round(DIMENSIONS.reduce((a, d) => a + (d.w * d.s) / 100, 0));

// Evidence by month published (sums to the 31 records above).
const MONTHLY = [
  { m: "Jun", n: 1 },
  { m: "Jul", n: 2 },
  { m: "Aug", n: 2 },
  { m: "Sep", n: 3 },
  { m: "Oct", n: 2 },
  { m: "Nov", n: 4 },
  { m: "Dec", n: 3 },
  { m: "Jan", n: 5 },
  { m: "Feb", n: 4 },
  { m: "Mar", n: 5 },
];

/** A bar that fills in as it scrolls into view (CSS scroll timeline; static where unsupported). */
function SrBar({ pct, i = 0, tone = "bg-primary", className = "h-2" }: { pct: number; i?: number; tone?: string; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-full bg-muted ${className}`} aria-hidden>
      <div className={`rv-bar h-full rounded-full ${tone}`} style={{ width: `${pct}%`, "--i": i } as React.CSSProperties} />
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 48;
  const len = 2 * Math.PI * r;
  return (
    <div className="relative size-36" role="img" aria-label={`Opportunity score ${score} out of 100`}>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--chart-track, #e5eaf5)" strokeWidth="12" />
        <circle
          className="rv-ring"
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={len}
          strokeDashoffset={len * (1 - score / 100)}
          style={{ "--vm-ring-len": len } as React.CSSProperties}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
        <span className="text-4xl font-semibold tabular-nums">{score}</span>
        <span className="text-xs text-muted-foreground">out of 100</span>
      </span>
    </div>
  );
}

function ReportSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-36">
      <h2 id={`${id}-title`} className="text-xl font-semibold tracking-tight sm:text-2xl">
        {title}
      </h2>
      <InViewGroup className="mt-5">{children}</InViewGroup>
    </section>
  );
}

/** A report card; it rises in with its section (stagger with `i`). */
function Card({ children, className = "", i = 0 }: { children: React.ReactNode; className?: string; i?: number }) {
  return (
    <div className={`rv-card rounded-2xl border border-border bg-card p-5 ${className}`} style={{ "--i": i } as React.CSSProperties}>
      {children}
    </div>
  );
}

export default function SampleReportPage() {
  const total = BY_SOURCE.reduce((a, b) => a + b.n, 0);
  return (
    <>
      <PageJsonLd page="sampleReport" />
      <TrackView event="sample_report_opened" />
      {/* Report header */}
      <header className="border-b border-border bg-card">
        <Container className="pb-8 pt-10 sm:pt-14">
          <div className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/[0.06] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2">
              <Info className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <span>
                <strong className="font-semibold">This is an illustrative sample.</strong> All numbers, quotes and
                competitors are made up to show the report format. No real sources were searched.
              </span>
            </p>
            <SampleDataBadge className="self-start sm:self-auto" />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">Sample report · Generated 8 Nov 2026 · Standard depth</p>
          <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Inventory tracking for independent restaurants
          </h1>
          <div className="mt-4 flex flex-wrap gap-2">
            {["US & UK", "Food service", "Owner-operators", "B2B"].map((c) => (
              <span key={c} className="rounded-full border border-border bg-background px-3 py-1 text-xs">
                {c}
              </span>
            ))}
            <Pill tone="success">
              <CheckCircle2 className="size-3" aria-hidden /> Completed
            </Pill>
          </div>
        </Container>
      </header>
      {/* Tabs and report share one wrapper, so the tabs stick only while the report is on screen. */}
      <div>
        <ReportTabs tabs={TABS} />
      <Container className="space-y-16 py-12 sm:py-16">
        <ReportSection id="overview" title="Overview">
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <Card>
              <p className="text-sm text-muted-foreground">Opportunity score</p>
              <div className="mt-3 flex justify-center">
                <ScoreRing score={SCORE} />
              </div>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                <Pill tone="warning">
                  <Gauge className="size-3" aria-hidden /> Medium confidence
                </Pill>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Evidence</dt>
                  <dd className="font-semibold tabular-nums">31 records</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Competitors</dt>
                  <dd className="font-semibold tabular-nums">6 found</dd>
                </div>
              </dl>
            </Card>
            <Card i={1}>
              <h3 className="flex items-center gap-2 font-semibold">
                Executive summary
                <Pill className="bg-ai/10 text-ai">
                  <Sparkles className="size-3" aria-hidden /> AI interpretation
                </Pill>
              </h3>
              <p className="mt-2 leading-relaxed text-foreground/85">
                Owner-operated restaurants describe stock counting as slow and wasteful, and see current tools as built
                for chains. Demand and pain are well supported; willingness to pay is promising but under-evidenced. A
                counts-first product for single locations looks like a credible wedge.
              </p>
              <h4 className="mt-5 text-sm font-medium text-muted-foreground">Key findings</h4>
              <ul className="mt-2 space-y-2">
                {FINDINGS.map((f) => (
                  <li key={f.t} className="flex flex-col gap-1 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm">{f.t}</span>
                    <a href="#evidence" className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline">
                      {f.n} records · {f.conf} <ArrowRight className="size-3" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-5 rounded-xl bg-primary/[0.06] p-3 text-sm">
                <span className="font-semibold">Recommended next step:</span> interview 5 owners from the evidence
                threads about what they pay today, to firm up willingness to pay.
              </p>
            </Card>
          </div>
          <Card className="mt-4" i={2}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold">What makes up the score</h3>
              <p className="text-xs text-muted-foreground">Each bar is as long as the dimension&apos;s weight; the fill is what it earned.</p>
            </div>
            <ul className="mt-4 space-y-3">
              {DIMENSIONS.map((d, i) => {
                const pts = (d.w * d.s) / 100;
                return (
                  <li key={d.d} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[12rem_1fr_6rem]">
                    <span className="truncate">{d.d}</span>
                    <div className="h-2.5" style={{ width: `${(d.w / 25) * 100}%` }}>
                      <SrBar pct={d.s} i={i} className="h-2.5" />
                    </div>
                    <span className="text-right tabular-nums text-muted-foreground">
                      {pts.toFixed(1)} of {d.w}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">
              Total: <span className="font-semibold tabular-nums text-foreground">{SCORE}/100</span>, from {DIMENSIONS.length} weighted
              dimensions. Every point traces back to evidence records.
            </p>
          </Card>
        </ReportSection>

        <InViewGroup>
          <div className="rv-card">
            <TryYourIdea />
          </div>
        </InViewGroup>

        <ReportSection id="demand" title="Demand">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h3 className="font-semibold">Demand signals by category</h3>
              <ul className="mt-4 space-y-3">
                {SIGNALS.map((s, i) => (
                  <li key={s.label}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{s.label}</span>
                      <span className="tabular-nums text-muted-foreground">{s.n}</span>
                    </div>
                    <SrBar pct={(s.n / 14) * 100} i={i} />
                  </li>
                ))}
              </ul>
            </Card>
            <Card i={1}>
              <h3 className="font-semibold">Evidence by source</h3>
              <div className="rv-bar mt-4 flex h-3 overflow-hidden rounded-full" role="img" aria-label={BY_SOURCE.map((s) => `${s.label} ${s.n}`).join(", ")}>
                {BY_SOURCE.map((s) => (
                  <span key={s.label} className={s.tone} style={{ width: `${(s.n / total) * 100}%` }} />
                ))}
              </div>
              <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
                {BY_SOURCE.map((s) => (
                  <li key={s.label} className="flex items-center gap-2">
                    <span className={`size-2.5 rounded-full ${s.tone}`} aria-hidden />
                    {s.label} <span className="tabular-nums text-muted-foreground">{s.n}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-sm text-muted-foreground">
                Coverage: evidence published Jun 2025 – Mar 2026 · retrieved Apr 2026 · 7 duplicates merged.
              </p>
            </Card>
          </div>
          <Card className="mt-4" i={2}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold">Published over time</h3>
              <p className="text-xs text-muted-foreground">Records per month, Jun 2025 – Mar 2026</p>
            </div>
            <div
              className="mt-5 flex h-40 items-end gap-2 border-b border-border sm:gap-3"
              role="img"
              aria-label={`Evidence records per month: ${MONTHLY.map((m) => `${m.m} ${m.n}`).join(", ")}. Discussion grows over the period.`}
            >
              {MONTHLY.map((m, i) => (
                <div key={m.m} className="flex h-full flex-1 flex-col items-center justify-end gap-1" aria-hidden>
                  <span className="rv-fade text-[11px] tabular-nums text-muted-foreground" style={{ "--i": i } as React.CSSProperties}>
                    {m.n}
                  </span>
                  <div
                    className="rv-col w-full max-w-10 rounded-t-md bg-primary"
                    style={{ height: `${(m.n / 5) * 80}%`, "--i": i } as React.CSSProperties}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex gap-2 text-center text-[11px] text-muted-foreground sm:gap-3" aria-hidden>
              {MONTHLY.map((m) => (
                <span key={m.m} className="flex-1">
                  {m.m}
                </span>
              ))}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              More people are talking about it lately: the last three months hold {MONTHLY.slice(-3).reduce((a, m) => a + m.n, 0)} of{" "}
              {MONTHLY.reduce((a, m) => a + m.n, 0)} records.
            </p>
          </Card>
        </ReportSection>

        <ReportSection id="evidence" title="Evidence">
          <ul className="grid gap-3 md:grid-cols-2">
            {EVIDENCE.map((e, i) => (
              <li key={e.q}>
                <Card className="h-full" i={i}>
                  <div className="flex items-center justify-between gap-2">
                    <Pill tone={e.tone}>{e.cat}</Pill>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ExternalLink className="size-3" aria-hidden /> Source link (sample)
                    </span>
                  </div>
                  <blockquote className="mt-3 leading-snug">“{e.q}”</blockquote>
                  <p className="mt-3 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                    <Link2 className="size-3" aria-hidden />
                    {e.src} · published {e.pub} · retrieved Apr 2026
                    {e.dup > 0 && <span>· {e.dup} duplicate{e.dup > 1 ? "s" : ""} merged</span>}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
          <div className="rv-card mt-6" style={{ "--i": 3 } as React.CSSProperties}>
            <SectionHook
              text="Every quote in your report links to the page it came from, with the date we read it."
              cta="Find the evidence for my idea"
              event="sample_report_hook_evidence"
            />
          </div>
        </ReportSection>

        <ReportSection id="pain-points" title="Pain points">
          <Card className="mb-4">
            <h3 className="font-semibold">Themes by distinct authors</h3>
            <p className="mt-1 text-xs text-muted-foreground">How many different people raised each problem (not how many posts).</p>
            <ul className="mt-4 space-y-3">
              {CLUSTERS.map((c, i) => (
                <li key={c.t} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[14rem_1fr_auto]">
                  <span className="truncate">{c.t}</span>
                  <span className="order-last col-span-2 sm:order-none sm:col-span-1">
                    <SrBar pct={(c.authors / 11) * 100} i={i} tone={c.sev === "High" ? "bg-destructive/80" : "bg-primary"} className="h-2.5" />
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {c.authors} people · {c.sev.toLowerCase()} severity
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <div className="grid gap-4 md:grid-cols-3">
            {CLUSTERS.map((c, i) => (
              <Card key={c.t} i={i + 1}>
                <h3 className="font-semibold">{c.t}</h3>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Records</dt>
                    <dd className="tabular-nums">{c.records}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Distinct authors</dt>
                    <dd className="tabular-nums">{c.authors}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Severity</dt>
                    <dd>{c.sev}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Confidence</dt>
                    <dd>{c.conf}</dd>
                  </div>
                </dl>
                <blockquote className="mt-4 border-l-2 border-border pl-3 text-sm text-foreground/80">“{c.quote}”</blockquote>
              </Card>
            ))}
          </div>
        </ReportSection>

        <ReportSection id="competitors" title="Competitors">
          <div className="rv-card">
            <CompetitorFeatureMockup />
          </div>
          <Card className="mt-4">
            <h3 className="font-semibold">Monthly price comparison</h3>
            <p className="mt-1 text-xs text-muted-foreground">Only prices read from a page are charted; your price is your own assumption.</p>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-3 sm:grid-cols-[11rem_1fr_7rem]">
                <span>Competitor A</span>
                <SrBar pct={100} tone="bg-navy" className="h-2.5" />
                <span className="text-right tabular-nums">$129/mo</span>
              </li>
              <li className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-3 sm:grid-cols-[11rem_1fr_7rem]">
                <span>Your price idea</span>
                <div className="relative h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div
                    className="rv-bar absolute inset-y-0 rounded-full bg-warning/80"
                    style={{ left: `${(29 / 129) * 100}%`, width: `${((49 - 29) / 129) * 100}%`, "--i": 1 } as React.CSSProperties}
                  />
                </div>
                <span className="text-right tabular-nums">$29–49/mo</span>
              </li>
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">
              Your range is about a third of Competitor A&apos;s price. Competitor B&apos;s price wasn&apos;t on its page
              (unavailable); Competitor C is a $19 one-off, not a monthly price, so it isn&apos;t charted.
            </p>
          </Card>
          <div className="rv-card mt-6" style={{ "--i": 3 } as React.CSSProperties}>
            <SectionHook
              text="Know who you're up against, what they charge and what their users complain about, before you build."
              cta="Map my competitors"
              event="sample_report_hook_competitors"
            />
          </div>
        </ReportSection>

        <ReportSection id="opportunity" title="Market gaps & opportunity">
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[620px] text-left text-sm">
              <caption className="sr-only">Opportunity score dimensions</caption>
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">Dimension</th>
                  <th scope="col" className="px-5 py-3 font-medium">Weight</th>
                  <th scope="col" className="px-5 py-3 font-medium">Score</th>
                  <th scope="col" className="px-5 py-3 font-medium">Why</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {DIMENSIONS.map((d) => (
                  <tr key={d.d}>
                    <th scope="row" className="px-5 py-3 font-medium">{d.d}</th>
                    <td className="px-5 py-3 tabular-nums text-muted-foreground">{d.w}%</td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2">
                        <span className="w-7 tabular-nums">{d.s}</span>
                        <span className="w-24">
                          <SrBar pct={d.s} i={DIMENSIONS.indexOf(d)} />
                        </span>
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{d.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Card i={1}>
              <h3 className="font-semibold">Market size (estimate)</h3>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3"><dt className="font-medium text-primary">TAM</dt><dd className="text-right text-muted-foreground">Independent restaurants, US & UK</dd></div>
                <div className="flex justify-between gap-3"><dt className="font-medium text-primary">SAM</dt><dd className="text-right text-muted-foreground">Single-location, already use some software</dd></div>
                <div className="flex justify-between gap-3"><dt className="font-medium text-primary">SOM</dt><dd className="text-right italic text-muted-foreground">Unavailable: no sourced conversion rate</dd></div>
              </dl>
              <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                SAM = restaurants × single-location share × software adoption × price hypothesis
              </p>
            </Card>
            <Card i={2}>
              <h3 className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="size-4 text-warning" aria-hidden /> Assumptions & risks</h3>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                <li>Price hypothesis ($29–49/mo) is yours, not evidenced.</li>
                <li>Owner communities are mostly private, limiting reach data.</li>
                <li>POS vendors could bundle a simple counts feature.</li>
              </ul>
            </Card>
            <Card i={3}>
              <h3 className="font-semibold">What would change the score</h3>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                <li>Pricing evidence from 5+ owners → willingness to pay.</li>
                <li>More buying-intent evidence from owner communities.</li>
                <li>Churn reasons from competitor customers.</li>
              </ul>
            </Card>
          </div>
        </ReportSection>

        <ReportSection id="audience" title="Audience">
          <div className="rv-card">
            <AudienceFeatureMockup />
          </div>
        </ReportSection>

        <ReportSection id="distribution" title="Distribution & first 10 customers">
          <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
            Channels are labelled <strong className="text-success-text">Researched</strong> when evidence supports them and{" "}
            <strong className="text-warning-text">Hypothesis</strong> when they&apos;re reasonable but untested.
          </p>
          <div className="rv-card">
            <PlanStepMockup />
          </div>
          <div className="rv-card mt-6" style={{ "--i": 3 } as React.CSSProperties}>
            <SectionHook
              text="Get a first-10-customers plan for your own idea: where your buyers already talk, and what to say."
              cta="Plan my first customers"
              event="sample_report_hook_distribution"
            />
          </div>
        </ReportSection>

        <section aria-labelledby="limits-title" className="rounded-2xl border border-border bg-card p-6">
          <h2 id="limits-title" className="flex items-center gap-2 font-semibold">
            <Info className="size-4 text-muted-foreground" aria-hidden /> Research coverage
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This report used web search, Hacker News, competitor pages and links you added. Findings reflect only
            those sources: conversations in private groups or closed communities aren&apos;t represented.
          </p>
        </section>
        <InViewGroup>
          <div className="rv-card">
            <TryYourIdea id="try-your-idea-end" />
          </div>
        </InViewGroup>
      </Container>
      </div>
      <div id="final-cta">
        <FinalCTASection />
      </div>
      <StickyReportCta startId="overview" endId="try-your-idea-end" />
    </>
  );
}
