import {
  Bot,
  CheckCircle2,
  Eye,
  FileText,
  FlaskConical,
  Link2,
  Mail,
  Minus,
  Radar,
  RefreshCw,
  Users,
  type LucideIcon,
} from "lucide-react";
import { InViewGroup } from "@/components/marketing/InViewGroup";
import { Container, LogoMark, SampleDataBadge, Section, SectionHeading } from "@/components/marketing/primitives";
import { DIFFERENTIATORS, KEEPS_WORKING } from "@/content/marketing";
import { BRAND_NAME } from "@/lib/brand";

const ROW_ICONS: Record<(typeof DIFFERENTIATORS)[number]["id"], LucideIcon> = {
  evidence: Link2,
  competitors: Eye,
  recheck: RefreshCw,
  digest: Mail,
  lab: FlaskConical,
  customers: Users,
};
const EVENT_ICONS: Record<(typeof KEEPS_WORKING)[number]["id"], LucideIcon> = {
  report: FileText,
  price: Eye,
  signal: Radar,
  survey: FlaskConical,
  digest: Mail,
};

/**
 * Why ValidMe and not just a chat assistant: a chat answers once; ValidMe keeps working on the idea. A month
 * unfolds event by event (sample data, labelled), then a side-by-side comparison. Fair to chat assistants, and
 * every ValidMe line is a feature the product has.
 */
export function DifferenceSection() {
  return (
    <Section id="why-validme" labelledBy="why-title" className="bg-card">
      <Container>
        <SectionHeading
          id="why-title"
          eyebrow="Why not just ask ChatGPT or Claude?"
          title={
            <>
              A chat gives you an answer. <span className="text-primary">{BRAND_NAME} keeps working on your idea.</span>
            </>
          }
          body="AI chat assistants are great for brainstorming: they answer what you ask, when you ask. ValidMe is built for one job, checking an idea against real evidence, and it keeps watching after the first answer."
        />

        {/* The month, side by side */}
        <InViewGroup className="mt-14">
          <div className="rv-card relative overflow-hidden rounded-3xl bg-navy p-5 text-white shadow-[0_30px_70px_-35px_rgba(23,45,77,0.8)] sm:p-8">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 [background-image:radial-gradient(ellipse_60%_70%_at_75%_40%,rgba(127,166,230,0.22),transparent_65%),linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] [background-size:auto,48px_48px,48px_48px]"
            />
            <div className="relative grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-10">
              {/* A chat */}
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-white/70">
                  <Bot className="size-4" aria-hidden /> In a chat
                </p>
                <div className="mt-5 space-y-3">
                  <p className="rv-card ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-white/15 px-4 py-2.5 text-sm" style={{ "--i": 1 } as React.CSSProperties}>
                    Is there demand for a stock-counting app for small restaurants?
                  </p>
                  <p className="rv-card w-fit max-w-[90%] rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-sm text-navy" style={{ "--i": 2 } as React.CSSProperties}>
                    There&apos;s likely demand. Many small restaurants find inventory slow and error-prone…
                  </p>
                  <p className="rv-fade pt-2 text-sm italic text-white/55" style={{ "--i": 3 } as React.CSSProperties}>
                    …and nothing more until you ask again.
                  </p>
                </div>
              </div>

              {/* With ValidMe: the month keeps going */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <span className="rounded-md ring-1 ring-white/30">
                      <LogoMark className="size-5" />
                    </span>
                    With {BRAND_NAME}
                  </p>
                  <SampleDataBadge tone="dark" />
                </div>
                <ol className="relative mt-5 space-y-3 pl-8">
                  <span aria-hidden className="rv-line absolute top-2 bottom-2 left-[13px] w-px bg-gradient-to-b from-[#7fa6e6] to-[#7fa6e6]/20" />
                  {KEEPS_WORKING.map((e, i) => {
                    const Icon = EVENT_ICONS[e.id];
                    const last = i === KEEPS_WORKING.length - 1;
                    return (
                      <li key={e.id} className="rv-card relative" style={{ "--i": i + 2 } as React.CSSProperties}>
                        <span
                          aria-hidden
                          className={`absolute top-3 -left-8 flex size-7 items-center justify-center rounded-full border border-white/20 bg-[#0f2140] ${last ? "vm-latest" : ""}`}
                        >
                          <Icon className="size-3.5 text-[#9fc0f0]" />
                        </span>
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5">
                          <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wide text-[#9fc0f0]">{e.when}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold">{e.title}</span>
                            <span className="block text-sm text-white/70">{e.detail}</span>
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          </div>
        </InViewGroup>

        {/* Side by side */}
        <InViewGroup className="mt-8">
          <div className="rv-card overflow-hidden rounded-2xl border border-border bg-background" style={{ "--i": 1 } as React.CSSProperties}>
            <div className="hidden grid-cols-[1.1fr_1fr_1.4fr] border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
              <span className="px-5 py-3">What you need</span>
              <span className="flex items-center gap-1.5 px-5 py-3">
                <Bot className="size-3.5" aria-hidden /> A general AI chat
              </span>
              <span className="flex items-center gap-1.5 bg-primary/[0.06] px-5 py-3 text-primary">
                <LogoMark className="size-3.5" /> {BRAND_NAME}
              </span>
            </div>
            <ul className="divide-y divide-border">
              {DIFFERENTIATORS.map((d, i) => {
                const Icon = ROW_ICONS[d.id];
                return (
                  <li key={d.id} className="rv-card grid gap-2 p-5 md:grid-cols-[1.1fr_1fr_1.4fr] md:gap-0 md:p-0" style={{ "--i": i + 2 } as React.CSSProperties}>
                    <span className="flex items-center gap-2.5 font-semibold md:px-5 md:py-4">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      {d.title}
                    </span>
                    <span className="flex items-start gap-2 text-sm text-muted-foreground md:px-5 md:py-4">
                      <Minus className="mt-0.5 size-4 shrink-0" aria-hidden />
                      <span>
                        <span className="sr-only">A general AI chat: </span>
                        {d.chat}
                      </span>
                    </span>
                    <span className="flex items-start gap-2 rounded-lg bg-primary/[0.06] p-3 text-sm md:rounded-none md:px-5 md:py-4">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                      <span>
                        <span className="sr-only">{BRAND_NAME}: </span>
                        {d.us}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </InViewGroup>
        <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-muted-foreground">
          Already use Claude? Run {BRAND_NAME} from it with the {BRAND_NAME} MCP server: validate ideas, read reports and get
          channel ideas without leaving the chat.
        </p>
      </Container>
    </Section>
  );
}
