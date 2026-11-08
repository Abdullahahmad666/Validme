import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/EmptyState";
import { MetricCard } from "@/components/shared/MetricCard";

export const metadata: Metadata = { title: "Overview" };

// Week 1: replace nulls with data from api.listProjects() via TanStack Query (see docs/roadmap.md).
export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Here&apos;s your market research overview.</p>
      </header>

      <section aria-label="Usage" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard label="Research projects" value={null} />
        <MetricCard label="Reports generated" value={null} />
        <MetricCard label="Evidence records" value={null} />
        <MetricCard label="Active research jobs" value={null} />
      </section>

      <section className="rounded-card border border-border bg-card p-6">
        <h2 className="text-base font-medium">Have a new idea?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Discover demand, analyze competitors and find your first customers.
        </p>
        <Link
          href="/research/new"
          className="mt-4 inline-block rounded-control bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          + New research
        </Link>
      </section>

      <EmptyState
        title="No research projects yet"
        body="Describe an idea, confirm your market, pick sources, and we'll collect evidence with a link to every source."
        actionHref="/research/new"
        actionLabel="Start your first research"
      />
    </div>
  );
}
