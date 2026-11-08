import type { Metadata } from "next";
import { FinalCTASection } from "@/components/marketing/FinalCTASection";
import { PageHeader } from "@/components/marketing/PageShell";
import { Container, Section } from "@/components/marketing/primitives";
import { SITE_URL } from "@/lib/brand";
import { GLOSSARY_TERMS } from "@/content/glossary";
import { pageMetadata } from "@/lib/seo";
import { PageJsonLd } from "@/components/marketing/PageJsonLd";

export const metadata: Metadata = pageMetadata("glossary");


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
              {GLOSSARY_TERMS.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`} className="block rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                    {t.term.split(" (")[0]}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <dl className="divide-y divide-border rounded-2xl border border-border bg-card">
            {GLOSSARY_TERMS.map((t) => (
              <div key={t.id} id={t.id} className="scroll-mt-24 p-6">
                <dt className="font-semibold">{t.term}</dt>
                <dd className="mt-1.5 leading-relaxed text-muted-foreground">{t.def}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </Section>
      <FinalCTASection />
      <PageJsonLd
        page="glossary"
        extra={[
          {
          "@type": "DefinedTermSet",
          name: "Market research glossary",
          url: `${SITE_URL}/glossary`,
          hasDefinedTerm: GLOSSARY_TERMS.map((t) => ({
            "@type": "DefinedTerm",
            name: t.term,
            description: t.def,
            url: `${SITE_URL}/glossary#${t.id}`,
          })),
          },
        ]}
      />
    </>
  );
}
