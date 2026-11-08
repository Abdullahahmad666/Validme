import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { Container, Section, SectionHeading } from "@/components/marketing/primitives";
import { FAQS } from "@/content/marketing";

/** FAQ list. Its FAQPage structured data is emitted by the page (see PageJsonLd). */
export function FAQSection() {
  return (
    <Section id="faq" labelledBy="faq-title" className="bg-card">
      <Container className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <SectionHeading
          align="left"
          id="faq-title"
          eyebrow="FAQ"
          title="Questions, answered honestly."
          body="Including what we don't do."
        />
        <FaqAccordion items={FAQS.map((f) => ({ q: f.q, a: f.a }))} />
      </Container>
    </Section>
  );
}
