import type { Metadata } from "next";
import { Suspense } from "react";
import { EvidenceExplorer } from "@/components/evidence/EvidenceExplorer";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Evidence explorer" };

export default function EvidencePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" aria-busy="true" />}>
      <EvidenceExplorer />
    </Suspense>
  );
}
