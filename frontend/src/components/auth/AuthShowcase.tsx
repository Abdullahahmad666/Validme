import { CheckCircle2, FileSearch, Lock, Quote, ShieldCheck } from "lucide-react";
import { SampleDataBadge } from "@/components/marketing/primitives";

export type AuthShowcaseMode = "login" | "signup" | "verify";

const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

const COPY: Record<AuthShowcaseMode, { title: string; body: string }> = {
  signup: {
    title: "Validate your next idea with evidence, not guesses.",
    body: "Describe an idea and watch it turn into demand signals, pain points and a first-customer plan, with every finding linked to its source.",
  },
  login: {
    title: "Welcome back. Your evidence is waiting.",
    body: "Pick up where you left off: reports, evidence and next steps are saved to your workspace.",
  },
  verify: {
    title: "One click and your free report is unlocked.",
    body: "Confirming your email activates your free Quick report.",
  },
};

// Illustrative sample data only (labelled). No real sources or URLs.
const STAGES = ["Idea analysis", "Web research", "Evidence analysis", "Competitor analysis", "Opportunity report"];
const SIGNALS = [
  { label: "Pain points", n: 14, w: 100 },
  { label: "Workarounds", n: 7, w: 50 },
  { label: "Buying intent", n: 6, w: 43 },
];

export const TRUST_POINTS = [
  { icon: FileSearch, text: "Every finding links to its source" },
  { icon: ShieldCheck, text: "Sources used are always disclosed" },
  { icon: Lock, text: "Your ideas stay private to your account" },
];

const RING = 2 * Math.PI * 36; // circumference for r=36

/** Animated research preview for the auth split layout (CSS only; static under reduced motion). */
export function AuthShowcase({ mode }: { mode: AuthShowcaseMode }) {
  const copy = COPY[mode];
  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-3xl bg-navy p-10 text-white xl:p-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:radial-gradient(ellipse_70%_55%_at_80%_0%,rgba(127,166,230,0.32),transparent_70%),linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] [background-size:auto,48px_48px,48px_48px]"
      />

      <div className="relative flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-soft">Live research preview</p>
        <SampleDataBadge tone="dark" />
      </div>
      <h2 className="relative mt-6 max-w-md text-balance text-3xl font-semibold leading-tight tracking-tight xl:text-[2.1rem]">
        {copy.title}
      </h2>
      <p className="relative mt-3 max-w-md text-pretty leading-relaxed text-white/70">{copy.body}</p>

      {/* Animated composition */}
      <div className="relative mt-10 min-h-[450px] flex-1" aria-hidden>
        {/* Research progress card */}
        <div className="vm-in absolute left-0 top-0 w-[72%] max-w-[300px] rounded-2xl xl:w-[58%] bg-white p-5 text-foreground shadow-2xl shadow-black/30" style={d(200)}>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Restaurant inventory</p>
          <p className="mt-0.5 font-semibold">Research progress</p>
          <ul className="mt-4 space-y-2.5">
            {STAGES.map((s, i) => {
              const last = i === STAGES.length - 1;
              return (
                <li key={s} className="vm-in flex items-center justify-between gap-2 text-[13px]" style={d(500 + i * 380)}>
                  <span className="flex items-center gap-2">
                    {last ? (
                      <span className="vm-live size-2.5 rounded-full bg-primary" />
                    ) : (
                      <CheckCircle2 className="size-4 text-success" />
                    )}
                    {s}
                  </span>
                  {last && <span className="text-[11px] text-muted-strong">Writing…</span>}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Opportunity card with ring + signals */}
        <div
          className="vm-in absolute bottom-0 right-0 w-[66%] max-w-[290px] rounded-2xl xl:w-[54%] border border-white/10 bg-white/[0.07] p-5 backdrop-blur-md"
          style={d(1500)}
        >
          <div className="flex items-center gap-4">
            <svg viewBox="0 0 88 88" className="size-[84px] shrink-0 -rotate-90">
              <circle cx="44" cy="44" r="36" fill="none" className="stroke-white/15" strokeWidth="8" />
              <circle
                className="vm-ring stroke-accent-soft"
                cx="44"
                cy="44"
                r="36"
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={RING}
                strokeDashoffset={RING * (1 - 0.72)}
                style={{ ...d(1900), "--vm-ring-from": RING } as React.CSSProperties}
              />
            </svg>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-white/60">Opportunity</p>
              <p className="text-3xl font-semibold tabular-nums">
                72<span className="text-base font-normal text-white/60">/100</span>
              </p>
              <p className="text-[11px] text-white/70">Medium confidence</p>
            </div>
          </div>
          <ul className="mt-4 space-y-2">
            {SIGNALS.map((s, i) => (
              <li key={s.label}>
                <div className="mb-1 flex justify-between text-[11.5px] text-white/80">
                  <span>{s.label}</span>
                  <span className="tabular-nums">{s.n}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="vm-grow h-full rounded-full bg-accent-soft" style={{ width: `${s.w}%`, ...d(2200 + i * 150) }} />
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Floating evidence chip */}
        <div className="vm-in absolute right-0 top-6 hidden w-[40%] max-w-[230px] rounded-xl xl:block bg-white p-3 text-foreground shadow-xl shadow-black/25" style={d(2700)}>
          <div className="vm-float" style={d(3400)}>
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10.5px] font-medium text-destructive-text">
              Pain point
            </span>
            <p className="mt-1.5 flex gap-1.5 text-[12px] leading-snug">
              <Quote className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
              We throw out produce every week.
            </p>
            <p className="mt-1 text-[10.5px] text-muted-strong">Community thread · Mar 2026</p>
          </div>
        </div>
      </div>

      <ul className="relative mt-10 grid gap-3 text-sm text-white/80 xl:grid-cols-3">
        {TRUST_POINTS.map((t) => (
          <li key={t.text} className="flex items-start gap-2">
            <t.icon className="mt-0.5 size-4 shrink-0 text-accent-soft" aria-hidden />
            {t.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
