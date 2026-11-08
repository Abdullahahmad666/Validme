import { FlaskConical } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { BRAND_NAME } from "@/lib/brand";

/** Brand mark: navy tile with an evidence check. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <rect width="32" height="32" rx="8" className="fill-navy" />
      <path d="M9 16.5l4.2 4.2L23 11" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="23" cy="11" r="2.2" className="fill-accent-soft" />
    </svg>
  );
}

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <Link href="/" className={cn("inline-flex min-h-11 items-center gap-2.5 font-semibold tracking-tight", className)}>
      <LogoMark />
      <span className={cn("text-[1.05rem]", inverted ? "text-white" : "text-foreground")}>{BRAND_NAME}</span>
    </Link>
  );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-xs font-semibold uppercase tracking-[0.14em] text-primary", className)}>{children}</p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  body,
  align = "center",
  id,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  body?: React.ReactNode;
  align?: "center" | "left";
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("vm-reveal", align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-2xl", className)}>
      {eyebrow && <Eyebrow className="mb-4">{eyebrow}</Eyebrow>}
      <h2 id={id} className="text-balance text-3xl font-semibold leading-[1.12] tracking-tight sm:text-4xl lg:text-[2.75rem]">
        {title}
      </h2>
      {body && <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">{body}</p>}
    </div>
  );
}

/** Scroll reveal: CSS scroll-driven animation; content is never hidden when unsupported or reduced-motion. */
export function Reveal({
  children,
  index = 0,
  from = "bottom",
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  index?: number;
  from?: "bottom" | "left";
  className?: string;
  as?: "div" | "li" | "article" | "section";
}) {
  return (
    <Tag
      className={cn(from === "left" ? "vm-reveal-left" : "vm-reveal", className)}
      style={{ "--i": index } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
}

export function SampleDataBadge({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        tone === "light" ? "bg-warning/10 text-warning-text" : "bg-white/10 text-white/80",
        className,
      )}
    >
      <FlaskConical className="size-3" aria-hidden />
      Sample data
    </span>
  );
}

export function Container({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

export function Section({
  id,
  labelledBy,
  children,
  className,
}: {
  id?: string;
  labelledBy?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn("scroll-mt-20 py-20 sm:py-28", className)}>
      {children}
    </section>
  );
}
