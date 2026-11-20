"use client";

import { Check, FileSearch, FlaskConical, Lightbulb, Map as MapIcon, Pause, Play, Radar } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/**
 * The demo slot's fallback when no video is set (`DEMO_VIDEO.src`), drawn in code: five steps from idea to "predicted vs actual".
 * Every value is illustrative and labelled "Sample data". Auto-advances every 4.5 s; pause, step buttons and
 * prefers-reduced-motion (starts paused) keep it accessible (WCAG 2.2.2).
 */
const STEPS = [
  { key: "idea", icon: Lightbulb, label: "Describe the idea", caption: "One sentence about the problem, who has it and your idea." },
  { key: "sources", icon: Radar, label: "Search allowed sources", caption: "Web search, Hacker News, Stack Exchange and your own links, with coverage shown." },
  { key: "evidence", icon: FileSearch, label: "Evidence → findings", caption: "Every finding cites the posts it came from, grouped into themes." },
  { key: "report", icon: MapIcon, label: "Score and first-10 plan", caption: "A score with its confidence, what would change it, and where to find customers." },
  { key: "lab", icon: FlaskConical, label: "Test with real people", caption: "A test page and survey; what people do outweighs what research predicted." },
] as const;

const STEP_MS = 4500;
const MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeMotion(onChange: () => void) {
  const mq = window.matchMedia?.(MOTION_QUERY);
  mq?.addEventListener("change", onChange);
  return () => mq?.removeEventListener("change", onChange);
}

function prefersReducedMotion() {
  return window.matchMedia?.(MOTION_QUERY).matches ?? false;
}

function Bar({ label, value, tone = "bg-[#7FA6E6]" }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] text-white/70">
        <span>{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={cn("h-full rounded-full transition-[width] duration-700", tone)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Scene({ step }: { step: number }) {
  const card = "rounded-xl border border-white/15 bg-white/[0.06] p-3 text-left backdrop-blur";
  switch (STEPS[step].key) {
    case "idea":
      return (
        <div className={cn(card, "w-full max-w-md")}>
          <p className="text-[11px] uppercase tracking-wide text-white/50">Your idea</p>
          <p className="mt-1 text-sm text-white">
            A tool that helps independent restaurants count stock on a phone and cut food waste.
            <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-white align-middle motion-reduce:animate-none" />
          </p>
        </div>
      );
    case "sources":
      return (
        <ul className="grid w-full max-w-md grid-cols-2 gap-2">
          {["Web search", "Hacker News", "Stack Exchange", "Your links"].map((s, i) => (
            <li key={s} className={cn(card, "flex items-center justify-between text-xs text-white")}>
              {s}
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300">
                <Check className="size-3" aria-hidden /> {12 + i * 5} found
              </span>
            </li>
          ))}
        </ul>
      );
    case "evidence":
      return (
        <div className="grid w-full max-w-md gap-2">
          {[
            ["Counting takes a whole evening", 9],
            ["Spreadsheets drift from real stock", 6],
            ["POS doesn't track ingredients", 4],
          ].map(([t, n]) => (
            <div key={t as string} className={cn(card, "flex items-center justify-between text-xs text-white")}>
              <span>“{t}”</span>
              <span className="text-white/60">{n} sources</span>
            </div>
          ))}
        </div>
      );
    case "report":
      return (
        <div className={cn(card, "grid w-full max-w-md gap-2")}>
          <p className="text-sm text-white">
            <span className="text-2xl font-semibold tabular-nums">62</span>/100 · medium confidence · research more
          </p>
          <Bar label="Demand evidence" value={70} />
          <Bar label="Pain intensity" value={64} />
          <Bar label="Willingness to pay" value={41} />
        </div>
      );
    case "lab":
      return (
        <div className={cn(card, "grid w-full max-w-md gap-2")}>
          <p className="text-xs text-white/70">Predicted vs actual · Demand</p>
          <Bar label="Research predicted" value={58} />
          <Bar label="Your test page (140 views)" value={77} tone="bg-emerald-300" />
        </div>
      );
  }
}

export function Walkthrough() {
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<boolean | null>(null); // the visitor's play/pause, once they've pressed it
  // Autoplay only when motion is welcome; the server snapshot says "reduce", so it starts still and matches hydration.
  const reduce = useSyncExternalStore(subscribeMotion, prefersReducedMotion, () => true);
  const playing = choice ?? !reduce;
  const setPlaying = (next: boolean | ((p: boolean) => boolean)) => setChoice(typeof next === "function" ? next(playing) : next);
  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => setStep((s) => (s + 1) % STEPS.length), STEP_MS);
    return () => window.clearTimeout(t);
  }, [playing, step]);
  const current = STEPS[step];
  return (
    <div className="relative flex size-full flex-col items-center justify-between gap-4 p-4 text-center text-white sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_50%_0%,rgba(127,166,230,0.25),transparent_60%),linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:auto,48px_48px,48px_48px]"
      />
      <p className="relative self-start rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white/80">
        Sample data · illustration
      </p>
      <div key={current.key} className="relative flex w-full flex-1 flex-col items-center justify-center gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500">
        <p className="text-base font-semibold sm:text-lg">
          {step + 1}. {current.label}
        </p>
        <p className="max-w-md text-xs text-white/70 sm:text-sm" aria-live="polite">
          {current.caption}
        </p>
        <Scene step={step} />
      </div>
      <div className="relative flex w-full flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="inline-flex size-11 items-center justify-center rounded-full border border-white/20 bg-white/10 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
          aria-label={playing ? "Pause walkthrough" : "Play walkthrough"}
        >
          {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
        </button>
        <ol className="flex gap-1">
          {STEPS.map((s, i) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => {
                  setStep(i);
                  setPlaying(false);
                }}
                aria-current={i === step ? "step" : undefined}
                aria-label={`Step ${i + 1}: ${s.label}`}
                className={cn(
                  "inline-flex size-11 items-center justify-center rounded-full border focus-visible:outline-2 focus-visible:outline-white",
                  i === step ? "border-white/60 bg-white/20" : "border-white/15 bg-white/5 hover:bg-white/10",
                )}
              >
                <s.icon className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
