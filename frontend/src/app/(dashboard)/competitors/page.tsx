import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/ComingSoon";

export const metadata: Metadata = { title: "Competitors" };

export default function CompetitorsPage() {
  return <ComingSoon title="Competitors" body="Competitor profiles, pricing and gaps found during research." />;
}
