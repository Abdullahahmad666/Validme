import { Bot, CheckCircle2, Copy, Database, Gauge, Info, Link2, Sparkles, X } from "lucide-react";
import { Pill } from "@/components/marketing/DashboardMockup";
import { Container, LogoMark, Reveal, SampleDataBadge, Section, SectionHeading } from "@/components/marketing/primitives";
import { BRAND_NAME } from "@/lib/brand";

const PRINCIPLES = [
  { icon: Database, title: "Original evidence", body: "The verbatim excerpt is stored as found. AI never rewrites it." },
  { icon: Link2, title: "Source provenance", body: "Every record keeps its link, publish date and the date we read it." },
  { icon: Sparkles, title: "AI interpretation, labelled", body: "Summaries and classifications are kept apart from the evidence." },
  { icon: Gauge, title: "Confidence assessment", body: "Each finding says how sure we are and what would change it." },
  { icon: Copy, title: "Duplicate handling", body: "Reposts and near-copies are merged so one voice isn't counted twice." },
  { icon: Info, title: "Research limitations", body: "Sources we couldn't search are listed, never silently skipped." },
];

export function EvidenceShowcase() {
  return (
    <Section id="evidence" labelledBy="evidence-title" className="bg-card">
      <Container>
        <SectionHeading
          id="evidence-title"
          eyebrow="Why evidence-first"
          title="Every insight should have a reason. Every reason should have evidence."
          body="Here's the same question answered two ways."
        />

        <div className="mt-14 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          {/* Generic AI answer */}
          <Reveal className="flex flex-col rounded-2xl border border-border bg-background p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Bot className="size-4" aria-hidden />
              A generic AI answer
            </div>
            <blockquote className="mt-6 flex-1 text-xl font-medium leading-snug text-foreground/80">
              “There is demand for restaurant inventory software.”
            </blockquote>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              {["No sources", "No dates", "No way to check it", "No sense of how sure it is"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <X className="size-4 text-destructive" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>

          {/* Evidence-backed finding */}
          <Reveal index={1} className="rounded-2xl border border-primary/25 bg-card p-6 shadow-[0_24px_48px_-28px_rgba(49,94,170,0.35)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <LogoMark className="size-5" />
                The {BRAND_NAME} approach
              </div>
              <SampleDataBadge />
            </div>
            <div className="mt-5 rounded-xl border border-ai/20 bg-ai/[0.03] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Pill className="bg-ai/10 text-ai">
                  <Sparkles className="size-3" aria-hidden /> AI interpretation
                </Pill>
                <Pill tone="warning">
                  <Gauge className="size-3" aria-hidden /> Medium confidence
                </Pill>
              </div>
              <p className="mt-2.5 font-medium leading-snug">
                Single-location owners describe weekly stock counts as slow and wasteful, and several say they&apos;d pay
                for something simpler than chain-focused tools.
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Supported by 9 records from 3 sources · 2 duplicates merged · Reddit not searched
              </p>
            </div>
            <p className="mt-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Original evidence</p>
            <ul className="mt-2 space-y-2">
              {[
                {
                  q: "Counting takes my chef two hours every Sunday.",
                  src: "Hacker News thread",
                  pub: "Mar 2026",
                  tag: "Pain point",
                  tone: "destructive" as const,
                },
                {
                  q: "I'd pay for counts alone. I don't need a full ERP.",
                  src: "Web search result",
                  pub: "Jan 2026",
                  tag: "Buying intent",
                  tone: "success" as const,
                },
              ].map((e) => (
                <li key={e.q} className="rounded-xl border border-border p-3">
                  <p className="text-sm leading-snug">“{e.q}”</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Link2 className="size-3" aria-hidden />
                      {e.src} · published {e.pub} · retrieved Apr 2026
                    </span>
                    <Pill tone={e.tone}>{e.tag}</Pill>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <ul className="mt-14 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {PRINCIPLES.map((p, i) => (
            <Reveal as="li" key={p.title} index={i % 3} className="flex gap-3.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/[0.08] text-primary">
                <p.icon className="size-4" aria-hidden />
              </span>
              <div>
                <h3 className="font-semibold">{p.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
              </div>
            </Reveal>
          ))}
        </ul>
        <p className="mt-10 flex items-center justify-center gap-1.5 text-center text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-success" aria-hidden />
          Missing data is shown as &ldquo;unavailable&rdquo;, never filled in.
        </p>
      </Container>
    </Section>
  );
}
