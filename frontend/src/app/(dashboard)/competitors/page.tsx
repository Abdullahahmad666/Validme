import type { Metadata } from "next";
import { CompetitorFeed } from "@/components/monitoring/CompetitorFeed";

export const metadata: Metadata = { title: "Competitors" };

export default function CompetitorsPage() {
  return <CompetitorFeed />;
}
