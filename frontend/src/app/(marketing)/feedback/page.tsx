import type { Metadata } from "next";
import { ComingSoon } from "@/components/marketing/PageShell";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Feedback",
  description: "Tell us what to improve. Coming soon.",
  path: "/feedback",
  noindex: true,
});

export default function FeedbackPage() {
  return <ComingSoon title="Feedback" body="An in-app way to tell us what to improve is on the way. Until then, the Contact page lists how to reach us." />;
}
