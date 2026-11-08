import { Hammer, Layers, Signpost } from "lucide-react";
import { Container, Reveal, Section, SectionHeading } from "@/components/marketing/primitives";
import { PROBLEMS } from "@/content/marketing";

const ICONS = [Hammer, Layers, Signpost];

export function ProblemSection() {
  return (
    <Section id="problem" labelledBy="problem-title">
      <Container>
        <SectionHeading
          id="problem-title"
          eyebrow="The problem"
          title={
            <>
              Most startups don&apos;t fail because founders can&apos;t build.{" "}
              <span className="text-muted-foreground">They fail because they build the wrong thing.</span>
            </>
          }
        />
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {PROBLEMS.map((p, i) => {
            const Icon = ICONS[i];
            return (
              <Reveal
                key={p.title}
                as="article"
                index={i}
                className="group rounded-2xl border border-border bg-card p-6 transition-[border-color,transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-navy/5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-destructive/[0.07] text-destructive">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{p.title}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">{p.body}</p>
              </Reveal>
            );
          })}
        </div>
        <Reveal className="mx-auto mt-14 max-w-2xl text-center">
          <p className="text-balance text-xl font-medium leading-snug sm:text-2xl">
            What if you could investigate the market{" "}
            <span className="text-primary">before investing in the product?</span>
          </p>
        </Reveal>
      </Container>
    </Section>
  );
}
