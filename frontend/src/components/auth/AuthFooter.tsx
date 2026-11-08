import Link from "next/link";
import { CurrentYear } from "@/components/marketing/CurrentYear";
import { BRAND_NAME } from "@/lib/brand";

const LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/#faq", label: "Help & FAQ" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/cookies", label: "Cookies" },
];

export function AuthFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 px-4 py-5 text-sm text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <p>
          © <CurrentYear /> {BRAND_NAME}. Evidence-first market research for founders.
        </p>
        <nav aria-label="Footer">
          <ul className="-mx-2 flex flex-wrap gap-x-1 gap-y-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-flex min-h-9 items-center rounded-md px-2 hover:text-foreground">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
