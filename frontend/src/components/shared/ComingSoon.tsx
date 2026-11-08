import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Placeholder for navigation targets that aren't built yet (keeps nav from 404ing). */
export function ComingSoon({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="rounded-card border border-dashed border-border bg-card p-8 text-center">
        <p className="font-medium">Coming soon</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{body}</p>
        <Button asChild variant="outline" size="lg" className="mt-4">
          <Link href="/dashboard">Back to overview</Link>
        </Button>
      </div>
    </div>
  );
}
