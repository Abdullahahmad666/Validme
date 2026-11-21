"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Plays a section's entrance once, when it scrolls into view: cards rise in, bars/columns grow and rings draw,
 * on a timer (so a fast scroll doesn't skip it). Styles live in globals.css under [data-reveal].
 *
 * - Server render and no-JS: no attribute, so everything is simply visible.
 * - Already on screen when the page hydrates: left as is (no flash of hidden content).
 * - Below the fold: hidden ("wait") until its top is 15% above the bottom of the screen, then "in" plays.
 * - Reduced motion: the global reduced-motion rule makes the transitions instant.
 */
export function InViewGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"wait" | "in" | undefined>(undefined);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.9 && r.bottom > 0) return; // visible at load: leave it alone
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time switch to the hidden pre-entrance state
    setState("wait");
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setState("in");
          io.disconnect();
        }
      },
      { threshold: 0, rootMargin: "0px 0px -15% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} data-reveal={state} className={className}>
      {children}
    </div>
  );
}
