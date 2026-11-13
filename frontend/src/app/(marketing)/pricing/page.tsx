import type { Metadata } from "next";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { FinalCTASection } from "@/components/marketing/FinalCTASection";
import { PageHeader } from "@/components/marketing/PageShell";
import { CreditExplainer, CreditPacks, PlanComparisonTable, PricingCards } from "@/components/marketing/PricingSection";
import { Container, Section, SectionHeading } from "@/components/marketing/primitives";
import { TrackView } from "@/components/marketing/TrackView";
import { FAQS } from "@/content/marketing";
import { PAID_PRICES_SENTENCE } from "@/content/pricing";
import { pageMetadata } from "@/lib/seo";
import { faqPageEntity, PageJsonLd } from "@/components/marketing/PageJsonLd";

export const metadata: Metadata = pageMetadata("pricing");

const PRICING_FAQ = FAQS.filter((f) => /cost|cancel|real data|private/i.test(f.q));

export default function PricingPage() {
  return (
    <>
      <PageJsonLd page="pricing" extra={[faqPageEntity(PRICING_FAQ)]} />
      <TrackView event="pricing_viewed" props={{ source: "pricing_page" }} />
      <PageHeader
        eyebrow="Pricing"
        title="Choose how deeply you want to research."
        lead={`Start free. ${PAID_PRICES_SENTENCE}, with two months free when you pay yearly. Every plan has a clear allowance, nothing is unlimited.`}
      />
      <Section className="pt-16 sm:pt-20">
        <Container>
          <h2 className="sr-only">Plans</h2>
          <PricingCards source="pricing_page" />
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <CreditExplainer />
            <CreditPacks />
          </div>
        </Container>
      </Section>
      <Section labelledBy="compare-title" className="bg-card pt-20">
        <Container>
          <SectionHeading id="compare-title" title="Compare plans" body="What each plan includes today. Prices are in US dollars. Any sales tax or VAT is calculated at checkout." />
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
