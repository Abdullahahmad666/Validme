import { ArrowRight, Check } from "lucide-react";
import {
  AudienceFeatureMockup,
  CompetitorFeatureMockup,
  DistributionFeatureMockup,
  EvidenceFeatureMockup,
} from "@/components/marketing/mockups";
import { Container, Eyebrow, Section, SectionHeading } from "@/components/marketing/primitives";
import { FEATURES } from "@/content/marketing";
import { cn } from "@/lib/utils";

const VISUALS: Record<(typeof FEATURES)[number]["id"], React.ReactNode> = {
  evidence: <EvidenceFeatureMockup />,
  competitors: <CompetitorFeatureMockup />,
  audience: <AudienceFeatureMockup />,
  distribution: <DistributionFeatureMockup />,
};

/**
 * Four alternating feature rows. Motion is scroll-driven CSS (globals.css, "vm-feature"): each product visual slides
 * in from its own side and drifts slightly against the scroll, the copy arrives line by line, and the accent bar under
 * the eyebrow grows. Browsers without scroll timelines, and reduced-motion users, see everything static.
 */
export function ProductFeatureSection() {
  return (
    <Section id="product" labelledBy="product-title" className="overflow-x-clip">
      <Container>
        <SectionHeading
          id="product-title"
          eyebrow="Product"
          title="Everything you need to decide what to build, and who to sell it to."
        />
        <div className="mt-16 space-y-24 sm:space-y-32">
          {FEATURES.map((f, i) => {
            const visualRight = i % 2 === 0;
            return (
              <article
                key={f.id}
                aria-labelledby={`feature-${f.id}`}
                className="vm-feature grid grid-cols-[minmax(0,1fr)] items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16"
                style={{ "--vm-dir": visualRight ? 1 : -1 } as React.CSSProperties}
              >
                <div className={cn(!visualRight && "lg:order-2")}>
                  <div className="vm-feature-line" style={{ "--i": 0 } as React.CSSProperties}>
                    <Eyebrow>{f.eyebrow}</Eyebrow>
                    <span aria-hidden className="vm-feature-bar mt-3 block h-0.5 w-16 origin-left rounded-full bg-primary/70" />
                  </div>
                  <h3
                    id={`feature-${f.id}`}
                    className="vm-feature-line mt-4 text-balance text-2xl font-semibold leading-tight tracking-tight sm:text-3xl"
                    style={{ "--i": 1 } as React.CSSProperties}
                  >
                    {f.title}
                  </h3>
                  <p
                    className="vm-feature-line mt-4 text-pretty leading-relaxed text-muted-foreground sm:text-lg"
                    style={{ "--i": 2 } as React.CSSProperties}
                  >
                    {f.body}
                  </p>
                  <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                    {f.points.map((p, j) => (
                      <li
                        key={p}
                        className="vm-feature-line flex items-start gap-2 text-sm"
                        style={{ "--i": 3 + j * 0.5 } as React.CSSProperties}
                      >
                        <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                        {p}
                      </li>
                    ))}
                  </ul>
                  <p
                    className="vm-feature-line mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary"
                    style={{ "--i": 3 + f.points.length * 0.5 } as React.CSSProperties}
                  >
                    <ArrowRight className="size-4" aria-hidden />
                    {f.outcome}
                  </p>
                </div>
                <div className={cn("vm-feature-visual", !visualRight && "lg:order-1")}>
                  <div className="vm-feature-drift">{VISUALS[f.id]}</div>
                </div>
              </article>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
