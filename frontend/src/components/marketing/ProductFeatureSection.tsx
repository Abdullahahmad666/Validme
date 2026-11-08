import { ArrowRight, Check } from "lucide-react";
import {
  AudienceFeatureMockup,
  CompetitorFeatureMockup,
  DistributionFeatureMockup,
  EvidenceFeatureMockup,
} from "@/components/marketing/mockups";
import { Container, Eyebrow, Reveal, Section, SectionHeading } from "@/components/marketing/primitives";
import { FEATURES } from "@/content/marketing";
import { cn } from "@/lib/utils";

const VISUALS: Record<(typeof FEATURES)[number]["id"], React.ReactNode> = {
  evidence: <EvidenceFeatureMockup />,
  competitors: <CompetitorFeatureMockup />,
  audience: <AudienceFeatureMockup />,
  distribution: <DistributionFeatureMockup />,
};

export function ProductFeatureSection() {
  return (
    <Section id="product" labelledBy="product-title">
      <Container>
        <SectionHeading
          id="product-title"
          eyebrow="Product"
          title="Everything you need to decide what to build, and who to sell it to."
        />
        <div className="mt-16 space-y-24 sm:space-y-32">
          {FEATURES.map((f, i) => (
            <article
              key={f.id}
              aria-labelledby={`feature-${f.id}`}
              className="grid grid-cols-[minmax(0,1fr)] items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16"
            >
              <Reveal from="left" className={cn(i % 2 === 1 && "lg:order-2")}>
                <Eyebrow>{f.eyebrow}</Eyebrow>
                <h3
                  id={`feature-${f.id}`}
                  className="mt-4 text-balance text-2xl font-semibold leading-tight tracking-tight sm:text-3xl"
                >
                  {f.title}
                </h3>
                <p className="mt-4 text-pretty leading-relaxed text-muted-foreground sm:text-lg">{f.body}</p>
                <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                  {f.points.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                      {p}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                  <ArrowRight className="size-4" aria-hidden />
                  {f.outcome}
                </p>
              </Reveal>
              <Reveal index={1} className={cn(i % 2 === 1 && "lg:order-1")}>
                {VISUALS[f.id]}
              </Reveal>
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}
