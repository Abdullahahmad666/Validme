import type { Metadata } from "next";
import Link from "next/link";
import { DraftNotice, PageHeader, Prose } from "@/components/marketing/PageShell";
import { Container, Section } from "@/components/marketing/primitives";
import { BRAND_NAME } from "@/lib/brand";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Terms of service",
  description: `The terms for using ${BRAND_NAME}.`,
  path: "/terms",
});

export default function TermsPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Terms of service" lead={`The rules for using ${BRAND_NAME}, written to be read.`} />
      <Section className="pt-12">
        <Container className="max-w-3xl">
          <DraftNotice updated="8 November 2026" />
          <Prose>
            <h2>The service</h2>
            <p>
              {BRAND_NAME} researches business ideas using the sources available to it and produces reports that link
              findings to evidence. Coverage depends on which sources we can legitimately access, and each report states
              what was and wasn&apos;t searched.
            </p>

            <h2>Your account</h2>
            <ul>
              <li>Keep your login and API keys secure. You&apos;re responsible for activity under your account.</li>
              <li>One person per account. Provide a real email address so we can verify it.</li>
            </ul>

            <h2>Research is information, not advice</h2>
            <p>
              Reports, scores and market estimates help you decide; they aren&apos;t financial, legal or investment
              advice and don&apos;t guarantee results. Market sizes are estimates based on stated assumptions. Always
              check important findings against the linked evidence.
            </p>

            <h2>Acceptable use</h2>
            <ul>
              <li>Don&apos;t use the service for anything unlawful, or to harass or profile individuals.</li>
              <li>Don&apos;t use outputs to send unsolicited bulk messages or automated outreach.</li>
              <li>Don&apos;t attempt to scrape, overload or bypass the limits of the service or its API.</li>
            </ul>

            <h2>Your content</h2>
            <p>
              Your ideas and projects remain yours. You give us permission to process them only to provide the service,
              as described in the <Link href="/privacy">privacy policy</Link>. Evidence excerpts belong to their original
              authors and are shown with attribution and links.
            </p>

            <h2>Credits and paid plans</h2>
            <p>
              Research uses credits, charged once per report. Prices, allowances, renewal and refund terms for paid plans
              will be published before they launch and shown before you pay.
            </p>

            <h2>Availability and changes</h2>
            <p>
              We may change or discontinue features, and sources may become unavailable. If a source fails during a
              report, the report is marked as partially completed rather than silently skipping it.
            </p>

            <h2>Ending your use</h2>
            <p>
              You can stop using {BRAND_NAME} at any time. We may suspend accounts that break these terms. See the{" "}
              <Link href="/contact">contact page</Link> to delete your account.
            </p>

            <h2>Changes to these terms</h2>
            <p>We&apos;ll update this page and tell signed-in users about material changes.</p>
          </Prose>
        </Container>
      </Section>
    </>
  );
}
