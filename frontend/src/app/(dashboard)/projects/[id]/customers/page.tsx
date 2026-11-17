import type { Metadata } from "next";
import { Suspense } from "react";
import { CustomersView } from "@/components/distribution/CustomersView";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Where to find your customers" };

async function Customers({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomersView projectId={id} />;
}

// Route params are request data under Cache Components: read inside Suspense.
export default function CustomersPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96" aria-busy="true" />}>
      <Customers params={params} />
    </Suspense>
  );
}
