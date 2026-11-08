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
    <header
      data-scrolled={scrolled}
      className={cn(
        "sticky top-0 z-40 w-full border-b transition-[background-color,border-color,backdrop-filter] duration-300 motion-reduce:transition-none",
        scrolled ? "border-border bg-white/85 backdrop-blur-md" : "border-transparent bg-background/40",
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-[1200px] items-center justify-between gap-6 px-4 transition-[height] duration-300 motion-reduce:transition-none sm:px-6 lg:px-8",
          scrolled ? "h-16" : "h-[72px]",
        )}
      >
        <Logo />
        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
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
            className="hidden min-h-11 items-center rounded-md px-3 text-sm font-medium text-foreground hover:text-primary sm:inline-flex"
          >
            Log in
          </Link>
          <CtaLink href={CTA.signup} size="default" className="hidden h-10 px-4 sm:inline-flex">
            Get started
          </CtaLink>
          <MobileNavigation />
        </div>
      </div>
    </header>
  );
}
