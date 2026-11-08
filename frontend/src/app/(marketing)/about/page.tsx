import { Ban, Eye, FileCheck2, Lock, Scale } from "lucide-react";
import type { Metadata } from "next";
import { FinalCTASection } from "@/components/marketing/FinalCTASection";
import { PageHeader } from "@/components/marketing/PageShell";
import { Container, Reveal, Section } from "@/components/marketing/primitives";
import { BRAND_NAME } from "@/lib/brand";
import { pageMetadata } from "@/lib/seo";
import { PageJsonLd } from "@/components/marketing/PageJsonLd";

export const metadata: Metadata = pageMetadata("about");

const PRINCIPLES = [
  {
    icon: FileCheck2,
    title: "Evidence before opinion",
    body: "Findings must point to stored evidence. If we can't support a claim, we don't make it.",
  },
  {
    icon: Eye,
    title: "Show what we didn't search",
    body: "Every report lists the sources it used and the ones it couldn't. Gaps are visible, not hidden.",
  },
  {
    icon: Scale,
    title: "Honest numbers",
    body: "Missing data says “unavailable”. Scores come with confidence and the formula behind them.",
  },
  {
    icon: Lock,
    title: "Your ideas stay yours",
    body: "Projects are private to your account. We don't publish, sell or share them.",
  },
  {
    icon: Ban,
    title: "No automated outreach",
    body: "We help you find where customers are. Talking to them is yours to do, as a person.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageJsonLd page="about" />
      <PageHeader
        eyebrow="About"
        title="We built the research step we kept skipping."
        lead={`${BRAND_NAME} exists so founders can check whether people want something before spending months building it, using evidence they can click through and verify.`}
      />
      <Section>
        <Container className="grid gap-14 lg:grid-cols-[1fr_1.2fr]">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight">Why evidence-first</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              AI can write a confident market analysis about anything. That&apos;s the problem. Founders don&apos;t need
              more confident text. They need to see the conversations, complaints and competitor pages behind a
              conclusion, and decide for themselves.
            </p>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              So {BRAND_NAME} keeps three things apart: the original evidence, the AI&apos;s interpretation of it, and your
              own assumptions. You always know which is which.
            </p>
          </Reveal>
          <ul className="grid gap-4 sm:grid-cols-2">
            {PRINCIPLES.map((p, i) => (
              <Reveal as="li" key={p.title} index={i % 2} className="rounded-2xl border border-border bg-card p-5">
                <p.icon className="size-5 text-primary" aria-hidden />
                <h3 className="mt-3 font-semibold">{p.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
              </Reveal>
            ))}
          </ul>
        </Container>
      </Section>
      <FinalCTASection />
    </>
  );
}
