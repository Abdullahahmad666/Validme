import type { Metadata } from "next";
import { Suspense } from "react";
import { BillingView } from "@/components/billing/BillingView";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Credits & usage" };

// Reads ?checkout= (request data under Cache Components): keep it inside Suspense.
export default function BillingPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" aria-busy="true" />}>
      <BillingView />
    </Suspense>
  );
}
