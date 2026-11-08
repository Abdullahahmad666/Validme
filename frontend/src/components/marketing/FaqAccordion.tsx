"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

/** Radix accordion: keyboard accessible (Tab, Enter/Space, Arrow keys, Home/End). */
export function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  return (
    <Accordion type="single" collapsible className="rounded-2xl border border-border bg-background px-5 sm:px-6">
      {items.map((item, i) => (
        <AccordionItem key={item.q} value={`faq-${i}`} className="border-border">
          <AccordionTrigger className="min-h-14 py-4 text-left text-base font-medium hover:no-underline">
            {item.q}
          </AccordionTrigger>
          <AccordionContent className="pb-5 text-[0.95rem] leading-relaxed text-muted-foreground">{item.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
