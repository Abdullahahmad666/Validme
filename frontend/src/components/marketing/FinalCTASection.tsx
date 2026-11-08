import { CtaLink } from "@/components/marketing/CtaLink";
import { Container, Reveal } from "@/components/marketing/primitives";
import { CTA } from "@/content/marketing";

export function FinalCTASection() {
  return (
    <section aria-labelledby="final-cta-title" className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <Container className="relative overflow-hidden rounded-3xl bg-navy px-6 py-16 text-center sm:px-12 sm:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background-image:radial-gradient(ellipse_60%_80%_at_50%_0%,rgba(127,166,230,0.28),transparent_70%),linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] [background-size:auto,56px_56px,56px_56px]"
        />
        <Reveal className="relative mx-auto max-w-3xl">
          <h2
            id="final-cta-title"
            className="text-balance text-3xl font-semibold leading-tight tracking-tight text-white sm:text-5xl"
          >
            Before you build it, find out if people actually want it.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-white/70">
            Turn market conversations into evidence, evidence into opportunities and opportunities into your next business.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <CtaLink href={CTA.signup} variant="inverted" arrow event="hero_cta_clicked" eventProps={{ cta: "final_cta" }}>
              Start validating your idea
            </CtaLink>
            <CtaLink href={CTA.sampleReport} variant="ghost-inverted">
              See a sample report
            </CtaLink>
          </div>
          <p className="mt-5 text-sm text-white/55">Your first Quick report is free. No card required.</p>
        </Reveal>
      </Container>
    </section>
  );
}
