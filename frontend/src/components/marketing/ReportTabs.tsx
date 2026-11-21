"use client";

import { useEffect, useRef, useState } from "react";
import { SampleDataBadge } from "@/components/marketing/primitives";
import { cn } from "@/lib/utils";

/**
 * The sample report's section tabs. Sticky only while the report is on screen (its parent wraps just the report),
 * and the tab for the section being read is highlighted and kept in view on narrow screens.
 */
export function ReportTabs({ tabs }: { tabs: readonly { id: string; label: string }[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const sections = tabs.map((t) => document.getElementById(t.id)).filter((el): el is HTMLElement => !!el);
    // A section counts as "being read" when it crosses a line ~30% down the screen.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-30% 0px -65% 0px" },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [tabs]);

  useEffect(() => {
    const link = listRef.current?.querySelector<HTMLAnchorElement>(`a[href="#${active}"]`);
    const list = listRef.current;
    if (!link || !list) return;
    const l = link.offsetLeft - list.offsetLeft;
    if (l < list.scrollLeft || l + link.offsetWidth > list.scrollLeft + list.clientWidth) {
      list.scrollTo({ left: l - 16, behavior: "smooth" });
    }
  }, [active]);

  return (
    // A floating glass pill like the site header above it (same width and rounding), not a full-width strip.
    <nav aria-label="Report sections" className="pointer-events-none sticky top-[76px] z-30 mt-4 px-3 sm:px-6">
      <div className="pointer-events-auto mx-auto flex w-full max-w-[1100px] items-center gap-2 rounded-full border border-border/70 bg-white/75 py-1.5 pr-2 pl-1.5 shadow-[0_14px_34px_-20px_rgba(23,45,77,0.4)] backdrop-blur-md">
        <ul ref={listRef} className="flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-full [scrollbar-width:none]">
          {tabs.map((t) => (
            <li key={t.id}>
              <a
                href={`#${t.id}`}
                aria-current={active === t.id ? "location" : undefined}
                className={cn(
                  "inline-flex min-h-10 items-center whitespace-nowrap rounded-full px-3.5 text-sm transition-colors",
                  active === t.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {t.label}
              </a>
            </li>
          ))}
        </ul>
        <SampleDataBadge className="hidden shrink-0 sm:inline-flex" />
      </div>
    </nav>
  );
}
