import { HowItWorksSteps } from "@/components/marketing/HowItWorksSteps";
import { DiscoverStepMockup, IdeaStepMockup, PlanStepMockup, ValidateStepMockup } from "@/components/marketing/mockups";
import { Container, Section, SectionHeading } from "@/components/marketing/primitives";
import { STEPS } from "@/content/marketing";

export function HowItWorksSection() {
  return (
    <Section id="how-it-works" labelledBy="how-title" className="bg-card">
      <Container>
        <SectionHeading
          id="how-title"
          eyebrow="How it works"
          title="From a simple idea to a market-backed strategy."
          body="Four steps. You stay in control of what gets researched, and you can see exactly what was found."
        />
        <HowItWorksSteps
          steps={STEPS}
          visuals={[
            <IdeaStepMockup key="idea" />,
            <DiscoverStepMockup key="discover" />,
            <ValidateStepMockup key="validate" />,
            <PlanStepMockup key="plan" />,
          ]}
        />
      </Container>
    </Section>
  );
}
