import type { Metadata } from "next";
import { DraftNotice, PageHeader, Prose } from "@/components/marketing/PageShell";
import { Container, Section } from "@/components/marketing/primitives";
import { BRAND_NAME } from "@/lib/brand";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Cookie policy",
  description: `The cookies ${BRAND_NAME} uses and why.`,
  path: "/cookies",
});

// Must match the cookies the backend actually sets (Django session + CSRF).
const COOKIES = [
  { name: "sessionid", purpose: "Keeps you signed in after you log in.", duration: "2 weeks, or until you log out" },
  { name: "csrftoken", purpose: "Protects forms and requests from cross-site request forgery.", duration: "1 year" },
];

export default function CookiesPage() {
  return (
    <>
      <PageHeader eyebrow="Legal" title="Cookie policy" lead="Short version: only essential cookies. No advertising or tracking cookies." />
      <Section className="pt-12">
        <Container className="max-w-3xl">
          <DraftNotice updated="8 November 2026" />
          <Prose>
            <h2>Cookies we use</h2>
            <p>These are strictly necessary for the app to work, so they don&apos;t need consent.</p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="!mt-0">
                <thead className="bg-muted/50">
                  <tr>
                    <th scope="col">Cookie</th>
                    <th scope="col">Purpose</th>
                    <th scope="col">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {COOKIES.map((c) => (
                    <tr key={c.name}>
                      <td className="font-mono text-xs">{c.name}</td>
                      <td>{c.purpose}</td>
                      <td className="whitespace-nowrap">{c.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2>What we don&apos;t use</h2>
            <ul>
              <li>No advertising or cross-site tracking cookies.</li>
              <li>No third-party analytics cookies today. If we add analytics, we&apos;ll update this page first.</li>
            </ul>

            <h2>Google sign-in</h2>
            <p>
              If you choose “Continue with Google”, Google sets its own cookies on its sign-in pages under Google&apos;s
              policies.
            </p>

            <h2>Managing cookies</h2>
            <p>
              You can block or delete cookies in your browser settings. Blocking the essential cookies above will stop
              you from signing in.
            </p>
          </Prose>
        </Container>
      </Section>
    </>
  );
}
