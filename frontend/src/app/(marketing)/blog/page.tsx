import type { Metadata } from "next";
import { ComingSoon } from "@/components/marketing/PageShell";
import { pageMetadata } from "@/lib/seo";
import { PageJsonLd } from "@/components/marketing/PageJsonLd";

export const metadata: Metadata = pageMetadata("blog");

export default function BlogPage() {
  return (
    <>
      <PageJsonLd page="blog" />
      <ComingSoon title="Blog" body="Notes on validating ideas, finding early customers and building with evidence. The first posts are being written." />
    </>
  );
}
