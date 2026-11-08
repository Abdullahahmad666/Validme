import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/ComingSoon";

export const metadata: Metadata = { title: "Opportunities" };

export default function OpportunitiesPage() {
  return <ComingSoon title="Opportunities" body="Opportunity scores and the evidence behind them, once your first research report is ready." />;
}
