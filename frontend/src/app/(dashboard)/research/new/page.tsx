import type { Metadata } from "next";

export const metadata: Metadata = { title: "New research" };

const STEPS = ["Describe your idea", "Define your market", "Configure research", "Review and launch"];

// Week 2: build the 4-step wizard per docs/design/screens.md (use the /new-screen skill).
export default function NewResearchPage() {
  return (
    <div className="grid gap-8 lg:grid-cols-[230px_minmax(0,700px)]">
      <ol className="flex gap-2 overflow-x-auto lg:flex-col" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={i === 0 ? "step" : undefined}
            className={`whitespace-nowrap rounded-control px-3 py-2 text-sm ${
              i === 0 ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground"
            }`}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>
      <section className="rounded-card border border-border bg-card p-6">
        <p className="text-xs font-medium text-muted-foreground">Step 1 of 4</p>
        <h1 className="mt-1 text-xl font-semibold">Let&apos;s understand your idea.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tell us what you&apos;re thinking of building. It doesn&apos;t need to be perfectly defined.
        </p>
      </section>
    </div>
  );
}
