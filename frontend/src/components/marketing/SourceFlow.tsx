"use client";

import { ArrowRight, CheckCircle2, CircleDashed } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Source = { name: string; detail: string };

const STEP_MS = 680;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Two source cards joined by a connector. When the section first comes into view, each searched source lights up in
 * turn and a dot carries it across to the channel data it informs, then everything rests "connected". One pass
 * (~4 s, under WCAG 2.2.2's 5 s), never loops. Server render, no-JS and reduced motion show the resting state.
 */
export function SourceFlow({ supported, limited }: { supported: readonly Source[]; limited: readonly Source[] }) {
  const ref = useRef<HTMLDivElement>(null);
  // null = resting (everything connected); a number = the source being carried right now.
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        let s = 0;
        setStep(0);
        timer = setInterval(() => {
          s += 1;
          if (s >= supported.length) {
            clearInterval(timer);
            setStep(null);
          } else setStep(s);
        }, STEP_MS);
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) clearInterval(timer);
    };
  }, [supported.length]);

  const running = step !== null;
  const target = running ? step % Math.max(1, limited.length) : -1;

  return (
    <div
      ref={ref}
      className="mx-auto mt-14 grid max-w-5xl grid-cols-[minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_4.5rem_minmax(0,1fr)]"
    >
      <section aria-labelledby="sources-supported" className="rounded-2xl border border-border bg-background/70 p-5 shadow-sm sm:p-6">
        <h3 id="sources-supported" className="flex items-center gap-2 text-sm font-semibold text-success-text">
          <CheckCircle2 className="size-4" aria-hidden />
          Supported
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">Searched for evidence in every report.</p>
        <ul className="mt-4 space-y-1">
          {supported.map((s, i) => {
            const active = running && step === i;
            const done = !running || (step !== null && i < step);
            return (
              <li
                key={s.name}
                className={cn(
                  "relative -mx-3 flex gap-3 rounded-xl px-3 py-2.5 transition-[background-color,box-shadow] duration-300 motion-reduce:transition-none",
                  active && "bg-primary/[0.07] shadow-[inset_0_0_0_1px_rgba(49,94,170,0.22)]",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full border transition-colors duration-300",
                    active ? "border-primary bg-primary" : done ? "border-success bg-success" : "border-border bg-card",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{s.name}</span>
                  <span className="block text-sm text-muted-foreground">{s.detail}</span>
                </span>
                <ArrowRight
                  aria-hidden
                  className={cn(
                    "mt-1 size-4 shrink-0 text-primary transition-[opacity,transform] duration-300",
                    active ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0",
                  )}
                />
              </li>
            );
          })}
        </ul>
      </section>

      {/* Connector: evidence flows into the channel data (decorative). */}
      <div aria-hidden className="relative h-14 md:h-auto">
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-success/50 via-primary/50 to-warning/60 md:inset-x-0 md:top-1/2 md:h-px md:w-auto md:-translate-y-1/2 md:translate-x-0 md:bg-gradient-to-r" />
        <span className="absolute top-1/2 left-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-primary shadow-sm">
          <ArrowRight className="size-3.5 rotate-90 md:rotate-0" />
        </span>
        {running && (
          <span
            key={step}
            className="vm-packet absolute left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_0_4px_rgba(49,94,170,0.18)] md:top-1/2 md:left-0 md:translate-x-0 md:-translate-y-1/2"
          />
        )}
      </div>

      <section aria-labelledby="sources-limited" className="flex flex-col rounded-2xl border border-border bg-background/70 p-5 shadow-sm sm:p-6">
        <h3 id="sources-limited" className="flex items-center gap-2 text-sm font-semibold text-warning-text">
          <CircleDashed className="size-4" aria-hidden />
          Limited / rolling out
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">Customer-channel data for “Where to find your customers”, once connected.</p>
        <ul className="mt-4 space-y-2">
          {limited.map((s, j) => {
            const arriving = running && target === j;
            return (
              <li
                key={s.name}
                className={cn(
                  "relative -mx-3 flex gap-3 rounded-xl px-3 py-2.5 transition-[background-color,box-shadow] duration-300 motion-reduce:transition-none",
                  arriving && "vm-arrive bg-warning/[0.08] shadow-[inset_0_0_0_1px_rgba(201,133,0,0.3)]",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full border transition-colors duration-300",
                    arriving || !running ? "border-warning bg-warning" : "border-border bg-card",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{s.name}</span>
                  <span className="block text-sm text-muted-foreground">{s.detail}</span>
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-auto pt-6">
        <p className="rounded-xl border border-dashed border-border bg-card/70 p-4 text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">How they connect: </span>
          the evidence shows which problems people talk about and where; channel data adds where those same people watch and
          search, so “Where to find your customers” can point you to them.
        </p>
        </div>
      </section>
    </div>
  );
}
