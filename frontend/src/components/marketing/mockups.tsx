/**
 * Illustrative product screens for the marketing site. All values are SAMPLE data,
 * labelled by DashboardMockup's chrome. Competitor names are deliberately generic.
 */
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleHelp,
  Clock,
  Gauge,
  ExternalLink,
  Globe,
  Link2,
  Loader2,
  MapPin,
  MessagesSquare,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { Bar, DashboardMockup, MockCard, MockLabel, Pill } from "@/components/marketing/DashboardMockup";

// ---------------------------------------------------------------------------
// How it works — step visuals
// ---------------------------------------------------------------------------
export function IdeaStepMockup() {
  return (
    <DashboardMockup title="Describe your idea" crumb="New research" bodyClassName="space-y-3">
      <MockCard>
        <MockLabel>Idea description</MockLabel>
        <p className="mt-1.5 text-sm leading-relaxed">
          An inventory tool for independent restaurants that makes weekly stock counts quick, so owners waste less food
          and reorder on time.
        </p>
        <p className="mt-2 text-right text-[11px] tabular-nums text-muted-foreground">162 / 2,000</p>
      </MockCard>
      <MockCard className="border-ai/20">
        <div className="flex items-center justify-between">
          <MockLabel>How we understood it</MockLabel>
          <Pill className="bg-ai/10 text-ai">
            <Sparkles className="size-3" aria-hidden /> AI suggested
          </Pill>
        </div>
        <dl className="mt-2 grid grid-cols-[88px_1fr] gap-x-3 gap-y-1.5 text-[12.5px]">
          <dt className="text-muted-foreground">Problem</dt>
          <dd>Food waste and slow manual counts</dd>
          <dt className="text-muted-foreground">Customers</dt>
          <dd>Single-location restaurant owners</dd>
          <dt className="text-muted-foreground">Assumption</dt>
          <dd>Owners will pay monthly for time saved</dd>
        </dl>
      </MockCard>
    </DashboardMockup>
  );
}

const STAGES = [
  { label: "Idea analysis", state: "done" },
  { label: "Web research", state: "done" },
  { label: "Evidence analysis", state: "running" },
  { label: "Competitor analysis", state: "queued" },
  { label: "Opportunity report", state: "queued" },
] as const;

