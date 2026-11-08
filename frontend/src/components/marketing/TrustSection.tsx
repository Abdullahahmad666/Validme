import { CheckCircle2, CircleDashed } from "lucide-react";
import { Container, Reveal, Section, SectionHeading } from "@/components/marketing/primitives";
import { SOURCES, type SourceStatus } from "@/content/marketing";
import { cn } from "@/lib/utils";

const GROUPS: { status: SourceStatus; title: string; icon: typeof CheckCircle2; tone: string }[] = [
  { status: "supported", title: "Supported", icon: CheckCircle2, tone: "text-success-text" },
  { status: "limited", title: "Limited / rolling out", icon: CircleDashed, tone: "text-warning-text" },
];

export function TrustSection() {
  return (
    <Section id="sources" labelledBy="sources-title" className="border-y border-border bg-card">
      <Container>
        <SectionHeading
          id="sources-title"
          eyebrow="Research sources"
          title="Turn market conversations into actionable intelligence."
          body="We only search sources we're allowed to use, and every report tells you exactly which ones it covered."
        />
        <div className="mx-auto mt-14 grid max-w-4xl gap-4 md:grid-cols-2">
          {GROUPS.map((g, gi) => (
            <Reveal key={g.status} index={gi} className="rounded-2xl border border-border bg-background/60 p-5">
              <h3 className={cn("flex items-center gap-2 text-sm font-semibold", g.tone)}>
                <g.icon className="size-4" aria-hidden />
                {g.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {SOURCES.filter((s) => s.status === g.status).map((s) => (
                  <li key={s.name}>
                    <p className="text-sm font-medium text-foreground">{s.name}</p>
                    <p className="text-sm text-muted-foreground">{s.detail}</p>
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
