import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/ComingSoon";

export const metadata: Metadata = { title: "Subscription & usage" };

export default function SubscriptionusagePage() {
  return <ComingSoon title="Subscription & usage" body="Credit packs, usage history and your remaining balance." />;
}
