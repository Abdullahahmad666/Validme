import type { Metadata } from "next";
import { ComingSoon } from "@/components/marketing/PageShell";
import { pageMetadata } from "@/lib/seo";
import { PageJsonLd } from "@/components/marketing/PageJsonLd";

export const metadata: Metadata = pageMetadata("feedback");

export default function FeedbackPage() {
  return (
    <>
      <PageJsonLd page="feedback" />
      <ComingSoon title="Feedback" body="An in-app way to tell us what to improve is on the way. Until then, the Contact page lists how to reach us." />
    </>
  );
}
