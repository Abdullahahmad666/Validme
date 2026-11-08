import { Clock } from "lucide-react";
import { CtaLink } from "@/components/marketing/CtaLink";
import { Container, Eyebrow } from "@/components/marketing/primitives";
import { cn } from "@/lib/utils";

/** Header for secondary marketing pages. */
export function PageHeader({
  eyebrow,
  title,
  lead,
  children,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("relative overflow-hidden border-b border-border pb-14 pt-14 sm:pb-20 sm:pt-20", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [background-image:linear-gradient(to_right,rgba(23,45,77,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(23,45,77,0.045)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_60%_80%_at_50%_0%,#000_30%,transparent_100%)]"
      />
      <Container className="max-w-4xl text-center">
        {eyebrow && <Eyebrow className="vm-in">{eyebrow}</Eyebrow>}
        <h1
          className="vm-in mt-4 text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.03em] sm:text-5xl"
          style={{ "--d": "80ms" } as React.CSSProperties}
        >
          {title}
        </h1>
        {lead && (
          <p
            className="vm-in mx-auto mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground"
            style={{ "--d": "180ms" } as React.CSSProperties}
          >
            {lead}
          </p>
        )}
        {children}
      </Container>
    </header>
  );
}

/** Long-form text (legal, about) without a typography plugin. */
export function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "max-w-3xl text-[0.98rem] leading-relaxed text-foreground/85",
        "[&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline",
        "[&_h2]:mt-12 [&_h2]:scroll-mt-24 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground",
        "[&_h3]:mt-6 [&_h3]:font-semibold [&_h3]:text-foreground",
        "[&_p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5",
        "[&_table]:mt-4 [&_table]:w-full [&_table]:text-sm [&_td]:border-t [&_td]:border-border [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-top [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DraftNotice({ updated }: { updated: string }) {
  return (
    <p className="flex flex-wrap items-center gap-2 rounded-xl border border-warning/30 bg-warning/[0.06] px-4 py-3 text-sm">
      <span className="font-medium text-warning-text">Draft</span>
      <span className="text-foreground/80">
        This document describes how the product works today and hasn&apos;t yet been reviewed by legal counsel. Last
        updated {updated}.
      </span>
    </p>
  );
}

/** Honest placeholder for pages that don't exist yet (kept out of the sitemap, noindex). */
export function ComingSoon({ title, body }: { title: string; body: string }) {
  return (
    <Container className="max-w-2xl py-24 text-center sm:py-32">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Clock className="size-6" aria-hidden />
      </span>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">Coming soon</p>
      <p className="mx-auto mt-5 max-w-lg leading-relaxed text-muted-foreground">{body}</p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <CtaLink href="/" variant="secondary">
          Back to home
        </CtaLink>
        <CtaLink href="/glossary">Read the glossary</CtaLink>
      </div>
    </Container>
  );
}
