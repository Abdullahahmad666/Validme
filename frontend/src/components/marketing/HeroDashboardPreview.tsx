import { Check, FileText, Gauge, Globe, Link2, MessagesSquare, Quote, TrendingUp } from "lucide-react";
import { Bar, DashboardMockup, MockCard, MockLabel, Pill } from "@/components/marketing/DashboardMockup";
import { cn } from "@/lib/utils";

const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

// Illustrative sample data only (labelled in the window chrome). No real sources or URLs.
const SOURCES = [
  { label: "Web search", icon: Globe },
  { label: "Hacker News", icon: MessagesSquare },
  { label: "Competitor sites", icon: Link2 },
  { label: "Your links", icon: FileText },
];

const EVIDENCE = [
  {
    quote: "We throw out produce every week because nobody knows what's actually in the walk-in.",
    source: "Community thread",
    date: "Mar 2026",
    tag: { label: "Pain point", tone: "destructive" as const },
  },
  {
    quote: "Would happily pay for something simpler than our POS add-on, just for stock counts.",
    source: "Forum discussion",
    date: "Jan 2026",
    tag: { label: "Buying intent", tone: "success" as const },
  },
  {
    quote: "Tried two inventory apps. Both assume a chain with a full-time manager.",
    source: "Link you added",
    date: "Feb 2026",
    tag: { label: "Competitor gap", tone: "primary" as const },
  },
];

const CLUSTERS = [
  { label: "Waste from untracked stock", value: 86, n: 14 },
  { label: "Manual counts take hours", value: 64, n: 9 },
  { label: "Tools built for chains", value: 42, n: 6 },
];

export function HeroDashboardPreview() {
  return (
    <div className="relative">
      <DashboardMockup title="Restaurant inventory" crumb="New research" bodyClassName="space-y-3.5">
        {/* 1. Idea input */}
        <div className="rounded-xl border border-primary/30 bg-primary/[0.03] p-3 vm-in" style={d(250)}>
          <MockLabel>Your idea</MockLabel>
          <p className="mt-1 flex items-center text-sm font-medium leading-snug">
            <span className="vm-type" style={d(450)}>
              Inventory tracking for independent restaurants
            </span>
            <span className="vm-caret ml-0.5 inline-block h-4 w-px bg-primary" aria-hidden />
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="vm-live size-1.5 rounded-full bg-success" aria-hidden />
            Researching · Standard depth
          </div>
        </div>

        {/* 2. Sources */}
        <ul className="flex flex-wrap gap-1.5" aria-label="Sources">
          {SOURCES.map((s, i) => (
            <li
              key={s.label}
              className="vm-in inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1 text-[11px] font-medium text-foreground"
              style={d(1700 + i * 120)}
            >
              <s.icon className="size-3" aria-hidden />
              {s.label}
              <Check className="size-3 text-success" aria-hidden />
              <span className="sr-only">searched</span>
            </li>
          ))}
        </ul>

        <div className="grid gap-3.5 sm:grid-cols-[1.15fr_1fr]">
          {/* 3. Evidence */}
          <div className="space-y-2">
            <MockLabel className="vm-in" style={d(2200)}>
              Evidence · 31 records
            </MockLabel>
            {EVIDENCE.map((e, i) => (
              <MockCard key={e.quote} className={cn("vm-in p-3", i === 2 && "hidden sm:block")} style={d(2350 + i * 180)}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <Pill tone={e.tag.tone}>{e.tag.label}</Pill>
                  <span className="text-[11px] tabular-nums text-muted-foreground">{e.date}</span>
                </div>
                <p className="flex gap-1.5 text-[12.5px] leading-snug">
                  <Quote className="mt-0.5 size-3 shrink-0 text-muted-foreground" aria-hidden />
                  {e.quote}
                </p>
                <p className="mt-1.5 truncate text-[11px] text-muted-foreground">{e.source}</p>
              </MockCard>
            ))}
          </div>

          <div className="space-y-3.5">
            {/* 4. Pain-point clusters */}
            <MockCard className="vm-in" style={d(2850)}>
              <MockLabel>Pain-point clusters</MockLabel>
              <ul className="mt-2.5 space-y-2.5">
                {CLUSTERS.map((c, i) => (
                  <li key={c.label}>
                    <div className="mb-1 flex justify-between gap-2 text-[12px]">
                      <span className="truncate">{c.label}</span>
                      <span className="tabular-nums text-muted-foreground">{c.n}</span>
                    </div>
                    <Bar value={c.value} delay={3000 + i * 150} />
                  </li>
                ))}
              </ul>
            </MockCard>

            {/* 5. Opportunity summary */}
            <MockCard className="vm-in border-primary/25 bg-gradient-to-b from-primary/[0.04] to-transparent" style={d(3600)}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <MockLabel>Opportunity</MockLabel>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    72<span className="text-sm font-normal text-muted-foreground">/100</span>
                  </p>
                </div>
                <Pill tone="warning">
                  <Gauge className="size-3" aria-hidden /> Medium confidence
                </Pill>
              </div>
              <p className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-snug text-muted-foreground">
                <TrendingUp className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
                Strong pain, clear gap for single-location owners. Interview 5 owners next.
              </p>
            </MockCard>
          </div>
        </div>
      </DashboardMockup>

      {/* Floating evidence chip (desktop only, subtle). */}
      <div
        aria-hidden
        className="vm-in absolute -bottom-6 -right-6 hidden w-56 rounded-xl border border-border bg-card p-3 shadow-lg shadow-navy/10 xl:block"
        style={d(3900)}
      >
        <div className="vm-float" style={d(4600)}>
          <p className="text-[11px] font-medium text-muted-foreground">Finding → evidence</p>
          <p className="mt-1 text-[12.5px] font-medium leading-snug">“Owners want counts, not a full ERP”</p>
          <p className="mt-1.5 text-[11px] text-primary">Backed by 9 records · 3 sources</p>
        </div>
      </div>
    </div>
  );
}
