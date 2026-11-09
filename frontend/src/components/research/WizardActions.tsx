import { cn } from "@/lib/utils";

/** Step footer: sticky above the mobile bottom nav, inline from md up. */
export function WizardActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 -mx-5 mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card/95 px-5 py-3 backdrop-blur sm:-mx-7 sm:px-7 md:static md:mx-0 md:bg-transparent md:px-0 md:py-0 md:pt-6 md:backdrop-blur-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
