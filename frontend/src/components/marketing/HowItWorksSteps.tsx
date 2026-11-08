"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Step = { n: string; title: string; body: string };

/**
 * Desktop: steps scroll on the left while a sticky product visual on the right switches to
 * the active step (IntersectionObserver, no scroll listeners). Mobile: plain vertical
 * sequence with each visual inline. Works without JS (first visual shown, all steps readable).
 */
export function HowItWorksSteps({ steps, visuals }: { steps: readonly Step[]; visuals: React.ReactNode[] }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="mt-16 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
      <ol className="relative min-w-0 space-y-10 lg:space-y-0">
        {/* Connector line */}
        <span aria-hidden className="absolute bottom-6 left-5 top-6 hidden w-px bg-border lg:block" />
        {steps.map((s, i) => (
          <li
            key={s.n}
            ref={(el) => {
              refs.current[i] = el;
            }}
            data-index={i}
            aria-current={active === i ? "step" : undefined}
            className="relative lg:flex lg:min-h-[58vh] lg:items-center"
          >
            <div className="flex gap-5">
              <span
                className={cn(
                  "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold tabular-nums transition-colors duration-300 motion-reduce:transition-none",
                  active === i
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                {s.n}
              </span>
              <div className="min-w-0 pt-1.5">
                <h3
                  className={cn(
                    "text-xl font-semibold transition-colors duration-300 motion-reduce:transition-none sm:text-2xl",
                    active === i ? "text-foreground" : "lg:text-foreground/60",
                  )}
                >
                  {s.title}
                </h3>
                <p className="mt-2 max-w-md leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            </div>
            {/* Mobile / tablet: visual inline */}
            <div className="mt-6 lg:hidden">{visuals[i]}</div>
          </li>
        ))}
      </ol>

      {/* Desktop: sticky visual */}
      <div className="hidden lg:block">
        <div className="sticky top-28">
          <div className="relative">
            {visuals.map((v, i) => (
              <div
                key={i}
                aria-hidden={active !== i}
                className={cn(
                  "transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none",
                  i === 0 ? "relative" : "absolute inset-x-0 top-0",
                  active === i ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0",
                )}
              >
                {v}
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-center gap-1.5" aria-hidden>
            {visuals.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none",
                  active === i ? "w-6 bg-primary" : "w-1.5 bg-border",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
