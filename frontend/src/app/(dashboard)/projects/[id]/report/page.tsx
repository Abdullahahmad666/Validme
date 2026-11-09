import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportView } from "@/components/report/ReportView";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Opportunity report" };

async function Report({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReportView projectId={id} />;
}

// Route params and ?tab are request data under Cache Components: read inside Suspense.
export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96" aria-busy="true" />}>
      <Report params={params} />
    </Suspense>
  );
}
