import type { Metadata } from "next";
import { Suspense } from "react";
import { ResearchWizard } from "@/components/research/ResearchWizard";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "New research" };

export default function NewResearchPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" aria-busy="true" />}>
      <ResearchWizard />
    </Suspense>
  );
}
