import type { Metadata } from "next";
import { Suspense } from "react";
import { UnsubscribedMessage } from "@/components/settings/UnsubscribedMessage";

// Reached from an email link that carries a token: never indexed, and the URL is never sent on as a referrer.
export const metadata: Metadata = {
  title: "Email preferences",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function UnsubscribedPage() {
  return (
    <Suspense>
      <UnsubscribedMessage />
    </Suspense>
  );
}
