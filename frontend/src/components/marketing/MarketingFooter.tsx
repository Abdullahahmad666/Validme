import Link from "next/link";
import { CurrentYear } from "@/components/marketing/CurrentYear";
import { Container, Logo } from "@/components/marketing/primitives";
import { FOOTER_COLUMNS } from "@/content/marketing";
import { BRAND_NAME, BRAND_TAGLINE, SOCIAL_LINKS } from "@/lib/brand";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <Container className="py-14">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_2fr]">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{BRAND_TAGLINE}</p>
            {SOCIAL_LINKS.length > 0 && (
              <ul className="mt-5 flex gap-4">
                {SOCIAL_LINKS.map((s) => (
                  <li key={s.href}>
                    <a href={s.href} rel="noopener noreferrer" target="_blank" className="text-sm text-muted-foreground hover:text-foreground">
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title}>
                <h2 className="text-sm font-semibold">{col.title}</h2>
                <ul className="mt-3 space-y-1">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="inline-flex min-h-9 items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <p>
            © <CurrentYear /> {BRAND_NAME}. All rights reserved.
          </p>
          <p>Evidence-first market research for founders.</p>
        </div>
      </Container>
    </footer>
  );
}
