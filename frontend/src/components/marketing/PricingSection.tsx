import { Check, Info } from "lucide-react";
import Link from "next/link";
import { CtaLink } from "@/components/marketing/CtaLink";
import { Container, Reveal, Section, SectionHeading } from "@/components/marketing/primitives";
import { TrackView } from "@/components/marketing/TrackView";
import { CREDIT_EXPLAINER, CTA, PACKS, PLAN_COMPARISON, PLANS } from "@/content/marketing";
import { cn } from "@/lib/utils";

export function PricingCards({ source }: { source: string }) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {PLANS.map((p, i) => (
        <Reveal
          key={p.id}
          as="article"
          index={i}
          className={cn(
            "relative flex flex-col rounded-2xl border bg-card p-7",
            p.recommended ? "border-primary shadow-[0_24px_48px_-24px_rgba(49,94,170,0.45)] lg:-my-3 lg:py-10" : "border-border",
          )}
        >
          {p.recommended && (
            <span className="absolute -top-3 left-7 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
              Recommended
            </span>
          )}
          <h3 className="text-lg font-semibold">{p.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{p.blurb}</p>
          <div className="mt-6">
            <p className="text-4xl font-semibold tracking-tight tabular-nums">
              {p.price}
              {p.period && <span className="text-base font-normal tracking-normal text-muted-foreground">{p.period}</span>}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{p.priceNote}</p>
          </div>
          <p className="mt-5 rounded-lg bg-muted px-3 py-2 text-sm">{p.allowance}</p>
          <ul className="mt-6 flex-1 space-y-2.5">
            {p.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          <CtaLink
            href={CTA.signup}
            variant={p.recommended ? "primary" : "secondary"}
            className="mt-8 w-full"
            data-plan={p.id}
            data-source={source}
          >
            {p.cta}
          </CtaLink>
        </Reveal>
      ))}
    </div>
  );
}

export function CreditExplainer() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="flex items-center gap-2 font-semibold">
        <Info className="size-4 text-primary" aria-hidden />
        How research credits work
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Each report uses credits based on depth. Credits are charged once per report, server-side, and drafts are always
        free.
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        {CREDIT_EXPLAINER.map((c) => (
          <div key={c.depth} className="rounded-xl bg-muted/60 p-4">
            <dt className="flex items-baseline justify-between">
              <span className="font-medium">{c.depth}</span>
              <span className="text-sm tabular-nums text-muted-foreground">
                {c.credits} credit{c.credits > 1 ? "s" : ""}
              </span>
            </dt>
            <dd className="mt-1 text-sm text-muted-foreground">{c.body}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function CreditPacks() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="font-semibold">Prefer not to subscribe?</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Buy a one-off credit pack instead. Credits don&apos;t expire, and any pack unlocks Standard and Deep research.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {PACKS.map((p) => (
          <li key={p.id} className="flex items-baseline justify-between rounded-xl bg-muted/60 p-4">
            <span>
              <span className="font-medium">{p.name}</span>
              <span className="ml-2 text-sm text-muted-foreground tabular-nums">{p.credits} credits</span>
            </span>
            <span className="text-lg font-semibold tabular-nums">{p.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PlanComparisonTable() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[560px] text-left text-sm">
        <caption className="sr-only">Plan comparison</caption>
        <thead className="border-b border-border bg-muted/50">
          <tr>
            <th scope="col" className="px-5 py-3 font-medium">
              Feature
            </th>
            {PLANS.map((p) => (
              <th key={p.id} scope="col" className={cn("px-5 py-3 font-medium", p.recommended && "text-primary")}>
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {PLAN_COMPARISON.map((row) => (
            <tr key={row.feature}>
              <th scope="row" className="px-5 py-3 font-normal text-muted-foreground">
                {row.feature}
              </th>
              <td className="px-5 py-3">{row.free}</td>
              <td className="px-5 py-3">{row.founder}</td>
              <td className="px-5 py-3">{row.pro}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PricingSection() {
  return (
    <Section id="pricing" labelledBy="pricing-title">
      <TrackView event="pricing_viewed" props={{ source: "landing" }} onView>
        <Container>
          <SectionHeading
            id="pricing-title"
            eyebrow="Pricing"
            title="Choose how deeply you want to research."
            body="Start free. Upgrade when the evidence says the idea is worth more of your time. Prices include the research credits you get each month."
          />
          <div className="mt-16">
            <PricingCards source="landing" />
          </div>
          <div className="mt-10">
            <CreditExplainer />
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            No research is ever unlimited: every plan has a clear allowance.{" "}
            <Link href="/pricing" className="font-medium text-primary hover:underline">
              Compare plans in detail
            </Link>
          </p>
        </Container>
      </TrackView>
    </Section>
  );
}
