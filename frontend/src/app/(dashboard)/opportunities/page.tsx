import type { Metadata } from "next";
import { OpportunitiesView } from "@/components/projects/OpportunitiesView";

export const metadata: Metadata = { title: "Opportunities" };

export default function OpportunitiesPage() {
  return <OpportunitiesView />;
}
