import { BRAND_NAME } from "@/lib/brand";
import type { Block } from "@/types/lab";

/**
 * A close approximation of the public page (which the server renders on its own origin). Text is React-escaped; there
 * are no links in founder content. The form is inert here: the real one only exists on the published page.
 */
/** The live form's consent wording, before the server's own template arrives (same text as lab-consent-v2). */
export const FALLBACK_CONSENT =
  "I'd like to hear about this product. The person behind this page can see and download my email to tell me about it. " +
  `${BRAND_NAME} stores it encrypted, never sells it, and deletes its copy after {days} days or sooner if I ask.`;

export function consentText(template: string | undefined, days: number): string {
  return (template || FALLBACK_CONSENT).replaceAll("{days}", String(days));
}

export function PagePreview({ blocks, retentionDays, consentTemplate }: { blocks: Block[]; retentionDays: number; consentTemplate?: string }) {
  return (
    <div className="rounded-card border border-border bg-background p-5 text-sm" aria-label="Page preview">
      {blocks.length === 0 && <p className="text-muted-foreground">Add blocks to see the page.</p>}
      {blocks.map((b, i) => {
        switch (b.type) {
          case "hero":
            return (
              <section key={i} className="mb-6">
                <p className="text-2xl font-bold leading-tight">{b.headline}</p>
                {b.subheadline && <p className="mt-2 whitespace-pre-line text-muted-foreground">{b.subheadline}</p>}
                <span className="mt-3 inline-block rounded-control bg-primary px-4 py-2 font-semibold text-primary-foreground">
                  {b.cta_label || "Join the waitlist"}
                </span>
              </section>
            );
          case "problem":
            return (
              <section key={i} className="mb-6">
                {b.heading && <p className="mb-1 text-lg font-semibold">{b.heading}</p>}
                <p className="whitespace-pre-line text-muted-foreground">{b.body}</p>
              </section>
            );
          case "benefits":
            return (
              <section key={i} className="mb-6">
                {b.heading && <p className="mb-2 text-lg font-semibold">{b.heading}</p>}
                <ul className="grid gap-2 sm:grid-cols-2">
                  {b.items.map((it, j) => (
                    <li key={j} className="rounded-control border border-border bg-card p-3">
                      <p className="font-semibold">{it.title}</p>
                      {it.body && <p className="text-muted-foreground">{it.body}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            );
          case "pricing":
            return (
              <section key={i} className="mb-6">
                <p className="mb-2 text-lg font-semibold">{b.heading || "Pricing we're considering"}</p>
                {b.test_variants && b.test_variants.length > 0 && (
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Price test: each visitor sees one of {b.test_variants.length + 1} variants, with a &ldquo;Choose&rdquo; button on each
                    price. Showing variant A.
                  </p>
                )}
                <ul className="grid gap-2 sm:grid-cols-3">
                  {b.items.map((it, j) => (
                    <li key={j} className="rounded-control border border-border bg-card p-3">
                      <p className="font-semibold">{it.name}</p>
                      <p className="text-xl font-bold">
                        {it.price} <span className="text-xs font-normal text-muted-foreground">{it.period}</span>
                      </p>
                      {it.features && it.features.length > 0 && (
                        <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                          {it.features.filter(Boolean).map((f, k) => (
                            <li key={k}>{f}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 border-l-2 border-primary pl-2 text-xs">
                  Not available yet: these are prices being tested, and nothing is charged. Join the waitlist to hear if it launches.
                </p>
              </section>
            );
          case "faq":
            return (
              <section key={i} className="mb-6">
                <p className="mb-2 text-lg font-semibold">{b.heading || "Questions"}</p>
                {b.items.map((it, j) => (
                  <div key={j} className="mb-2 rounded-control border border-border bg-card p-3">
                    <p className="font-semibold">{it.q}</p>
                    <p className="whitespace-pre-line text-muted-foreground">{it.a}</p>
                  </div>
                ))}
              </section>
            );
          case "waitlist":
            return (
              <section key={i} className="mb-6 rounded-control border border-border bg-card p-4">
                <p className="text-lg font-semibold">{b.heading || "Join the waitlist"}</p>
                {b.body && <p className="text-muted-foreground">{b.body}</p>}
                <div className="mt-2 rounded-control border border-border bg-background px-3 py-2 text-muted-foreground">Email address</div>
                <p className="mt-2 text-xs text-muted-foreground">☐ {consentText(consentTemplate, retentionDays)}</p>
                <span className="mt-2 inline-block rounded-control bg-primary px-4 py-2 font-semibold text-primary-foreground">
                  {b.button || "Join the waitlist"}
                </span>
              </section>
            );
        }
      })}
      <p className="border-t border-border pt-3 text-xs text-muted-foreground">
        Footer added to every page: this is an early test page by an independent founder; the product may not exist yet.
      </p>
    </div>
  );
}
