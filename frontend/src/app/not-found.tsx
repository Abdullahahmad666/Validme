import type { Metadata } from "next";
import Link from "next/link";
import { StatusScreen } from "@/components/shared/StatusScreen";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <StatusScreen code="404" title="Page not found" body="The page you're looking for doesn't exist or has moved.">
      <Button asChild>
        <Link href="/">Go to the homepage</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/dashboard">Open your dashboard</Link>
      </Button>
    </StatusScreen>
  );
}
