"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CtaLink } from "@/components/marketing/CtaLink";
import { MobileNavigation } from "@/components/marketing/MobileNavigation";
import { Logo } from "@/components/marketing/primitives";
import { CTA, NAV_LINKS } from "@/content/marketing";
import { cn } from "@/lib/utils";

export function MarketingNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setScrolled(window.scrollY > 12));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    // The header keeps a fixed 72px slot (no layout shift); on scroll the inner bar detaches into a
    // floating glass pill. The empty strip around the pill lets clicks through to the page.
    <header
      data-scrolled={scrolled}
      className={cn(
        "pointer-events-none sticky top-0 z-40 h-[72px] w-full transition-[padding] duration-500 ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none",
        scrolled ? "px-3 pt-2.5 sm:px-4" : "px-0 pt-0",
      )}
    >
      <div
        className={cn(
          "pointer-events-auto mx-auto flex w-full items-center justify-between gap-6 border transition-[max-width,height,border-radius,background-color,border-color,box-shadow,padding] duration-500 ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none",
          scrolled
            ? "h-14 max-w-[1100px] rounded-full border-white/70 bg-white/55 pl-4 pr-2 shadow-[0_10px_40px_-12px_rgba(23,45,77,0.28),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl backdrop-saturate-150 sm:pl-5"
            : "h-[72px] max-w-[1200px] rounded-none border-transparent bg-transparent px-4 sm:px-6 lg:px-8",
        )}
      >
        <Logo />
        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={cn(
                    "rounded-full px-3 py-2 text-sm transition-colors hover:bg-white/60 hover:text-foreground",
                    // Slightly stronger text on glass so it stays legible over dark sections.
                    scrolled ? "text-foreground/80" : "text-muted-foreground",
                  )}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href={CTA.login}
            className="hidden min-h-10 items-center rounded-full px-3 text-sm font-medium text-foreground hover:text-primary sm:inline-flex"
          >
            Log in
          </Link>
          <CtaLink href={CTA.signup} size="default" className="hidden h-10 rounded-full px-5 sm:inline-flex">
            Get started
          </CtaLink>
          <MobileNavigation />
        </div>
      </div>
    </header>
  );
}
