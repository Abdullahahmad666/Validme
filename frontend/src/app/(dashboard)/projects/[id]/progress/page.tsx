import type { Metadata } from "next";
import { Suspense } from "react";
import { ProgressView } from "@/components/research/ProgressView";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Research progress" };

async function Progress({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProgressView projectId={id} />;
}

// Route params are request data under Cache Components, so they're read inside Suspense.
export default function ProgressPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-72" aria-busy="true" />}>
      <Progress params={params} />
    </Suspense>
  );
}
