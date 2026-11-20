import { Container, Reveal, Section, SectionHeading } from "@/components/marketing/primitives";
import { Walkthrough } from "@/components/marketing/Walkthrough";
import { DEMO_VIDEO, type DemoVideo } from "@/content/marketing";
import { BRAND_NAME } from "@/lib/brand";

/**
 * The product walkthrough: the real video player when DEMO_VIDEO.src is set, otherwise a code-drawn walkthrough
 * (sample data, labelled; pausable; still for reduced motion). The video never autoplays; under it sit the
 * example-data note, the music credit and a text alternative of everything shown on screen.
 */
export function ProductDemoSection({ video = DEMO_VIDEO }: { video?: DemoVideo }) {
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
            {video.src ? (
              <video
                className="size-full object-cover"
                controls
                playsInline
                preload="none"
                poster={video.poster ?? undefined}
                aria-label={video.title}
                aria-describedby="demo-note"
              >
                <source src={video.src} type="video/mp4" />
                {video.captions && <track kind="captions" src={video.captions} srcLang="en" label="English" default />}
              </video>
            ) : (
              <Walkthrough />
            )}
          </div>
          {video.src && (
            <div className="mt-4 text-sm text-muted-foreground">
              <p id="demo-note">{video.note}</p>
              <p className="mt-1">
                Music: “{video.credit.track}” by {video.credit.author} (
                <a href={video.credit.sourceUrl} className="underline underline-offset-2 hover:text-foreground" rel="noopener noreferrer" target="_blank">
                  ende.app
                </a>
                ), licensed under{" "}
                <a href={video.credit.licenseUrl} className="underline underline-offset-2 hover:text-foreground" rel="noopener noreferrer license" target="_blank">
                  {video.credit.license}
                </a>
                .
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer py-3 font-medium text-foreground">What the video shows</summary>
                <ol id="demo-shows" className="mt-2 list-decimal space-y-1 pl-5">
                  {video.shows.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </details>
            </div>
          )}
        </Reveal>
      </Container>
    </Section>
  );
}

/** schema.org VideoObject for the homepage: facts only, from the same config the player uses. */
export function demoVideoEntity(siteUrl: string, video: DemoVideo = DEMO_VIDEO) {
  if (!video.src) return null;
  return {
    "@type": "VideoObject",
    "@id": `${siteUrl}/#demo-video`,
    name: video.title,
    description: video.summary,
    thumbnailUrl: video.poster ? `${siteUrl}${video.poster}` : undefined,
    contentUrl: `${siteUrl}${video.src}`,
    uploadDate: video.uploadDate,
    duration: video.duration,
    inLanguage: "en",
  };
}
