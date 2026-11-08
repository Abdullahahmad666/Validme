import type { Metadata } from "next";
import { FinalCTASection } from "@/components/marketing/FinalCTASection";
import { JsonLd } from "@/components/marketing/JsonLd";
import { PageHeader } from "@/components/marketing/PageShell";
import { Container, Section } from "@/components/marketing/primitives";
import { SITE_URL } from "@/lib/brand";
import { pageMetadata } from "@/lib/seo";

const DESCRIPTION =
  "Plain-English definitions of market research terms for founders: TAM, SAM, SOM, demand signals, pain points, buying intent, market gaps and more.";

export const metadata: Metadata = pageMetadata({
  title: "Market research glossary",
  socialTitle: "Market research glossary for founders",
  description: DESCRIPTION,
  path: "/glossary",
});

const TERMS: { term: string; id: string; def: string }[] = [
  { id: "tam", term: "TAM (Total Addressable Market)", def: "Everyone who has the problem you solve, if you could reach all of them. Useful as an upper bound, not a target." },
  { id: "sam", term: "SAM (Serviceable Available Market)", def: "The part of TAM your product, language, pricing and channels can realistically serve today." },
  { id: "som", term: "SOM (Serviceable Obtainable Market)", def: "The share of SAM you could plausibly win in the next one to three years, given competition and your reach." },
  { id: "demand-signal", term: "Demand signal", def: "Evidence that people want a solution: repeated complaints, requests for recommendations, workarounds, or searches for a fix." },
  { id: "pain-point", term: "Pain point", def: "A specific, recurring problem people describe in their own words. Frequency and intensity matter more than volume of opinions." },
  { id: "buying-intent", term: "Buying intent", def: "Evidence that someone is ready to spend money or switch tools, e.g. asking for paid alternatives or comparing prices." },
  { id: "willingness-to-pay", term: "Willingness to pay", def: "Evidence of what people already pay, or say they would pay, to solve the problem. Stronger when tied to current spend." },
  { id: "workaround", term: "Workaround", def: "A manual or makeshift process people use because no good tool exists. Often the clearest sign of an unmet need." },
  { id: "market-gap", term: "Market gap", def: "A need that existing products serve poorly: wrong audience, too expensive, too complex, or missing a key capability." },
  { id: "evidence-record", term: "Evidence record", def: "One stored piece of source material (an excerpt with its link, publish date and retrieval date) that findings can cite." },
  { id: "confidence", term: "Confidence", def: "How much a finding can be trusted given the amount, diversity and recency of its evidence. High scores with low confidence mean “research more”." },
  { id: "opportunity-score", term: "Opportunity score", def: "A weighted summary of demand, pain, willingness to pay, competitive gap, accessibility and feasibility, always shown with its formula and confidence." },
  { id: "icp", term: "ICP (Ideal Customer Profile)", def: "A precise description of the customer who gets the most value and is easiest to reach: who they are, what they need and where they gather." },
  { id: "go-to-market", term: "Go-to-market (GTM)", def: "How you'll reach and convert your first customers: positioning, channels, offer and the first concrete actions." },
];

export default function GlossaryPage() {
  return (
    <>
      <PageHeader
        eyebrow="Resources"
        title="Market research glossary"
        lead="The terms you'll meet when validating an idea, explained without jargon."
      />
      <Section className="pt-14">
        <Container className="grid max-w-5xl gap-12 lg:grid-cols-[220px_1fr]">
          <nav aria-label="Glossary terms" className="hidden lg:block">
            <ul className="sticky top-24 space-y-1 text-sm">
              {TERMS.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`} className="block rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                    {t.term.split(" (")[0]}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <dl className="divide-y divide-border rounded-2xl border border-border bg-card">
            {TERMS.map((t) => (
              <div key={t.id} id={t.id} className="scroll-mt-24 p-6">
                <dt className="font-semibold">{t.term}</dt>
                <dd className="mt-1.5 leading-relaxed text-muted-foreground">{t.def}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </Section>
      <FinalCTASection />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "DefinedTermSet",
          name: "Market research glossary",
          url: `${SITE_URL}/glossary`,
          hasDefinedTerm: TERMS.map((t) => ({
            "@type": "DefinedTerm",
            name: t.term,
            description: t.def,
            url: `${SITE_URL}/glossary#${t.id}`,
          })),
        }}
      />
    </>
  );
}
