import type { Metadata } from "next";
import Link from "next/link";
import { DraftNotice, PageHeader, Prose } from "@/components/marketing/PageShell";
import { Container, Section } from "@/components/marketing/primitives";
import { BRAND_NAME } from "@/lib/brand";
import { pageMetadata } from "@/lib/seo";
import { PageJsonLd } from "@/components/marketing/PageJsonLd";

export const metadata: Metadata = pageMetadata("privacy");

export default function PrivacyPage() {
  return (
    <>
      <PageJsonLd page="privacy" />
      <PageHeader eyebrow="Legal" title="Privacy policy" lead="What we collect, why, and who it's shared with, in plain language." />
      <Section className="pt-12">
        <Container className="max-w-3xl">
          <DraftNotice updated="17 November 2026" />
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
              <li>
                If you watch competitor pages, to send a weekly digest of what changed. It goes only to a verified
                address, has no tracking pixels, and you can turn it off in Settings or from the link in every email.
              </li>
            </ul>
            <p>We don&apos;t sell your data, and we don&apos;t use your ideas for advertising.</p>

            <h2>Who we share it with</h2>
            <p>To research an idea we send search queries derived from it to the providers that do the work:</p>
            <ul>
              <li>a web search API provider, to find public pages and discussions;</li>
              <li>an AI model provider, to interpret, classify and summarise collected evidence;</li>
              <li>
                the public APIs of supported communities (Hacker News, Stack Exchange and GitHub), which receive search
                queries only;
              </li>
              <li>
                when you ask for it on the &ldquo;Where to find your customers&rdquo; page: YouTube, which receives your
                research queries to find channels, and DataForSEO, which receives short keywords from them to return
                search volumes.
              </li>
            </ul>
            <p>
              {BRAND_NAME} uses YouTube API Services to show public YouTube channel and video information. We don&apos;t
              access any YouTube account of yours, and we delete the YouTube data we store within 30 days of reading it. Google&apos;s
              handling of data is described in the{" "}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
                Google Privacy Policy
              </a>
              , and YouTube&apos;s terms in the{" "}
              <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">
                YouTube Terms of Service
              </a>
              .
            </p>
            <p>
              Payments are handled by Polar, our merchant of record. You enter card details on their checkout, never
              on our pages; we receive your order and subscription status, not your card number.
            </p>
            <p>
              We also rely on infrastructure providers (hosting, database and email delivery). The specific providers will
              be listed here before public launch.
            </p>

            <h2>If you join a waitlist or answer a survey on a test page</h2>
            <p>
              Founders can publish simple test pages with a waitlist, and short surveys. These are on a separate web address
              from {BRAND_NAME}, set no cookies and run no tracking scripts. If you join a waitlist:
            </p>
            <ul>
              <li>
                we store your email address encrypted, with the time you agreed and the consent wording you saw. We don&apos;t
                store your IP address;
              </li>
              <li>
                only the founder who made the page can see it, and only to tell you about that product (they can&apos;t message
                you through {BRAND_NAME});
              </li>
              <li>it&apos;s deleted automatically after the period shown on the form (at most a year), or sooner on request;</li>
              <li>
                pages count views and sign-ups per day, nothing about you. If a page uses Cloudflare Turnstile to block bots,
                Cloudflare processes your visit to check it.
              </li>
            </ul>
            <p>If you answer a survey:</p>
            <ul>
              <li>
                the founder who made it sees your answers. Anything you type, and your email if you choose to leave one, is
                stored encrypted. Choices are stored as which option you picked;
              </li>
              <li>answers are deleted automatically after the period shown on the form (at most a year), or sooner on request;</li>
              <li>
                without an email, your answers can&apos;t be traced back to you, which also means they can&apos;t be found later
                to delete.
              </li>
              <li>
                emails typed into waitlists and surveys aren&apos;t verified, so someone could enter yours. If you hear from a
                founder you don&apos;t know, use the link below to see and delete what&apos;s stored.
              </li>
            </ul>
            <p>
              Some test pages show prices being considered. Nothing is for sale and nothing is charged: pressing
              &ldquo;Choose&rdquo; is counted per day as interest in that price, without anything about you. Which prices you see
              is picked from your network address and the day; the address itself isn&apos;t stored.
            </p>
            <p>
              To get a copy of what&apos;s stored with your email, or have it deleted, use the &ldquo;Get a copy or delete your
              data&rdquo; link at the bottom of any test page or survey. We email you a confirmation link first. When you delete,
              we tell the founder so they can also delete any copy they downloaded. You can also <Link href="/contact">contact us</Link>.
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
