import type { Metadata } from "next";
import { Suspense } from "react";
import { MonitoringView } from "@/components/monitoring/MonitoringView";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Competitor monitoring" };

async function Monitoring({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MonitoringView projectId={id} />;
}

// Route params and ?change= are request data under Cache Components: read inside Suspense.
export default function MonitoringPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96" aria-busy="true" />}>
      <Monitoring params={params} />
    </Suspense>
  );
}
