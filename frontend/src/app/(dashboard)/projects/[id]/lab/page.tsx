import type { Metadata } from "next";
import { Suspense } from "react";
import { LabView } from "@/components/lab/LabView";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Validation Lab" };

async function Lab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LabView projectId={id} />;
}

// Route params are request data under Cache Components: read inside Suspense.
export default function LabPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96" aria-busy="true" />}>
      <Lab params={params} />
    </Suspense>
  );
}
