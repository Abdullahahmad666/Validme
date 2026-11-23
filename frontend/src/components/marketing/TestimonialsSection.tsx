import { Container, Section, SectionHeading } from "@/components/marketing/primitives";
import { TestimonialMarquee } from "@/components/marketing/TestimonialMarquee";
import { visibleTestimonials } from "@/content/testimonials";

/**
 * Founder testimonials. Renders nothing until there's something real to show in production: sample entries appear
 * only in development (each labelled "Sample"). See content/testimonials.ts.
 */
export function TestimonialsSection() {
  const items = visibleTestimonials();
  if (items.length === 0) return null;
  const anySample = items.some((t) => t.sample);
  return (
    <Section id="testimonials" labelledBy="testimonials-title" className="overflow-hidden">
      <Container>
        <SectionHeading
          id="testimonials-title"
          eyebrow="Founders"
          title="Validated before they built."
          body="What founders say after checking an idea against real conversations."
        />
        {anySample && (
          <p className="mx-auto mt-4 max-w-xl rounded-xl border border-warning/30 bg-warning/[0.06] px-4 py-2 text-center text-sm text-warning-text">
            Development preview: these are sample testimonials and are hidden on the live site until real ones replace them.
          </p>
        )}
      </Container>
      <div className="mt-12">
        <TestimonialMarquee items={items} />
      </div>
    </Section>
  );
}
