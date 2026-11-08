"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { track, type AnalyticsEvent, type AnalyticsProps } from "@/lib/analytics";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "inverted" | "ghost-inverted";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-[#284f92] shadow-sm shadow-primary/20",
  secondary: "border-border bg-card text-foreground hover:border-primary/40 hover:bg-card",
  inverted: "bg-white text-navy hover:bg-white/90",
  "ghost-inverted": "border-white/25 bg-transparent text-white hover:bg-white/10",
};

/** Link styled as a button, optionally firing an analytics event on click. */
export function CtaLink({
  href,
  children,
  variant = "primary",
  size = "lg",
  event,
  eventProps,
  arrow = false,
  className,
  onClick,
  ...rest
}: Omit<React.ComponentProps<typeof Link>, "href" | "className" | "children"> & {
  href: string;
  children: React.ReactNode;
  variant?: Variant;
  size?: "default" | "lg";
  event?: AnalyticsEvent;
  eventProps?: AnalyticsProps;
  arrow?: boolean;
  className?: string;
}) {
  return (
    <Link
      {...rest}
      href={href}
      onClick={(e) => {
        if (event) track(event, eventProps);
        onClick?.(e);
      }}
      className={cn(
        buttonVariants({ variant: variant === "primary" ? "default" : "outline", size }),
        "group/cta transition-colors",
        size === "lg" && "h-12 px-6 text-[0.95rem]",
        VARIANTS[variant],
        className,
      )}
    >
      {children}
      {arrow && (
        <ArrowRight
          aria-hidden
          className="transition-transform duration-200 group-hover/cta:translate-x-0.5 motion-reduce:transition-none"
        />
      )}
    </Link>
  );
}
