import type { Metadata } from "next";
import { Suspense } from "react";
import { PageEditor } from "@/components/lab/PageEditor";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Edit test page" };

async function Editor({ params }: { params: Promise<{ id: string; pageId: string }> }) {
  const { id, pageId } = await params;
  return <PageEditor projectId={id} pageId={Number(pageId)} />;
}

// Route params are request data under Cache Components: read inside Suspense.
export default function EditLabPage({ params }: { params: Promise<{ id: string; pageId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96" aria-busy="true" />}>
      <Editor params={params} />
    </Suspense>
  );
}
