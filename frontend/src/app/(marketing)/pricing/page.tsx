import type { Metadata } from "next";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { FinalCTASection } from "@/components/marketing/FinalCTASection";
import { PageHeader } from "@/components/marketing/PageShell";
import { CreditExplainer, PlanComparisonTable, PricingCards } from "@/components/marketing/PricingSection";
import { Container, Section, SectionHeading } from "@/components/marketing/primitives";
import { TrackView } from "@/components/marketing/TrackView";
import { FAQS } from "@/content/marketing";
import { pageMetadata } from "@/lib/seo";

const TITLE = "Pricing";
const DESCRIPTION =
  "Start free with one Quick report. Compare Free, Pro and Advanced plans for evidence-backed startup idea validation and market research.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: "/pricing" });

const PRICING_FAQ = FAQS.filter((f) => /cost|cancel|real data|private/i.test(f.q));

export default function PricingPage() {
  return (
    <>
      <TrackView event="pricing_viewed" props={{ source: "pricing_page" }} />
      <PageHeader
        eyebrow="Pricing"
        title="Choose how deeply you want to research."
        lead="Start free. Paid plans are being finalised, and prices will be published here before they launch. Every plan has a clear allowance, nothing is unlimited."
      />
      <Section className="pt-16 sm:pt-20">
        <Container>
          <h2 className="sr-only">Plans</h2>
          <PricingCards source="pricing_page" />
          <div className="mt-12">
            <CreditExplainer />
          </div>
        </Container>
      </Section>
      <Section labelledBy="compare-title" className="bg-card pt-20">
        <Container>
          <SectionHeading id="compare-title" title="Compare plans" body="Allowances marked “set at launch” will be published with prices." />
          <div className="mt-12">
            <PlanComparisonTable />
          </div>
        </Container>
      </Section>
      <Section labelledBy="pricing-faq-title">
        <Container className="max-w-3xl">
          <SectionHeading id="pricing-faq-title" title="Pricing questions" />
          <div className="mt-10">
            <FaqAccordion items={PRICING_FAQ.map((f) => ({ q: f.q, a: f.a }))} />
          </div>
        </Container>
      </Section>
      <FinalCTASection />
    </>
  );
}
