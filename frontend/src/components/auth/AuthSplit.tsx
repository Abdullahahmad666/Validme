import { AuthShowcase, TRUST_POINTS, type AuthShowcaseMode } from "@/components/auth/AuthShowcase";

/**
 * Two-column auth layout: form on the left, animated product preview on the right (lg+).
 * Below lg the preview collapses to a short trust strip so the form stays first and fast.
 */
export function AuthSplit({ mode, children }: { mode: AuthShowcaseMode; children: React.ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-[1400px] flex-1 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <section className="flex items-center justify-center px-4 py-12 sm:px-6 lg:py-16">
        <div className="w-full max-w-[400px]">
          {children}
          <ul className="mt-10 space-y-2.5 border-t border-border pt-6 text-sm text-muted-foreground lg:hidden">
            {TRUST_POINTS.map((t) => (
              <li key={t.text} className="flex items-center gap-2">
                <t.icon className="size-4 shrink-0 text-primary" aria-hidden />
                {t.text}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <aside aria-label="Product preview" className="hidden p-4 lg:block lg:py-6 lg:pr-6">
        <AuthShowcase mode={mode} />
      </aside>
    </div>
  );
}
