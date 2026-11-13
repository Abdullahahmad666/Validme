"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { ErrorState } from "@/components/shared/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/services/api";
import type { EmailPreferences as Prefs } from "@/types/api";

const KEY = ["email", "preferences"];

export function EmailPreferences() {
  const qc = useQueryClient();
  const prefs = useQuery({ queryKey: KEY, queryFn: api.emailPreferences });
  const save = useMutation({
    mutationFn: (weekly_digest: boolean) => api.updateEmailPreferences({ weekly_digest }),
    onSuccess: (data) => qc.setQueryData<Prefs>(KEY, data),
  });

  return (
    <section id="email" aria-labelledby="email-h" className="scroll-mt-20 rounded-card border border-border bg-card p-5">
      <h2 id="email-h" className="flex items-center gap-2 font-semibold">
        <Mail className="size-4 text-primary" aria-hidden /> Email
      </h2>
      {prefs.isPending ? (
        <Skeleton className="mt-4 h-16" />
      ) : prefs.isError ? (
        <ErrorState title="Couldn't load your email settings" onRetry={() => prefs.refetch()} />
      ) : (
        <>
          <div className="mt-4 flex items-start justify-between gap-4">
            <div>
              <p id="digest-label" className="font-medium">
                Weekly digest
              </p>
              <p id="digest-desc" className="text-sm text-muted-foreground">
                Monday morning: the competitor changes that matter and possible new competitors, each linked to its
                evidence. Nothing is sent in a quiet week. Goes to {prefs.data.email || "your account email"}.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs.data.weekly_digest}
              aria-labelledby="digest-label"
              aria-describedby="digest-desc"
              aria-disabled={save.isPending}
              onClick={() => {
                if (!save.isPending) save.mutate(!prefs.data.weekly_digest); // keeps focus while saving
              }}
              className={cn(
                "relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-disabled:opacity-60",
                prefs.data.weekly_digest ? "border-primary bg-primary" : "border-muted-strong bg-input",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "inline-block size-4 rounded-full bg-background shadow transition-transform",
                  prefs.data.weekly_digest ? "translate-x-5" : "translate-x-0.5",
                )}
              />
            </button>
          </div>
          {prefs.data.bounced && (
            <p role="status" className="mt-3 rounded-control bg-warning/10 p-3 text-sm text-warning-text">
              Our last email to this address bounced, so the digest was paused. Check the address, then turn the digest
              back on.
            </p>
          )}
          {save.isError && (
            <p role="alert" className="mt-3 text-sm text-destructive-text">
              {save.error instanceof ApiError ? save.error.message : "Couldn't save. Please try again."}
            </p>
          )}
        </>
      )}
    </section>
  );
}
