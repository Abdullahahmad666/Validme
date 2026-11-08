import { ChevronDown } from "lucide-react";

/**
 * Native <details>/<summary> disclosure: keyboard accessible by default, answers are in the
 * server-rendered HTML (works without JS, findable with Ctrl+F, crawlable for FAQ rich results).
 */
export function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="divide-y divide-border rounded-2xl border border-border bg-background px-5 sm:px-6">
      {items.map((item) => (
        <details key={item.q} className="group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-md py-4 text-left text-base font-medium [&::-webkit-details-marker]:hidden">
            {item.q}
            <ChevronDown
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <p className="pb-5 text-[0.95rem] leading-relaxed text-muted-foreground">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
