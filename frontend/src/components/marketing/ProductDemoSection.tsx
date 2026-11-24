import { DemoVideoPlayer } from "@/components/marketing/DemoVideoPlayer";
import { Container, Reveal, Section, SectionHeading } from "@/components/marketing/primitives";
import { Walkthrough } from "@/components/marketing/Walkthrough";
import { DEMO_VIDEO, type DemoVideo } from "@/content/marketing";
import { BRAND_NAME } from "@/lib/brand";

/**
 * The product walkthrough: the real video player when DEMO_VIDEO.src is set, otherwise a code-drawn walkthrough
 * (sample data, labelled; pausable; still for reduced motion). The video plays muted once it scrolls into view
 * (not with reduced motion). Nothing visible sits under it (the video shows its own example-data label and
 * music credit); screen readers get the note and a text alternative of everything on screen.
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
              <DemoVideoPlayer
                src={video.src}
                poster={video.poster}
                captions={video.captions}
                title={video.title}
                describedBy="demo-note"
              />
            ) : (
              <Walkthrough />
            )}
          </div>
          {video.src && (
            // Screen-reader text alternative only; the video itself carries the example-data label and music credit.
            <div className="sr-only">
              <p id="demo-note">{video.note}</p>
              <ol>
                {video.shows.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
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
