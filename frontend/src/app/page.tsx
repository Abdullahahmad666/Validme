import Link from "next/link";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6">
      <p className="text-sm font-medium text-primary">{BRAND_NAME}</p>
      <h1 className="text-4xl font-semibold tracking-tight">Discover demand. Find the gap. Build what sells.</h1>
      <p className="text-lg text-muted-foreground">{BRAND_TAGLINE}</p>
      <div className="flex gap-3">
        <Link
          href="/research/new"
          className="rounded-control bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Validate an idea
        </Link>
        <Link href="/dashboard" className="rounded-control border border-border bg-card px-4 py-2.5 text-sm font-medium">
          Open dashboard
        </Link>
      </div>
    </main>
  );
}
