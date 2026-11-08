import { AlertCircle } from "lucide-react";
import { Container, Reveal, SampleDataBadge, Section, SectionHeading } from "@/components/marketing/primitives";

const LAYERS = [
  {
    key: "TAM",
    name: "Total Addressable Market",
    body: "Everyone who has the problem, if you could reach all of them.",
    example: "Independent restaurants in your target countries",
  },
  {
    key: "SAM",
    name: "Serviceable Available Market",
    body: "The part your product and channels can realistically serve.",
    example: "Single-location, English-speaking, already using some software",
  },
  {
    key: "SOM",
    name: "Serviceable Obtainable Market",
    body: "The share you could plausibly win in the next 1–3 years.",
    example: "A small % of SAM reachable through researched channels",
  },
];

export function MarketSizingSection() {
  return (
    <Section id="market-sizing" labelledBy="sizing-title">
      <Container className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <div>
          <SectionHeading
            align="left"
            id="sizing-title"
            eyebrow="Market sizing"
            title="Is your opportunity big enough to build a business around?"
            body="TAM, SAM and SOM put a rough size on the prize. Every estimate shows the calculation, its assumptions and the sources behind each input."
          />
          <ul className="mt-8 space-y-5">
            {LAYERS.map((l, i) => (
              <Reveal as="li" key={l.key} index={i} className="flex gap-4">
                <span className="w-12 shrink-0 pt-0.5 text-sm font-bold tracking-wide text-primary">{l.key}</span>
                <div>
                  <h3 className="font-semibold">{l.name}</h3>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{l.body}</p>
                </div>
              </Reveal>
            ))}
          </ul>
          <Reveal className="mt-8 flex gap-2.5 rounded-xl border border-warning/25 bg-warning/[0.06] p-4 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <p>
              Estimates are not revenue forecasts. When an input can&apos;t be sourced, the estimate is marked
              &ldquo;unavailable&rdquo; rather than guessed.
            </p>
          </Reveal>
        </div>

        {/* Layered visualization */}
        <Reveal index={1} className="relative mx-auto w-full max-w-[460px]">
          <div className="absolute right-0 top-0">
            <SampleDataBadge />
          </div>
          <div className="relative aspect-square">
            {/* Nested circles anchored at the bottom: TAM ⊃ SAM ⊃ SOM */}
            <div className="absolute bottom-0 left-1/2 aspect-square w-full -translate-x-1/2 rounded-full border border-primary/15 bg-primary/[0.05]" />
            <div className="absolute bottom-0 left-1/2 aspect-square w-[66%] -translate-x-1/2 rounded-full border border-primary/25 bg-primary/[0.09]" />
            <div className="absolute bottom-0 left-1/2 aspect-square w-[34%] -translate-x-1/2 rounded-full border border-primary/40 bg-primary" />
            <p className="absolute inset-x-[14%] top-[9%] text-center">
              <span className="block text-sm font-bold text-primary">TAM</span>
              <span className="text-xs text-muted-foreground">{LAYERS[0].example}</span>
            </p>
            <p className="absolute inset-x-[24%] top-[41%] text-center">
              <span className="block text-sm font-bold text-primary">SAM</span>
              <span className="text-xs text-muted-foreground">{LAYERS[1].example}</span>
            </p>
            <p className="absolute inset-x-[33%] top-[78%] text-center text-white">
              <span className="block text-sm font-bold">SOM</span>
              <span className="text-[11px] leading-tight text-white/80">Reachable share</span>
            </p>
          </div>
          <div className="mt-4 rounded-xl border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">How a SAM estimate is shown</p>
            <p className="mt-1 font-mono text-[11px]">
              restaurants in region × share single-location × share using software × price hypothesis
            </p>
            <p className="mt-1">Each factor links to its source, or is flagged as your assumption.</p>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
