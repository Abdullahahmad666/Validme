import type { Metadata } from "next";
import { Suspense } from "react";
import { RadarView } from "@/components/radar/RadarView";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Opportunity Radar" };

async function Radar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RadarView projectId={id} />;
}

// Route params and ?signal= are request data under Cache Components: read inside Suspense.
export default function RadarPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96" aria-busy="true" />}>
      <Radar params={params} />
    </Suspense>
  );
}
