import { CheckCircle2 } from "lucide-react";
import { CtaLink } from "@/components/marketing/CtaLink";
import { HeroDashboardPreview } from "@/components/marketing/HeroDashboardPreview";
import { Container, Eyebrow } from "@/components/marketing/primitives";
import { CTA } from "@/content/marketing";

const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

export function HeroSection() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden pb-20 pt-10 sm:pt-16 lg:pb-28 lg:pt-20">
      {/* Restrained backdrop: faint grid + soft blue wash. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [background-image:linear-gradient(to_right,rgba(23,45,77,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(23,45,77,0.05)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_40%,transparent_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-18rem] -z-10 h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <Container className="grid items-center gap-14 lg:grid-cols-[1fr_1.08fr] lg:gap-12">
        <div className="max-w-xl">
          <Eyebrow className="vm-in">AI-powered market intelligence for founders</Eyebrow>
          <h1
            id="hero-title"
            className="mt-5 text-balance text-[2.6rem] font-semibold leading-[1.04] tracking-[-0.035em] sm:text-6xl lg:text-[4.1rem]"
          >
            <span className="vm-in block" style={d(80)}>
              Stop building on assumptions.
            </span>
            <span className="vm-in block text-primary" style={d(200)}>
              Start building on evidence.
            </span>
          </h1>
          <p className="vm-in mt-6 text-pretty text-lg leading-relaxed text-muted-foreground" style={d(340)}>
            Discover real customer problems, validate market demand, uncover competitor gaps and find where your first
            paying customers are.
          </p>
          <div className="vm-in mt-8 flex flex-col gap-3 sm:flex-row" style={d(460)}>
            <CtaLink href={CTA.signup} arrow event="hero_cta_clicked" eventProps={{ cta: "validate_my_idea" }}>
              Validate my idea
            </CtaLink>
            <CtaLink
              href={CTA.sampleReport}
              variant="secondary"
              event="hero_cta_clicked"
              eventProps={{ cta: "sample_report" }}
            >
              Explore a sample report
            </CtaLink>
          </div>
          <p className="vm-in mt-4 text-sm text-muted-foreground" style={d(560)}>
            No market research expertise required. Your first Quick report is free.
          </p>
          <ul className="vm-in mt-8 flex flex-col gap-2 text-sm text-foreground/80 sm:flex-row sm:gap-5" style={d(660)}>
            {["Every finding links to its source", "Sources used are always disclosed"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-success" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="vm-in lg:pl-4" style={d(300)}>
          <HeroDashboardPreview />
        </div>
      </Container>
    </section>
  );
}
