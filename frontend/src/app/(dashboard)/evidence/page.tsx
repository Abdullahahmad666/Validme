import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/ComingSoon";

export const metadata: Metadata = { title: "Evidence explorer" };

export default function EvidenceexplorerPage() {
  return <ComingSoon title="Evidence explorer" body="Search and filter every evidence record collected for your projects, with a link to each source." />;
}
