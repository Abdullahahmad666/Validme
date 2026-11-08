import { BookOpen, Mail, MessageSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/marketing/PageShell";
import { Container, Section } from "@/components/marketing/primitives";
import { CONTACT_EMAIL } from "@/lib/brand";
import { pageMetadata } from "@/lib/seo";
import { PageJsonLd } from "@/components/marketing/PageJsonLd";

export const metadata: Metadata = pageMetadata("contact");

export default function ContactPage() {
  return (
    <>
      <PageJsonLd page="contact" />
      <PageHeader eyebrow="Contact" title="Get in touch" lead="Questions about research, your account or privacy? Here's how to reach us." />
      <Section className="pt-16">
        <Container className="grid max-w-4xl gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-6 md:col-span-2">
            <Mail className="size-5 text-primary" aria-hidden />
            <h2 className="mt-3 font-semibold">Email</h2>
            {CONTACT_EMAIL ? (
              <p className="mt-1 text-muted-foreground">
                Write to{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-primary hover:underline">
                  {CONTACT_EMAIL}
                </a>
                . We read every message.
              </p>
            ) : (
              <p className="mt-1 text-muted-foreground">
                Our support inbox is being set up and will be listed here before public launch. We won&apos;t show an
                address that nobody reads.
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <BookOpen className="size-5 text-primary" aria-hidden />
            <h2 className="mt-3 font-semibold">Common questions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sources, privacy and pricing are covered in the{" "}
              <Link href="/#faq" className="font-medium text-primary hover:underline">
                FAQ
              </Link>
              .
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 md:col-span-3">
            <MessageSquare className="size-5 text-primary" aria-hidden />
            <h2 className="mt-3 font-semibold">Privacy requests</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              To access or delete your data, see how it&apos;s handled in our{" "}
              <Link href="/privacy" className="font-medium text-primary hover:underline">
                privacy policy
              </Link>
              .
            </p>
          </div>
        </Container>
      </Section>
    </>
  );
}
