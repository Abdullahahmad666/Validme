import { LogoMark, SampleDataBadge } from "@/components/marketing/primitives";
import { cn } from "@/lib/utils";

/**
 * Product-window chrome that mirrors the real app (sidebar tokens, header, cards).
 * Everything rendered inside is illustrative and labelled as sample data.
 */
export function DashboardMockup({
  title,
  crumb,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  crumb?: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <figure
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(23,32,51,0.04),0_24px_48px_-24px_rgba(23,45,77,0.25)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border bg-background/60 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <LogoMark className="size-5 shrink-0" />
          <p className="truncate text-xs text-muted-foreground">
            {crumb && <span>{crumb} / </span>}
            <span className="font-medium text-foreground">{title}</span>
          </p>
        </div>
        <SampleDataBadge />
      </div>
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
      <figcaption className="sr-only">Illustrative product screen with sample data: {title}</figcaption>
    </figure>
  );
}

export function MockCard({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-xl border border-border bg-card p-3.5", className)} {...props} />;
}

export function MockLabel({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-[11px] font-medium uppercase tracking-wide text-muted-foreground", className)} {...props} />;
}

type Tone = "primary" | "success" | "warning" | "destructive" | "muted";
const TONES: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

export function Pill({ children, tone = "muted", className }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium", TONES[tone], className)}>
      {children}
    </span>
  );
}

/** Horizontal bar (pain distribution per design system: horizontal bars, no pies). */
export function Bar({ value, tone = "primary", delay }: { value: number; tone?: "primary" | "warning" | "success"; delay?: number }) {
  const color = { primary: "bg-primary", warning: "bg-warning", success: "bg-success" }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="presentation">
      <div
        className={cn("h-full rounded-full", color, delay !== undefined && "vm-grow")}
        style={{ width: `${value}%`, "--d": delay !== undefined ? `${delay}ms` : undefined } as React.CSSProperties}
      />
    </div>
  );
}
