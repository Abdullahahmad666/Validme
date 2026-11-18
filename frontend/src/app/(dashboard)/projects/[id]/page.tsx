import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectOverview } from "@/components/projects/ProjectOverview";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Project" };

async function Overview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectOverview projectId={id} />;
}

// Route params are request data under Cache Components: read inside Suspense.
export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96" aria-busy="true" />}>
      <Overview params={params} />
    </Suspense>
  );
}
