import { Container, Reveal, Section, SectionHeading } from "@/components/marketing/primitives";
import { Walkthrough } from "@/components/marketing/Walkthrough";
import { DEMO_VIDEO } from "@/content/marketing";
import { BRAND_NAME } from "@/lib/brand";


/**
 * The product walkthrough: the real video player when DEMO_VIDEO.src is set, otherwise a code-drawn walkthrough
 * (sample data, labelled; pausable; still for reduced motion).
 */
export function ProductDemoSection() {
  return (
    <Section id="demo" labelledBy="demo-title">
      <Container>
        <SectionHeading
          id="demo-title"
          eyebrow="See it in action"
          title={`Watch ${BRAND_NAME} turn one sentence into a research report.`}
        />
        <Reveal className="mx-auto mt-12 max-w-5xl">
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-navy/10 bg-navy shadow-[0_32px_64px_-32px_rgba(23,45,77,0.55)]">
            {DEMO_VIDEO.src ? (
              <video
                className="size-full object-cover"
                controls
                playsInline
                preload="none"
                poster={DEMO_VIDEO.poster ?? undefined}
                aria-label={`${BRAND_NAME} product walkthrough`}
              >
                <source src={DEMO_VIDEO.src} type="video/mp4" />
                {DEMO_VIDEO.captions && <track kind="captions" src={DEMO_VIDEO.captions} srcLang="en" label="English" default />}
              </video>
            ) : (
              <Walkthrough />
            )}
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
