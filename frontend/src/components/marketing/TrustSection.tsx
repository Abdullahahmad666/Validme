import { SourceHub } from "@/components/marketing/SourceHub";
import { Container, Section, SectionHeading } from "@/components/marketing/primitives";
import { SOURCES } from "@/content/marketing";

export function TrustSection() {
  return (
    <Section id="sources" labelledBy="sources-title" className="border-y border-border bg-card">
      <Container>
        <SectionHeading
          id="sources-title"
          eyebrow="Research sources"
          title="Turn market conversations into actionable intelligence."
          body="We only search sources we're allowed to use, and every report tells you exactly which ones it covered."
        />
        <SourceHub sources={SOURCES} />
      </Container>
    </Section>
  );
}
