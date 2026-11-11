import type { Metadata } from "next";
import { Suspense } from "react";
import { CompareView } from "@/components/projects/CompareView";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Compare ideas" };

// Reads ?ids= (request data under Cache Components): keep it inside Suspense.
export default function ComparePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" aria-busy="true" />}>
      <CompareView />
    </Suspense>
  );
}
