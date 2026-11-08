import { Code2, Rocket, Wrench } from "lucide-react";
import { Container, Reveal, Section, SectionHeading } from "@/components/marketing/primitives";
import { USE_CASES } from "@/content/marketing";

const ICONS = [Wrench, Rocket, Code2];

export function UseCasesSection() {
  return (
    <Section id="use-cases" labelledBy="use-cases-title" className="bg-card">
      <Container>
        <SectionHeading
          id="use-cases-title"
          eyebrow="Use cases"
          title="Built for people who want to build businesses, not just collect ideas."
        />
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {USE_CASES.map((u, i) => {
            const Icon = ICONS[i];
            return (
              <Reveal
                key={u.title}
                as="article"
                index={i}
                className="relative overflow-hidden rounded-2xl border border-border bg-background p-7 transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-primary/30 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <span
                  aria-hidden
                  className="absolute -right-6 -top-6 size-28 rounded-full bg-primary/[0.06]"
                />
                <span className="relative flex size-11 items-center justify-center rounded-xl bg-navy text-white">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="relative mt-6 text-lg font-semibold">{u.title}</h3>
                <p className="relative mt-2 font-medium leading-snug text-foreground/85">{u.body}</p>
                <p className="relative mt-3 text-sm leading-relaxed text-muted-foreground">{u.detail}</p>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
