import type { Metadata } from "next";
import { EvidenceShowcase } from "@/components/marketing/EvidenceShowcase";
import { FAQSection } from "@/components/marketing/FAQSection";
import { FinalCTASection } from "@/components/marketing/FinalCTASection";
import { HeroSection } from "@/components/marketing/HeroSection";
import { HowItWorksSection } from "@/components/marketing/HowItWorksSection";
import { MarketSizingSection } from "@/components/marketing/MarketSizingSection";
import { PricingSection } from "@/components/marketing/PricingSection";
import { ProblemSection } from "@/components/marketing/ProblemSection";
import { ProductDemoSection } from "@/components/marketing/ProductDemoSection";
import { ProductFeatureSection } from "@/components/marketing/ProductFeatureSection";
import { TrustSection } from "@/components/marketing/TrustSection";
import { UseCasesSection } from "@/components/marketing/UseCasesSection";
import { BRAND_NAME, SITE_URL } from "@/lib/brand";
import { pageMetadata } from "@/lib/seo";
import { faqPageEntity, ORG_ID, PageJsonLd } from "@/components/marketing/PageJsonLd";
import { FAQS, PLANS, STEPS } from "@/content/marketing";
import { PAGES } from "@/content/seo";

export const metadata: Metadata = pageMetadata("home");

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <TrustSection />
      <ProblemSection />
      <HowItWorksSection />
      <ProductDemoSection />
      <ProductFeatureSection />
      <EvidenceShowcase />
      <MarketSizingSection />
      <UseCasesSection />
      <PricingSection />
      <FAQSection />
      <FinalCTASection />
      {/* Structured data: facts only — no ratings, reviews or invented prices. */}
      <PageJsonLd
        page="home"
        extra={[
          {
            "@type": "SoftwareApplication",
            "@id": `${SITE_URL}/#app`,
            name: BRAND_NAME,
            url: SITE_URL,
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            description: PAGES.home.description,
            publisher: { "@id": ORG_ID },
            offers: PLANS.map((p) => ({
              "@type": "Offer",
              name: p.name,
              price: p.price.replace("$", ""),
              priceCurrency: "USD",
              description: p.allowance,
              ...(p.period
                ? {
                    priceSpecification: {
                      "@type": "UnitPriceSpecification",
                      price: p.price.replace("$", ""),
                      priceCurrency: "USD",
                      unitCode: "MON",
                      referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
                    },
                  }
                : {}),
            })),
          },
          {
            "@type": "HowTo",
            name: `How to validate a startup idea with ${BRAND_NAME}`,
            step: STEPS.map((st, i) => ({ "@type": "HowToStep", position: i + 1, name: st.title, text: st.body })),
          },
          faqPageEntity(FAQS),
        ]}
      />
    </>
  );
}
