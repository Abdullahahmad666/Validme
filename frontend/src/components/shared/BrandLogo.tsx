import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** Brand mark: navy tile with an evidence check. Same artwork as the favicon and OG images. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="8" className="fill-navy" />
      <path d="M9 16.5l4.2 4.2L23 11" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="23" cy="11" r="2.2" className="fill-accent-soft" />
    </svg>
  );
}

/**
 * Mark + name, linking home. `nameClassName` lets a layout hide the name (e.g. the tablet icon rail)
 * while the accessible name always stays on the link.
 */
export function BrandLink({
  href,
  className,
  markClassName,
  nameClassName,
  label,
}: {
  href: string;
  className?: string;
  markClassName?: string;
  nameClassName?: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label ?? `${BRAND_NAME} home`}
      className={cn("inline-flex min-h-11 items-center gap-2.5 font-semibold tracking-tight", className)}
    >
      <LogoMark className={markClassName} />
      <span className={cn("text-[1.05rem] text-foreground", nameClassName)} aria-hidden>
        {BRAND_NAME}
      </span>
    </Link>
  );
}
