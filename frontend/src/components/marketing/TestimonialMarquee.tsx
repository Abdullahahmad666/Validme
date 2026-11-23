"use client";

import { Pause, Play, Quote } from "lucide-react";
import { useState } from "react";
import type { Testimonial } from "@/content/testimonials";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function Card({ t }: { t: Testimonial }) {
  return (
    <figure className="flex h-full w-[19rem] shrink-0 flex-col justify-between gap-5 rounded-2xl border border-border bg-card p-5 shadow-[0_12px_30px_-22px_rgba(23,45,77,0.45)] sm:w-[22rem]">
      <div>
        <Quote className="size-5 text-primary/40" aria-hidden />
        <blockquote className="mt-2 text-[0.95rem] leading-relaxed text-foreground/90">“{t.quote}”</blockquote>
      </div>
      <figcaption className="flex items-center gap-3">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {initials(t.name)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{t.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{t.role}</span>
        </span>
        {t.sample && (
          <span className="ml-auto shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning-text">Sample</span>
        )}
      </figcaption>
    </figure>
  );
}

/** One row: the cards twice (the copy is hidden from assistive tech) so the loop has no seam. */
function Row({ items, reverse, label }: { items: Testimonial[]; reverse?: boolean; label: string }) {
  return (
    <div className="vm-marquee-mask overflow-hidden">
      <ul
        aria-label={label}
        className={cn("vm-marquee flex w-max gap-4 py-2", reverse && "vm-marquee-reverse")}
        style={{ "--vm-marquee-duration": `${Math.max(40, items.length * 9)}s` } as React.CSSProperties}
      >
        {items.map((t) => (
          <li key={t.name}>
            <Card t={t} />
          </li>
        ))}
        {items.map((t) => (
          <li key={`${t.name}-copy`} aria-hidden="true" className="vm-marquee-copy">
            <Card t={t} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Two rows drifting in opposite directions (top right-to-left, bottom left-to-right). Slow, pauses on hover and on
 * keyboard focus, and has a pause button (WCAG 2.2.2: motion longer than 5 s must be stoppable). With reduced motion
 * the rows stand still and scroll sideways instead.
 */
export function TestimonialMarquee({ items }: { items: Testimonial[] }) {
  const [paused, setPaused] = useState(false);
  const half = Math.ceil(items.length / 2);
  const rows = [items.slice(0, half), items.slice(half)].filter((r) => r.length > 0);
  return (
    <div data-paused={paused || undefined} className="vm-marquee-group relative">
      <div className="flex flex-col gap-3">
        {rows.map((r, i) => (
          <Row key={i} items={r} reverse={i === 1} label={i === 0 ? "What founders say" : "More from founders"} />
        ))}
      </div>
      <div className="mt-4 flex justify-center">
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          className="vm-marquee-toggle inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm text-muted-foreground hover:text-foreground"
        >
          {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
          {paused ? "Play" : "Pause"} testimonials
        </button>
      </div>
    </div>
  );
}
