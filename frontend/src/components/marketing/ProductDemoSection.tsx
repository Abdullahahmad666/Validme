import { FileSearch, Lightbulb, Map as MapIcon, PlayCircle, Radar } from "lucide-react";
import { Container, Reveal, Section, SectionHeading } from "@/components/marketing/primitives";
import { DEMO_VIDEO } from "@/content/marketing";
import { BRAND_NAME } from "@/lib/brand";

const STORYBOARD = [
  { icon: Lightbulb, label: "Describe the idea" },
  { icon: Radar, label: "Search allowed sources" },
  { icon: FileSearch, label: "Evidence → findings" },
  { icon: MapIcon, label: "First-10 plan" },
];

/**
 * Reserved space for the product walkthrough animation/video. Renders the real player when
 * DEMO_VIDEO.src is set; until then, an honest "coming soon" storyboard (no fake player).
 */
export function ProductDemoSection() {
  return (
    <Section id="demo" labelledBy="demo-title">
      <Container>
        <SectionHeading
          id="demo-title"
          eyebrow="See it in action"
          title={`Watch ${BRAND_NAME} turn one sentence into a research report.`}
        />
        <Reveal className="mx-auto mt-12 max-w-5xl">
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-navy/10 bg-navy shadow-[0_32px_64px_-32px_rgba(23,45,77,0.55)]">
            {DEMO_VIDEO.src ? (
              <video
                className="size-full object-cover"
                controls
                playsInline
                preload="none"
                poster={DEMO_VIDEO.poster ?? undefined}
                aria-label={`${BRAND_NAME} product walkthrough`}
              >
                <source src={DEMO_VIDEO.src} type="video/mp4" />
                {DEMO_VIDEO.captions && <track kind="captions" src={DEMO_VIDEO.captions} srcLang="en" label="English" default />}
              </video>
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-6 p-6 text-center text-white sm:gap-8">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_50%_0%,rgba(127,166,230,0.25),transparent_60%),linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:auto,48px_48px,48px_48px]"
                />
                <PlayCircle className="relative size-12 text-white/70 sm:size-16" aria-hidden strokeWidth={1.25} />
                <div className="relative">
                  <p className="text-lg font-semibold sm:text-xl">Product walkthrough coming soon</p>
                  <p className="mt-1 text-sm text-white/65">A two-minute tour from idea to evidence-backed plan.</p>
                </div>
                <ol className="relative hidden grid-cols-4 gap-3 sm:grid">
                  {STORYBOARD.map((s, i) => (
                    <li key={s.label} className="flex flex-col items-center gap-2 text-xs text-white/75">
                      <span className="flex size-10 items-center justify-center rounded-xl border border-white/15 bg-white/5">
                        <s.icon className="size-4" aria-hidden />
                      </span>
                      <span>
                        {i + 1}. {s.label}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
