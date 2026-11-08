import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { AuthSwitchButton } from "@/components/auth/AuthSwitchButton";
import { CtaLink } from "@/components/marketing/CtaLink";
import { Logo } from "@/components/marketing/primitives";
import { NAV_LINKS } from "@/content/marketing";

const LINKS = NAV_LINKS.filter((l) => ["/#product", "/#how-it-works", "/#pricing", "/#faq"].includes(l.href));

/** Header for login/signup: brand, site navigation, and a switch to the other auth page. */
export function AuthHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {LINKS.map((l) => (
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
            href="/"
            className="hidden min-h-11 items-center gap-1.5 rounded-md px-3 text-sm text-muted-foreground hover:text-foreground sm:inline-flex"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to home
          </Link>
          {/* Reads the URL, so it must sit in Suspense to keep dynamic auth routes prerenderable. */}
          <Suspense
            fallback={
              <CtaLink href="/signup" size="default" className="h-10 px-4">
                Create account
              </CtaLink>
            }
          >
            <AuthSwitchButton />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
