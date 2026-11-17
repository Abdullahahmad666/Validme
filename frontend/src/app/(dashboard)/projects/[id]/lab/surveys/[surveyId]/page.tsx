import type { Metadata } from "next";
import { Suspense } from "react";
import { SurveyEditor } from "@/components/lab/SurveyEditor";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Edit survey" };

async function Editor({ params }: { params: Promise<{ id: string; surveyId: string }> }) {
  const { id, surveyId } = await params;
  return <SurveyEditor projectId={id} surveyId={Number(surveyId)} />;
}

// Route params are request data under Cache Components: read inside Suspense.
export default function EditLabSurvey({ params }: { params: Promise<{ id: string; surveyId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96" aria-busy="true" />}>
      <Editor params={params} />
    </Suspense>
  );
}
