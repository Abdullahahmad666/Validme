import type { Metadata } from "next";
import { ComingSoon } from "@/components/marketing/PageShell";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Blog",
  description: "Notes on validating ideas and finding early customers. Coming soon.",
  path: "/blog",
  noindex: true,
});

export default function BlogPage() {
  return <ComingSoon title="Blog" body="Notes on validating ideas, finding early customers and building with evidence. The first posts are being written." />;
}
