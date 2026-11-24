import { CheckCircle2, Hammer, Layers, RefreshCw, Signpost } from "lucide-react";
import { InViewGroup } from "@/components/marketing/InViewGroup";
import { Container, Reveal, Section, SectionHeading } from "@/components/marketing/primitives";
import { PROBLEMS } from "@/content/marketing";
import { BRAND_NAME } from "@/lib/brand";

const ICONS = [Hammer, Layers, Signpost, RefreshCw];

/**
 * The founder's problems, each answered. When the section arrives, each problem is struck through and the way
 * ValidMe solves it rises in underneath, card by card (InViewGroup; static without JS or with reduced motion).
 */
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
        <InViewGroup className="mt-14 grid gap-4 md:grid-cols-2">
          {PROBLEMS.map((p, i) => {
            const Icon = ICONS[i] ?? Hammer;
            return (
              <article
                key={p.title}
                className="rv-card flex flex-col overflow-hidden rounded-2xl border border-border bg-card"
                style={{ "--i": i } as React.CSSProperties}
              >
                <div className="flex-1 p-6">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-destructive/[0.07] text-destructive">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold">
                    <span className="relative">
                      {p.title}
                      <span
                        aria-hidden
                        className="rv-strike absolute top-1/2 left-0 h-0.5 w-full rounded-full bg-destructive/60"
                        style={{ "--i": i } as React.CSSProperties}
                      />
                    </span>
                  </h3>
                  <p className="mt-2 leading-relaxed text-muted-foreground">{p.body}</p>
                </div>
                <div
                  className="rv-fix flex gap-3 border-t border-success/20 bg-success/[0.06] px-6 py-4"
                  style={{ "--i": i } as React.CSSProperties}
                >
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
                  <p className="text-sm leading-relaxed">
                    <span className="font-semibold text-success-text">With {BRAND_NAME}: </span>
                    {p.fix}
                  </p>
                </div>
              </article>
            );
          })}
        </InViewGroup>
        <Reveal className="mx-auto mt-14 max-w-2xl text-center">
          <p className="text-balance text-xl font-medium leading-snug sm:text-2xl">
            Investigate the market <span className="text-primary">before investing in the product.</span>
          </p>
        </Reveal>
      </Container>
    </Section>
  );
}
