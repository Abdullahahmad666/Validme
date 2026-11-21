"use client";

import { useEffect, useRef } from "react";

/**
 * The homepage demo video. It starts playing, muted, once at least half of it is on screen, and pauses when it
 * scrolls away. A viewer who pauses it keeps it paused. With prefers-reduced-motion it never starts by itself.
 * Native controls stay on (pause, unmute, full screen), so moving content can always be stopped (WCAG 2.2.2).
 */
export function DemoVideoPlayer({
  src,
  poster,
  captions,
  title,
  describedBy,
}: {
  src: string;
  poster: string | null;
  captions: string | null;
  title: string;
  describedBy: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let pausedByViewer = false;
    let ourPause = false;
    const onPause = () => {
      if (ourPause) ourPause = false;
      else if (!v.ended) pausedByViewer = true; // the viewer pressed pause: respect it
    };
    const onPlay = () => {
      pausedByViewer = false;
    };
    v.addEventListener("pause", onPause);
    v.addEventListener("play", onPlay);

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (pausedByViewer || v.ended || !v.paused) return;
          v.muted = true; // browsers only allow muted autoplay; the viewer can unmute
          v.play().catch(() => {});
        } else if (!v.paused) {
          ourPause = true;
          v.pause();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(v);
    return () => {
      io.disconnect();
      v.removeEventListener("pause", onPause);
      v.removeEventListener("play", onPlay);
    };
  }, []);

  return (
    <video
      ref={ref}
      className="size-full object-cover"
      controls
      playsInline
      muted
      preload="metadata"
      poster={poster ?? undefined}
      aria-label={title}
      aria-describedby={describedBy}
    >
      <source src={src} type="video/mp4" />
      {captions && <track kind="captions" src={captions} srcLang="en" label="English" default />}
    </video>
  );
}
