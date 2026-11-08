import type { Metadata } from "next";
import Link from "next/link";
import { DraftNotice, PageHeader, Prose } from "@/components/marketing/PageShell";
import { Container, Section } from "@/components/marketing/primitives";
import { BRAND_NAME } from "@/lib/brand";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Privacy policy",
  description: `How ${BRAND_NAME} collects, uses and protects your data.`,
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Privacy policy" lead="What we collect, why, and who it's shared with, in plain language." />
      <Section className="pt-12">
        <Container className="max-w-3xl">
          <DraftNotice updated="8 November 2026" />
          <Prose>
            <h2>What we collect</h2>
            <ul>
              <li>
                <strong>Account details:</strong> your email address and a securely hashed password. If you sign in with
                Google, we receive your email address and basic profile name from Google.
              </li>
              <li>
                <strong>Your projects:</strong> idea descriptions, objectives, market details and any links you add.
              </li>
              <li>
                <strong>Research data:</strong> the search queries generated for your project and the evidence records
                collected (source link, excerpt, dates).
              </li>
              <li>
                <strong>Usage and billing records:</strong> credit grants and spends, and the cost of the research we run.
              </li>
              <li>
                <strong>API keys:</strong> if you create one for the MCP server, we store only a one-way hash of it.
              </li>
              <li>
                <strong>Technical data:</strong> standard server logs (such as IP address, browser and request time)
                used for security and debugging.
              </li>
            </ul>

            <h2>How we use it</h2>
            <ul>
              <li>To run the research you request and produce your reports.</li>
              <li>To keep your account secure, prevent abuse (for example rate limits) and enforce plan allowances.</li>
              <li>To send account emails such as email verification and password resets.</li>
            </ul>
            <p>We don&apos;t sell your data, and we don&apos;t use your ideas for advertising.</p>

            <h2>Who we share it with</h2>
            <p>To research an idea we send search queries derived from it to the providers that do the work:</p>
            <ul>
              <li>a web search API provider, to find public pages and discussions;</li>
              <li>an AI model provider, to interpret, classify and summarise collected evidence;</li>
              <li>the public APIs of supported communities (for example Hacker News), which receive search queries only.</li>
            </ul>
            <p>
              We also rely on infrastructure providers (hosting, database and email delivery). The specific providers will
              be listed here before public launch.
            </p>

            <h2>Who can see your projects</h2>
            <p>
              Your projects, evidence and reports are visible only to your account. Every request to our API is checked
              against the project&apos;s owner.
            </p>

            <h2>Cookies</h2>
            <p>
              We use only the cookies needed to keep you signed in and protect forms. See the{" "}
              <Link href="/cookies">cookie policy</Link>.
            </p>

            <h2>Your choices and rights</h2>
            <ul>
              <li>You can update your name, revoke API keys and delete projects from the app.</li>
              <li>
                You can ask us to export or delete your account and data. See the <Link href="/contact">contact page</Link>
                .
              </li>
            </ul>

            <h2>Retention</h2>
            <p>
              We keep your data while your account is active. Search results may be cached for up to 7 days to avoid
              repeating identical queries. When you delete your account, your projects and research data are deleted.
            </p>

            <h2>Changes</h2>
            <p>If we change this policy in a meaningful way, we&apos;ll update this page and tell signed-in users.</p>
          </Prose>
        </Container>
      </Section>
    </>
  );
}
