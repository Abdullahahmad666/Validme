"use client";

import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Mail, MailX } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api } from "@/services/api";

/**
 * Landing page for the digest's unsubscribe link. Opening the link changes nothing (mail scanners open links);
 * the founder confirms here, which POSTs the signed token. Email clients' one-click button POSTs directly.
 */
export function UnsubscribedMessage() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const confirm = useMutation({ mutationFn: () => api.unsubscribe(token) });
  const done = confirm.isSuccess;
  const failed = params.get("error") === "1" || confirm.isError || (!token && !done);

  const icon = done ? (
    <CheckCircle2 className="size-6 text-success-text" aria-hidden />
  ) : failed ? (
    <MailX className="size-6 text-muted-foreground" aria-hidden />
  ) : (
    <Mail className="size-6 text-primary" aria-hidden />
  );
  const title = done ? "You're unsubscribed" : failed ? "That link didn't work" : "Stop the weekly digest?";
  const body = done
    ? "You won't get the weekly digest any more. Changes still show up on your monitoring page and in the notification bell."
    : failed
      ? "The unsubscribe link is invalid or incomplete. You can turn the weekly digest off in Settings instead."
      : "You'll stop getting the Monday email about competitor changes and possible new competitors.";

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <span className={`flex size-12 items-center justify-center rounded-full ${done ? "bg-success/10" : "bg-primary/10"}`}>{icon}</span>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground" role={done || confirm.isError ? "status" : undefined}>
        {body}
      </p>
      {!done && !failed && (
        <Button onClick={() => confirm.mutate()} disabled={confirm.isPending}>
          {confirm.isPending ? "Unsubscribing…" : "Unsubscribe"}
        </Button>
      )}
      <p className="text-sm text-muted-foreground">
        {done ? "Changed your mind? " : ""}
        <Link href="/settings#email" className="font-medium text-primary underline">
          Manage email settings
        </Link>
      </p>
    </div>
  );
}
