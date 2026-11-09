import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Marks a value the AI proposed and the founder hasn't confirmed or edited yet. */
export function AISuggestedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-ai/10 px-2 py-0.5 text-[11px] font-medium text-ai",
        className,
      )}
    >
      <Sparkles className="size-3" aria-hidden />
      AI suggested
    </span>
  );
}
