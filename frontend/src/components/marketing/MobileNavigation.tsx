"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { CtaLink } from "@/components/marketing/CtaLink";
import { Logo } from "@/components/marketing/primitives";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CTA, NAV_LINKS } from "@/content/marketing";

export function MobileNavigation() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/60 lg:hidden" aria-label="Open menu">
          <Menu aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(88vw,360px)] gap-0 p-0">
        <div className="border-b border-border px-5 py-3">
          <SheetTitle asChild>
            <div>
              <Logo />
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">Site navigation</SheetDescription>
        </div>
        <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="flex flex-col">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <SheetClose asChild>
                  <Link
                    href={l.href}
                    className="flex min-h-12 items-center rounded-lg px-3 text-base font-medium hover:bg-muted"
                  >
                    {l.label}
                  </Link>
                </SheetClose>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex flex-col gap-2 border-t border-border p-4">
          <SheetClose asChild>
            <CtaLink href={CTA.signup} className="w-full">
              Get started
            </CtaLink>
          </SheetClose>
          <SheetClose asChild>
            <CtaLink href={CTA.login} variant="secondary" className="w-full">
              Log in
            </CtaLink>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