export function DiscoverStepMockup() {
  return (
    <DashboardMockup title="Research progress" crumb="Restaurant inventory" bodyClassName="grid gap-3 sm:grid-cols-2">
      <MockCard>
        <MockLabel>Stages</MockLabel>
        <ul className="mt-2.5 space-y-2 text-[12.5px]">
          {STAGES.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-2">
              <span>{s.label}</span>
              {s.state === "done" && (
                <Pill tone="success">
                  <CheckCircle2 className="size-3" aria-hidden /> Complete
                </Pill>
              )}
              {s.state === "running" && (
                <Pill tone="primary">
                  <Loader2 className="size-3" aria-hidden /> Processing
                </Pill>
              )}
              {s.state === "queued" && (
                <Pill>
                  <Clock className="size-3" aria-hidden /> Queued
                </Pill>
              )}
            </li>
          ))}
        </ul>
      </MockCard>
      <MockCard>
        <MockLabel>Coverage</MockLabel>
        <ul className="mt-2.5 space-y-2 text-[12.5px]">
          {[
            { icon: Globe, label: "Web search", note: "38 results", ok: true },
            { icon: MessagesSquare, label: "Hacker News", note: "12 threads", ok: true },
            { icon: Link2, label: "Competitor pages", note: "6 pages", ok: true },
            { icon: Ban, label: "Reddit", note: "Not included", ok: false },
          ].map((c) => (
            <li key={c.label} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <c.icon className="size-3.5 text-muted-foreground" aria-hidden />
                {c.label}
              </span>
              <span className={c.ok ? "tabular-nums text-muted-foreground" : "text-muted-foreground italic"}>{c.note}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-muted-foreground">Duplicates removed: 7</p>
      </MockCard>
    </DashboardMockup>
  );
}

const DIMENSIONS = [
  { label: "Demand evidence", w: 25, score: 78 },
  { label: "Pain intensity", w: 20, score: 84 },
  { label: "Willingness to pay", w: 20, score: 61 },
  { label: "Competitive gap", w: 15, score: 70 },
  { label: "Audience accessibility", w: 10, score: 66 },
];

export function ValidateStepMockup() {
  return (
    <DashboardMockup title="Opportunity" crumb="Restaurant inventory" bodyClassName="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <MockLabel>Opportunity score</MockLabel>
          <p className="text-3xl font-semibold tabular-nums">
            72<span className="text-base font-normal text-muted-foreground">/100</span>
          </p>
        </div>
        <div className="text-right">
          <Pill tone="warning">
            <Gauge className="size-3" aria-hidden /> Medium confidence
          </Pill>
          <p className="mt-1 text-[11px] text-muted-foreground">31 evidence records</p>
        </div>
      </div>
      <MockCard>
        <ul className="space-y-2.5">
          {DIMENSIONS.map((dm) => (
            <li key={dm.label}>
              <div className="mb-1 flex justify-between text-[12px]">
                <span>
                  {dm.label} <span className="text-muted-foreground">· {dm.w}%</span>
                </span>
                <span className="tabular-nums text-muted-foreground">{dm.score}</span>
              </div>
              <Bar value={dm.score} />
            </li>
          ))}
        </ul>
      </MockCard>
      <p className="text-[12px] text-muted-foreground">
        <span className="font-medium text-foreground">What would change the score:</span> pricing evidence from 5+ owners.
      </p>
    </DashboardMockup>
  );
}

export function PlanStepMockup() {
  return (
    <DashboardMockup title="First 10 customers" crumb="Restaurant inventory" bodyClassName="space-y-2">
      {[
        { t: "Interview 5 owners from the evidence threads", tag: "Researched", tone: "success" as const },
        { t: "Post a counting checklist in a local restaurant owners group", tag: "Hypothesis", tone: "warning" as const },
        { t: "Offer a free waste audit to 10 nearby restaurants", tag: "Hypothesis", tone: "warning" as const },
        { t: "Target “restaurant inventory spreadsheet” searches", tag: "Researched", tone: "success" as const },
      ].map((a, i) => (
        <MockCard key={a.t} className="flex items-center gap-3 py-2.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
            {i + 1}
          </span>
          <p className="flex-1 text-[12.5px] leading-snug">{a.t}</p>
          <Pill tone={a.tone}>
            {a.tag === "Researched" ? <CheckCircle2 className="size-3" aria-hidden /> : <CircleHelp className="size-3" aria-hidden />}
            {a.tag}
          </Pill>
        </MockCard>
      ))}
    </DashboardMockup>
  );
}

// ---------------------------------------------------------------------------
// Feature showcase visuals
// ---------------------------------------------------------------------------
export function EvidenceFeatureMockup() {
  return (
    <DashboardMockup title="Evidence explorer" crumb="Restaurant inventory" bodyClassName="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {["All · 31", "Pain points · 14", "Buying intent · 6", "Feature requests · 5"].map((f, i) => (
          <span
            key={f}
            className={
              i === 1
                ? "rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground"
                : "rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground"
            }
          >
            {f}
          </span>
        ))}
      </div>
      {[
        {
          title: "Thread: tracking stock in a one-location restaurant",
          src: "Hacker News",
          pub: "Published Mar 2026",
          ex: "Honestly a clipboard and a spreadsheet. Counting takes my chef two hours every Sunday.",
          rel: "High relevance",
        },
        {
          title: "Inventory app comparison for single-location kitchens",
          src: "Web search",
          pub: "Published Nov 2025",
          ex: "Most tools assume multiple locations and a manager whose whole job is ordering.",
          rel: "Medium relevance",
        },
      ].map((e) => (
        <MockCard key={e.title}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] font-medium leading-snug">{e.title}</p>
            <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {e.src} · {e.pub} · Retrieved Apr 2026
          </p>
          <p className="mt-2 border-l-2 border-border pl-2.5 text-[12.5px] leading-snug text-foreground/85">{e.ex}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Pill tone="destructive">Pain point</Pill>
            <Pill tone="primary">{e.rel}</Pill>
            <Pill>
              <CheckCircle2 className="size-3" aria-hidden /> Source verified
            </Pill>
          </div>
        </MockCard>
      ))}
    </DashboardMockup>
  );
}

