"use client";

import {
  Bug,
  Globe,
  Link2,
  MessagesSquare,
  Newspaper,
  Search,
  SquarePlay,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BRAND_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

type Source = { name: string; status: "supported" | "limited" };

// Generic icons, not the platforms' own logos (their brand rules govern logo use; swap in real logos only if allowed).
const ICONS: Record<string, LucideIcon> = {
  "Web search": Search,
  "Hacker News": Newspaper,
  "Competitor websites": Globe,
  "Links you add": Link2,
  "Stack Exchange": MessagesSquare,
  "GitHub issues": Bug,
  "YouTube channels": SquarePlay,
  "Search demand": TrendingUp,
};

// Pill anchors in a 1000×520 box (left column, then right column); the hub sits at 500,260.
const SLOTS = [
  [210, 80],
  [165, 190],
  [165, 330],
  [210, 440],
  [790, 80],
  [835, 190],
  [810, 330],
  [790, 440],
] as const;
const HUB = [500, 260] as const;

/**
 * The research sources around the ValidMe mark, with evidence continuously flowing in along each line. Searched
 * sources have solid lines; rolling-out ones are dashed and amber. Runs only while on screen and is static with
 * reduced motion (no pause button, by product decision). On phones the sources sit in a grid under the mark.
 */
export function SourceHub({ sources }: { sources: readonly Source[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(false);
  const items = sources.slice(0, SLOTS.length);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const running = onScreen;

  return (
    <div
      ref={ref}
      data-running={running || undefined}
      className="vm-hub relative mx-auto mt-14 max-w-5xl overflow-hidden rounded-3xl border border-navy/20 bg-navy text-white shadow-[0_30px_70px_-35px_rgba(23,45,77,0.8)]"
    >
      {/* Ground: a faint grid and a glow behind the hub. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_50%_50%,rgba(127,166,230,0.28),transparent_45%),linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:auto,48px_48px,48px_48px]"
      />

      {/* Desktop / tablet: the hub diagram. */}
      <div className="relative hidden aspect-[1000/520] sm:block" role="img" aria-label={`${BRAND_NAME} gathers evidence from: ${items.map((s) => s.name + (s.status === "limited" ? " (rolling out)" : "")).join(", ")}.`}>
        <svg viewBox="0 0 1000 520" className="absolute inset-0 size-full" aria-hidden>
          {items.map((s, i) => {
            const [px, py] = SLOTS[i];
            const d = `M ${px} ${py} L ${HUB[0]} ${HUB[1]}`;
            const live = s.status === "supported";
            return (
              <g key={s.name}>
                <path d={d} stroke={live ? "rgba(255,255,255,0.28)" : "rgba(242,180,70,0.45)"} strokeWidth="1.5" fill="none" strokeDasharray={live ? undefined : "5 6"} />
                {/* Evidence travelling in: a short bright dash moving from the source to the hub. */}
                <path
                  d={d}
                  className="vm-hub-packet"
                  stroke={live ? "#9fc0f0" : "#f2b446"}
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                  pathLength={100}
                  strokeDasharray="6 94"
                  style={{ animationDelay: `${(i * 0.37) % 2.2}s`, animationDuration: `${2.2 + (i % 3) * 0.35}s` } as React.CSSProperties}
                />
              </g>
            );
          })}
        </svg>

        {/* The hub */}
        <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
          <span aria-hidden className="vm-hub-ring absolute size-40 rounded-full border border-[#7fa6e6]/40" />
          <span aria-hidden className="vm-hub-ring vm-hub-ring-2 absolute size-40 rounded-full border border-[#7fa6e6]/30" />
          <span className="relative flex size-28 items-center justify-center rounded-full border border-white/15 bg-[#0f2140] shadow-[0_0_60px_-10px_rgba(127,166,230,0.7)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- tiny static brand mark */}
            <img src="/icon.svg" alt={BRAND_NAME} className="size-14 rounded-xl" />
          </span>
        </div>

        {/* Source pills */}
        {items.map((s, i) => {
          const [px, py] = SLOTS[i];
          const Icon = ICONS[s.name] ?? Globe;
          return (
            <span
              key={s.name}
              className={cn(
                "absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-white px-3.5 py-2 text-sm font-medium text-navy shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)] lg:text-[0.95rem]",
                s.status === "limited" && "ring-2 ring-[#f2b446]/60",
              )}
              style={{ left: `${px / 10}%`, top: `${(py / 520) * 100}%` }}
            >
              <Icon className={cn("size-4", s.status === "limited" ? "text-warning" : "text-primary")} aria-hidden />
              {s.name}
              {s.status === "limited" && <span className="rounded-full bg-warning/15 px-1.5 text-[10px] font-semibold text-warning-text">Rolling out</span>}
            </span>
          );
        })}
      </div>

      {/* Phones: the mark, then the sources in a grid with a pulse on each. */}
      <div className="relative px-5 pt-8 pb-6 sm:hidden">
        <div className="flex justify-center">
          <span className="relative flex size-20 items-center justify-center rounded-full border border-white/15 bg-[#0f2140] shadow-[0_0_50px_-10px_rgba(127,166,230,0.7)]">
            <span aria-hidden className="vm-hub-ring absolute inset-0 rounded-full border border-[#7fa6e6]/40" />
            {/* eslint-disable-next-line @next/next/no-img-element -- tiny static brand mark */}
            <img src="/icon.svg" alt={BRAND_NAME} className="size-10 rounded-lg" />
          </span>
        </div>
        <ul className="mt-6 grid grid-cols-2 gap-2">
          {items.map((s, i) => {
            const Icon = ICONS[s.name] ?? Globe;
            return (
              <li key={s.name} className="flex min-h-10 items-center gap-2 rounded-2xl bg-white px-3 py-1.5 text-xs font-medium text-navy">
                <Icon className={cn("size-3.5 shrink-0", s.status === "limited" ? "text-warning" : "text-primary")} aria-hidden />
                <span className="leading-tight">{s.name}</span>
                <span
                  aria-hidden
                  className={cn("vm-hub-dot ml-auto size-1.5 shrink-0 rounded-full", s.status === "limited" ? "bg-warning" : "bg-primary")}
                  style={{ animationDelay: `${i * 0.25}s` }}
                />
              </li>
            );
          })}
        </ul>
      </div>

      <div className="relative flex flex-wrap items-center gap-3 border-t border-white/10 px-5 py-3 text-xs text-white/70">
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-5 rounded bg-[#9fc0f0]" /> Searched in every report
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-5 rounded border-t-2 border-dashed border-[#f2b446]" /> Rolling out
          </span>
        </span>
      </div>
    </div>
  );
}
