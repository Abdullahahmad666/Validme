"use client";

import { ArrowRight, BookOpen, ChevronRight, CircleHelp, FileBarChart, LayoutGrid, Menu, Tag, Users, Workflow, X } from "lucide-react";
import Link from "next/link";
import { CtaLink } from "@/components/marketing/CtaLink";
import { Logo } from "@/components/marketing/primitives";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CTA, NAV_LINKS } from "@/content/marketing";

const META: Record<string, { icon: typeof LayoutGrid; hint: string }> = {
  "/#product": { icon: LayoutGrid, hint: "Evidence, competitors, audience, distribution" },
  "/#how-it-works": { icon: Workflow, hint: "From idea to market-backed plan in 4 steps" },
  "/#use-cases": { icon: Users, hint: "Indie hackers, founders and builders" },
  "/#pricing": { icon: Tag, hint: "Start free, upgrade when you're ready" },
  "/#faq": { icon: CircleHelp, hint: "Sources, privacy and pricing, answered" },
};

const QUICK_LINKS = [
  { href: CTA.sampleReport, label: "Sample report", icon: FileBarChart },
  { href: "/glossary", label: "Glossary", icon: BookOpen },
];

const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

/** Mobile/tablet menu: floating glass panel matching the scrolled navbar. */
export function MobileNavigation() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/60 lg:hidden" aria-label="Open menu">
          <Menu aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton={false}
        overlayClassName="bg-navy/30 supports-backdrop-filter:backdrop-blur-sm"
        className="gap-0 overflow-hidden border border-white/70 bg-white/80 p-0 shadow-[0_24px_64px_-16px_rgba(23,45,77,0.45)] backdrop-blur-2xl backdrop-saturate-150 data-[side=right]:inset-y-3 data-[side=right]:right-3 data-[side=right]:h-[calc(100%-1.5rem)] data-[side=right]:w-[min(calc(100vw-1.5rem),380px)] data-[side=right]:rounded-3xl data-[side=right]:border"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <SheetTitle asChild>
            <div>
              <SheetClose asChild>
                <Logo />
              </SheetClose>
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">Site navigation</SheetDescription>
          <SheetClose asChild>
            <Button variant="ghost" size="icon" className="rounded-full bg-white/70 shadow-sm hover:bg-white" aria-label="Close menu">
              <X aria-hidden />
            </Button>
          </SheetClose>
        </div>

        {/* Primary navigation */}
        <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-3 pb-3 pt-2">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-strong">Explore</p>
          <ul className="space-y-1">
            {NAV_LINKS.map((l, i) => {
              const meta = META[l.href];
              const Icon = meta?.icon ?? LayoutGrid;
              return (
                <li key={l.href} className="vm-in" style={d(60 + i * 45)}>
                  <SheetClose asChild>
                    <Link
                      href={l.href}
                      className="group flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-white focus-visible:bg-white"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        <Icon className="size-[18px]" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold text-foreground">{l.label}</span>
                        {meta && <span className="block truncate text-xs text-muted-strong">{meta.hint}</span>}
                      </span>
                      <ChevronRight
                        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                        aria-hidden
                      />
                    </Link>
                  </SheetClose>
                </li>
              );
            })}
          </ul>

          <div className="vm-in mt-4 flex flex-wrap gap-2 px-1" style={d(320)}>
            {QUICK_LINKS.map((q) => (
              <SheetClose asChild key={q.href}>
                <Link
                  href={q.href}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border bg-white/70 px-3.5 text-sm font-medium text-foreground hover:border-primary/40 hover:bg-white"
                >
                  <q.icon className="size-4 text-primary" aria-hidden />
                  {q.label}
                </Link>
              </SheetClose>
            ))}
          </div>
        </nav>

        {/* CTA card */}
        <div className="vm-in p-3" style={d(380)}>
          <div className="relative overflow-hidden rounded-2xl bg-navy p-5 text-white">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 [background-image:radial-gradient(ellipse_80%_70%_at_100%_0%,rgba(127,166,230,0.35),transparent_70%)]"
            />
            <p className="relative text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-soft">Free to start</p>
            <p className="relative mt-1.5 text-lg font-semibold leading-snug">Validate your first idea with evidence.</p>
            <div className="relative mt-4 flex flex-col gap-2">
              <SheetClose asChild>
                <CtaLink href={CTA.signup} variant="inverted" size="default" className="h-11 w-full rounded-full" event="hero_cta_clicked" eventProps={{ cta: "mobile_menu" }}>
                  Get started free
                  <ArrowRight aria-hidden />
                </CtaLink>
              </SheetClose>
              <SheetClose asChild>
                <CtaLink href={CTA.login} variant="ghost-inverted" size="default" className="h-11 w-full rounded-full">
                  Log in
                </CtaLink>
              </SheetClose>
            </div>
            <p className="relative mt-3 text-center text-xs text-white/60">No card required</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