export function CompetitorFeatureMockup() {
  const rows = [
    { name: "Competitor A", pos: "All-in-one for chains", price: "$129/mo · read Apr 2026", gap: "Overkill for one site" },
    { name: "Competitor B", pos: "POS inventory add-on", price: "Unavailable", gap: "Locked to one POS" },
    { name: "Competitor C", pos: "Spreadsheet templates", price: "$19 one-off · read Mar 2026", gap: "No reorder alerts" },
  ];
  return (
    <DashboardMockup title="Competitors" crumb="Restaurant inventory">
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-left text-[12px]">
          <thead className="bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Competitor</th>
              <th className="hidden px-3 py-2 font-medium sm:table-cell">Pricing</th>
              <th className="px-3 py-2 font-medium">Gap</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.name}>
                <td className="px-3 py-2.5">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-[11px] text-muted-foreground">{r.pos}</p>
                </td>
                <td className="hidden px-3 py-2.5 sm:table-cell">
                  {r.price === "Unavailable" ? (
                    <span className="italic text-muted-foreground">Unavailable</span>
                  ) : (
                    <span className="tabular-nums">{r.price}</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <Pill tone="primary">{r.gap}</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MockCard className="mt-3">
        <MockLabel>Top complaints across competitors</MockLabel>
        <ul className="mt-2 space-y-2">
          {[
            { t: "Setup takes too long", v: 72 },
            { t: "Too expensive for one location", v: 58 },
            { t: "Counts still feel manual", v: 41 },
          ].map((c) => (
            <li key={c.t}>
              <div className="mb-1 flex items-center gap-1.5 text-[12px]">
                <AlertTriangle className="size-3 text-warning" aria-hidden />
                {c.t}
              </div>
              <Bar value={c.v} tone="warning" />
            </li>
          ))}
        </ul>
      </MockCard>
    </DashboardMockup>
  );
}

export function AudienceFeatureMockup() {
  return (
    <DashboardMockup title="Audience" crumb="Restaurant inventory" bodyClassName="grid gap-3 sm:grid-cols-2">
      {[
        {
          name: "Owner-operators",
          size: "Primary segment",
          needs: ["Fast weekly counts", "Less waste"],
          motive: "Saving hours on Sunday",
          geo: "US, UK",
          access: 78,
        },
        {
          name: "Head chefs",
          size: "Influencer",
          needs: ["Reorder alerts", "Mobile-first"],
          motive: "Never running out mid-service",
          geo: "US",
          access: 54,
        },
      ].map((s) => (
        <MockCard key={s.name}>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="size-3.5" aria-hidden />
            </span>
            <div>
              <p className="text-[13px] font-medium">{s.name}</p>
              <p className="text-[11px] text-muted-foreground">{s.size}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {s.needs.map((n) => (
              <Pill key={n}>{n}</Pill>
            ))}
          </div>
          <p className="mt-2.5 text-[12px]">
            <span className="text-muted-foreground">Motivation: </span>
            {s.motive}
          </p>
          <p className="mt-1 flex items-center gap-1 text-[12px] text-muted-foreground">
            <MapPin className="size-3" aria-hidden /> {s.geo}
          </p>
          <div className="mt-2.5">
            <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
              <span>Accessibility</span>
              <span className="tabular-nums">{s.access}</span>
            </div>
            <Bar value={s.access} tone="success" />
          </div>
        </MockCard>
      ))}
    </DashboardMockup>
  );
}

export function DistributionFeatureMockup() {
  return (
    <DashboardMockup title="Distribution" crumb="Restaurant inventory" bodyClassName="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          { icon: MessagesSquare, t: "Owner communities", d: "Where owners swap supplier tips", tag: "Researched", tone: "success" as const, n: 9 },
          { icon: Search, t: "Search intent", d: "“restaurant inventory template”", tag: "Researched", tone: "success" as const, n: 6 },
          { icon: Users, t: "Local associations", d: "Restaurant association newsletters", tag: "Hypothesis", tone: "warning" as const, n: 0 },
          { icon: Globe, t: "Supplier partners", d: "Distributors serving small kitchens", tag: "Hypothesis", tone: "warning" as const, n: 0 },
        ].map((c) => (
          <MockCard key={c.t} className="p-3">
            <div className="flex items-center justify-between gap-2">
              <c.icon className="size-4 text-primary" aria-hidden />
              <Pill tone={c.tone}>
                {c.tag === "Researched" ? <CheckCircle2 className="size-3" aria-hidden /> : <CircleHelp className="size-3" aria-hidden />}
                {c.tag}
              </Pill>
            </div>
            <p className="mt-2 text-[13px] font-medium">{c.t}</p>
            <p className="text-[11.5px] text-muted-foreground">{c.d}</p>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {c.n > 0 ? `${c.n} supporting records` : "No direct evidence yet"}
            </p>
          </MockCard>
        ))}
      </div>
      <MockCard className="border-primary/25 bg-primary/[0.03]">
        <MockLabel>Positioning angle</MockLabel>
        <p className="mt-1 text-[13px] font-medium">“Stock counts in 15 minutes, built for one kitchen, not a chain.”</p>
      </MockCard>
    </DashboardMockup>
  );
}
