"use client";

import Link from "next/link";
import { StatusScreen } from "@/components/shared/StatusScreen";
import { Button } from "@/components/ui/button";

/** Unexpected rendering errors. Never shows the error message or stack: only the digest id for support. */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error && typeof error.digest === "string" ? error.digest : null;
  return (
    <StatusScreen
      code="Error"
      title="Something went wrong"
      body={`This page couldn't load. Try again, or go back to the homepage.${digest ? ` Reference: ${digest}` : ""}`}
    >
      <Button onClick={() => retry()}>Try again</Button>
      <Button asChild variant="outline">
        <Link href="/">Go to the homepage</Link>
      </Button>
    </StatusScreen>
  );
}
