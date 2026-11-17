import type { Metadata } from "next";
import { CustomersPicker } from "@/components/distribution/CustomersPicker";

export const metadata: Metadata = { title: "Audience & distribution" };

export default function DistributionPage() {
  return <CustomersPicker />;
}
