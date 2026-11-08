"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { sessionKey } from "@/hooks/useSession";
import { auth } from "@/services/auth";

export function VerifyEmail() {
  const { key } = useParams<{ key: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");

  // Explicit click (not on mount) so email scanners that pre-fetch links can't consume the key.
  async function confirm() {
    setState("busy");
    try {
      const session = await auth.verifyEmail(decodeURIComponent(key));
      qc.setQueryData(sessionKey, session);
      router.replace(session.isAuthenticated ? "/dashboard" : "/login");
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Confirm your email</h1>
      {state === "failed" ? (
        <p role="alert" className="text-sm text-destructive">
          This link is invalid or has expired. <Link href="/login" className="underline">Log in</Link> to request a new
          one.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">One click and you&apos;re in.</p>
      )}
      {state !== "failed" && (
        <Button size="lg" onClick={confirm} disabled={state === "busy"}>
          {state === "busy" && <Loader2 className="animate-spin" aria-hidden />}
          Confirm email
        </Button>
      )}
    </div>
  );
}
