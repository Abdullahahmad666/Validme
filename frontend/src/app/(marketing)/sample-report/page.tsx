import { AlertTriangle, ArrowRight, Ban, CheckCircle2, ExternalLink, Info, Link2, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { Bar, Pill } from "@/components/marketing/DashboardMockup";
import { FinalCTASection } from "@/components/marketing/FinalCTASection";
import { AudienceFeatureMockup, CompetitorFeatureMockup, PlanStepMockup } from "@/components/marketing/mockups";
import { Container, Reveal, SampleDataBadge } from "@/components/marketing/primitives";
import { TrackView } from "@/components/marketing/TrackView";
import { BRAND_NAME } from "@/lib/brand";
import { pageMetadata } from "@/lib/seo";

const DESCRIPTION = `An illustrative ${BRAND_NAME} opportunity report: demand signals, pain points, competitors, market gaps, TAM/SAM/SOM and a first-10-customers plan, all linked to evidence.`;

export const metadata: Metadata = pageMetadata({
  title: "Sample report",
  socialTitle: `Sample opportunity report · ${BRAND_NAME}`,
  description: DESCRIPTION,
  path: "/sample-report",
});

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
  { d: "Willingness to pay", w: 20, s: 61, why: "6 buying-intent records; few mention a price." },
  { d: "Competitive gap", w: 15, s: 70, why: "Competitors target chains; setup is a frequent complaint." },
  { d: "Audience accessibility", w: 10, s: 66, why: "Owners gather in local groups; less in public forums." },
  { d: "Product feasibility", w: 10, s: 75, why: "No hard integrations needed for a counts-first MVP." },
];

function ReportSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-36">
      <h2 id={`${id}-title`} className="text-xl font-semibold tracking-tight sm:text-2xl">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border bg-card p-5 ${className}`}>{children}</div>;
}

export default function SampleReportPage() {
  const total = BY_SOURCE.reduce((a, b) => a + b.n, 0);
  return (
    <>
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
      {/* Tabs (anchor navigation, horizontal scroll on mobile) */}
      <nav aria-label="Report sections" className="sticky top-16 z-30 border-b border-border bg-card/95 backdrop-blur">
        <Container>
          <ul className="-mx-1 flex gap-1 overflow-x-auto py-2 [scrollbar-width:none]">
            {TABS.map((t) => (
              <li key={t.id}>
                <a
                  href={`#${t.id}`}
                  className="inline-flex min-h-10 items-center whitespace-nowrap rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {t.label}
                </a>
              </li>
            ))}
          </ul>
        </Container>
      </nav>

      <Container className="space-y-16 py-12 sm:py-16">
        <ReportSection id="overview" title="Overview">
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <Card>
              <p className="text-sm text-muted-foreground">Opportunity score</p>
              <p className="mt-1 text-5xl font-semibold tabular-nums">
                72<span className="text-xl font-normal text-muted-foreground">/100</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Pill tone="warning">Medium confidence</Pill>
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
            <Card>
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
        </ReportSection>

        <ReportSection id="demand" title="Demand">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h3 className="font-semibold">Demand signals by category</h3>
              <ul className="mt-4 space-y-3">
                {SIGNALS.map((s) => (
                  <li key={s.label}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{s.label}</span>
                      <span className="tabular-nums text-muted-foreground">{s.n}</span>
                    </div>
                    <Bar value={(s.n / 14) * 100} />
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <h3 className="font-semibold">Evidence by source</h3>
              <div className="mt-4 flex h-3 overflow-hidden rounded-full" role="img" aria-label={BY_SOURCE.map((s) => `${s.label} ${s.n}`).join(", ")}>
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
        </ReportSection>

        <ReportSection id="evidence" title="Evidence">
          <ul className="grid gap-3 md:grid-cols-2">
            {EVIDENCE.map((e, i) => (
              <Reveal as="li" key={e.q} index={i % 2}>
                <Card className="h-full">
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
              </Reveal>
            ))}
          </ul>
        </ReportSection>

        <ReportSection id="pain-points" title="Pain points">
          <div className="grid gap-4 md:grid-cols-3">
            {CLUSTERS.map((c) => (
              <Card key={c.t}>
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
          <CompetitorFeatureMockup />
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
                    <td className="px-5 py-3 tabular-nums">{d.s}</td>
                    <td className="px-5 py-3 text-muted-foreground">{d.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Card>
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
            <Card>
              <h3 className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="size-4 text-warning" aria-hidden /> Assumptions & risks</h3>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                <li>Price hypothesis ($29–49/mo) is yours, not evidenced.</li>
                <li>Owner communities are mostly private, limiting reach data.</li>
                <li>POS vendors could bundle a simple counts feature.</li>
              </ul>
            </Card>
            <Card>
              <h3 className="font-semibold">What would change the score</h3>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                <li>Pricing evidence from 5+ owners → willingness to pay.</li>
                <li>Evidence from licensed review data (not searched).</li>
                <li>Churn reasons from competitor customers.</li>
              </ul>
            </Card>
          </div>
        </ReportSection>

        <ReportSection id="audience" title="Audience">
          <AudienceFeatureMockup />
        </ReportSection>

        <ReportSection id="distribution" title="Distribution & first 10 customers">
          <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
            Channels are labelled <strong className="text-success">Researched</strong> when evidence supports them and{" "}
            <strong className="text-warning">Hypothesis</strong> when they&apos;re reasonable but untested.
          </p>
          <PlanStepMockup />
        </ReportSection>

        <section aria-labelledby="limits-title" className="rounded-2xl border border-border bg-card p-6">
          <h2 id="limits-title" className="flex items-center gap-2 font-semibold">
            <Ban className="size-4 text-muted-foreground" aria-hidden /> Research limitations
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Not searched: Reddit (requires a commercial agreement), review sites such as G2, Capterra and Trustpilot
            (licensed data only), and X, Instagram and TikTok (access restrictions). Findings may under-represent
            conversations on those platforms.
          </p>
        </section>
      </Container>
      <FinalCTASection />
    </>
  );
}
