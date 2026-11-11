import type { Metadata } from "next";
import { FinalCTASection } from "@/components/marketing/FinalCTASection";
import { faqPageEntity, PageJsonLd } from "@/components/marketing/PageJsonLd";
import { PageHeader } from "@/components/marketing/PageShell";
import { Container, Section } from "@/components/marketing/primitives";
import { UnitEconomicsSimulator } from "@/components/tools/UnitEconomicsSimulator";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata("unitEconomics");

const FAQ = [
  {
    q: "What is customer lifetime value (LTV)?",
    a: "The gross profit one customer brings in before they cancel: monthly price × gross margin ÷ monthly churn. With a $29 price, 80% margin and 4% churn, LTV is about $580.",
  },
  {
    q: "What is a good LTV to CAC ratio?",
    a: "A common target is 3:1 or better: each customer earns at least three times what it cost to acquire them. Below 1:1 you lose money on every customer.",
  },
  {
    q: "What is CAC payback?",
    a: "How many months of gross profit it takes to earn back what you spent acquiring a customer: CAC ÷ (price × gross margin).",
  },
  {
    q: "Where do the numbers come from?",
    a: "Only from what you type in. The calculator does arithmetic on your inputs; it doesn't use market data. Test your price and churn assumptions with real customers before relying on the result.",
  },
] as const;

export default function UnitEconomicsPage() {
  return (
    <>
      <PageJsonLd page="unitEconomics" extra={[faqPageEntity(FAQ)]} />
      <PageHeader
        eyebrow="Free tool"
        title="SaaS unit economics calculator"
        lead="Enter your price, churn and costs to see lifetime value, CAC payback and when you'd break even, in pessimistic, realistic and optimistic scenarios."
      />
      <Section className="pt-12">
        <Container className="max-w-6xl">
          <UnitEconomicsSimulator />
        </Container>
      </Section>
      <Section className="pt-4">
        <Container className="max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight">Questions</h2>
          <dl className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card">
            {FAQ.map((f) => (
              <div key={f.q} className="p-6">
                <dt className="font-semibold">{f.q}</dt>
                <dd className="mt-1.5 leading-relaxed text-muted-foreground">{f.a}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </Section>
      <FinalCTASection />
    </>
  );
}
