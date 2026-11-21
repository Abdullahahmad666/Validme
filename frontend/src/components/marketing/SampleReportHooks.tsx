"use client";

import { ArrowRight, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CTA } from "@/content/marketing";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/** Signup that lands in the wizard with the idea already typed in (the wizard reads `?idea=`). */
export function ideaSignupHref(idea: string): string {
  const text = idea.trim().slice(0, 2000);
  const next = text ? `/research/new?idea=${encodeURIComponent(text)}` : "/research/new";
  return `${CTA.signup}?next=${encodeURIComponent(next)}`;
}

/**
 * "Now try yours": the founder types their own idea in one sentence and goes straight to signup, then into the
 * research wizard with it filled in. Nothing is sent anywhere until they continue.
 */
export function TryYourIdea({ id = "try-your-idea" }: { id?: string }) {
  const [idea, setIdea] = useState("");
  const href = ideaSignupHref(idea);
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] via-card to-ai/[0.06] p-6 sm:p-8"
    >
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
        <Sparkles className="size-3.5" aria-hidden /> Your turn
      </p>
      <h2 id={`${id}-title`} className="mt-3 max-w-2xl text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
        This report started as one sentence. What&apos;s yours?
      </h2>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Describe your idea and see what real conversations say before you spend months building it. Your first Quick
        report is free; no card needed.
      </p>
      <form
        className="mt-5 flex flex-col gap-3 sm:flex-row"
        action={CTA.signup}
        onSubmit={(e) => {
          e.preventDefault();
          track("hero_cta_clicked", { cta: "sample_report_try_idea", filled: idea.trim().length > 0 });
          window.location.assign(href);
        }}
      >
        <label htmlFor={`${id}-input`} className="sr-only">
          Your idea in one sentence
        </label>
        <input
          id={`${id}-input`}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          maxLength={2000}
          placeholder="e.g. A booking tool for independent dog groomers that cuts no-shows"
          className="h-12 min-w-0 flex-1 rounded-xl border border-input bg-card px-4 text-base shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
        />
        <button
          type="submit"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Validate my idea <ArrowRight className="size-4" aria-hidden />
        </button>
      </form>
    </section>
  );
}

/** A short prompt between report sections tying what was just shown to the founder's own idea. */
export function SectionHook({ text, cta, event }: { text: string; cta: string; event: string }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-primary/30 bg-primary/[0.04] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-medium text-foreground">{text}</p>
      <Link
        href={CTA.signup}
        onClick={() => track("hero_cta_clicked", { cta: event })}
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-primary/10"
      >
        {cta} <ArrowRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}

/**
 * A slim bar that slides up once the reader is past the overview, and hides again near the page's final call to
 * action (or when dismissed). It never covers the report's own content on load.
 */
export function StickyReportCta({ startId, endId }: { startId: string; endId: string }) {
  const [past, setPast] = useState(false);
  const [atEnd, setAtEnd] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const start = document.getElementById(startId);
    const end = document.getElementById(endId);
    if (!start || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === start) setPast(!e.isIntersecting && e.boundingClientRect.top < 0);
        if (e.target === end) setAtEnd(e.isIntersecting);
      }
    });
    io.observe(start);
    if (end) io.observe(end);
    return () => io.disconnect();
  }, [startId, endId]);

  const show = past && !atEnd && !dismissed;
  return (
    <div
      aria-hidden={!show}
      className={cn(
        "fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 transition-[opacity,transform] duration-300 motion-reduce:transition-none",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0",
      )}
    >
      <div className="flex w-full max-w-2xl items-center gap-3 rounded-2xl border border-border bg-card/95 py-2.5 pr-2 pl-4 shadow-[0_18px_40px_-16px_rgba(23,45,77,0.45)] backdrop-blur-md">
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">Sample report.</span>{" "}
          <span className="text-muted-foreground">Want one for your idea?</span>
        </p>
        <Link
          href={CTA.signup}
          tabIndex={show ? undefined : -1}
          onClick={() => track("hero_cta_clicked", { cta: "sample_report_sticky" })}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Validate my idea <ArrowRight className="size-4" aria-hidden />
        </Link>
        <button
          type="button"
          tabIndex={show ? undefined : -1}
          aria-label="Dismiss"
          onClick={() => setDismissed(true)}
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
