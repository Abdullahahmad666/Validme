import type { Metadata } from "next";
import { EvidenceShowcase } from "@/components/marketing/EvidenceShowcase";
import { FAQSection } from "@/components/marketing/FAQSection";
import { FinalCTASection } from "@/components/marketing/FinalCTASection";
import { HeroSection } from "@/components/marketing/HeroSection";
import { HowItWorksSection } from "@/components/marketing/HowItWorksSection";
import { JsonLd } from "@/components/marketing/JsonLd";
import { MarketSizingSection } from "@/components/marketing/MarketSizingSection";
import { PricingSection } from "@/components/marketing/PricingSection";
import { ProblemSection } from "@/components/marketing/ProblemSection";
import { ProductDemoSection } from "@/components/marketing/ProductDemoSection";
import { ProductFeatureSection } from "@/components/marketing/ProductFeatureSection";
import { TrustSection } from "@/components/marketing/TrustSection";
import { UseCasesSection } from "@/components/marketing/UseCasesSection";
import { BRAND_NAME, SITE_URL } from "@/lib/brand";
import { pageMetadata } from "@/lib/seo";

const TITLE = `${BRAND_NAME} — AI-Powered Startup Idea Validation & Market Research`;
const DESCRIPTION =
  `Validate startup ideas with real market evidence. Discover customer pain points, analyze competitors, identify market gaps and build a customer acquisition strategy with ${BRAND_NAME}.`;

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: "/", absoluteTitle: true });

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
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "Organization", name: BRAND_NAME, url: SITE_URL },
            {
              "@type": "SoftwareApplication",
              name: BRAND_NAME,
              url: SITE_URL,
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              description: DESCRIPTION,
            },
          ],
        }}
      />
    </>
  );
}
