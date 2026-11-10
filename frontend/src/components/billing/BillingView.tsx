"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Coins, Lock, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fmtDate } from "@/components/evidence/EvidenceCard";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe, meKey } from "@/hooks/useSession";
import { track } from "@/lib/analytics";
import { cn, safeHref } from "@/lib/utils";
import { DEPTHS } from "@/lib/wizard";
import { api, ApiError } from "@/services/api";

function PurchaseReturn() {
  const qc = useQueryClient();
  const [polls, setPolls] = useState(0);
  // The payment provider confirms by webhook, usually within seconds: refresh the balance for ~30 s.
  useEffect(() => {
    if (polls >= 10) return;
    const t = window.setTimeout(() => {
      qc.invalidateQueries({ queryKey: meKey });
      qc.invalidateQueries({ queryKey: ["billing"] });
      setPolls((n) => n + 1);
    }, 3000);
    return () => window.clearTimeout(t);
  }, [polls, qc]);
  return (
    <p role="status" className="flex items-start gap-2 rounded-control border border-success/40 bg-success/5 p-3 text-sm">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-text" aria-hidden />
      Thanks! Your credits appear here as soon as the payment provider confirms the payment, usually within a minute.
    </p>
  );
}

function Packs() {
  const packs = useQuery({ queryKey: ["billing", "packs"], queryFn: api.billingPacks });
  const [busy, setBusy] = useState<string | null>(null);
  const checkout = useMutation({
    mutationFn: (pack: string) => api.startCheckout(pack),
    onMutate: (pack) => {
      setBusy(pack);
      track("checkout_clicked", { pack });
    },
    onSuccess: ({ url }) => {
      const href = safeHref(url);
      if (href?.startsWith("https://")) window.location.assign(href);
    },
    onSettled: () => setBusy(null),
  });

  if (packs.isPending) return <Skeleton className="h-40" />;
  if (packs.isError) return <ErrorState title="Couldn't load credit packs" onRetry={() => packs.refetch()} />;
  const { limits } = packs.data;

  return (
    <section aria-labelledby="packs-h" className="rounded-card border border-border bg-card p-5">
      <h2 id="packs-h" className="flex items-center gap-2 font-semibold">
        <ShoppingCart className="size-4 text-primary" aria-hidden /> Credit packs
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        One-off packs, no subscription. Credits don&apos;t expire. Payments are handled by Lemon Squeezy, our merchant of
        record, which also takes care of sales tax.
      </p>

      {!packs.data.payments_available ? (
        <p className="mt-4 rounded-control border border-dashed border-border p-4 text-sm text-muted-foreground">
          Buying credits opens at launch. Until then you can run the Quick research your free credit covers.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {packs.data.packs.map((p) => (
            <li key={p.id} className="flex flex-col gap-3 rounded-control border border-border p-4">
              <p className="text-2xl font-semibold tabular-nums">
                {p.credits} <span className="text-base font-normal text-muted-foreground">credits</span>
              </p>
              <p className="text-sm text-muted-foreground">{p.price ?? "Price shown at checkout"}</p>
              <Button onClick={() => checkout.mutate(p.id)} disabled={checkout.isPending} className="mt-auto">
                {busy === p.id ? "Opening checkout…" : "Buy"}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {checkout.isError && (
        <p role="alert" className="mt-3 text-sm text-destructive-text">
          {checkout.error instanceof ApiError ? checkout.error.message : "Couldn't open checkout. Please try again."}
        </p>
      )}

      <h3 className="mt-6 text-sm font-medium">What credits buy</h3>
      <ul className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
        {DEPTHS.map((d) => {
          const locked = !limits.depths.includes(d.value);
          return (
            <li key={d.value} className={cn("rounded-control border border-border p-3", locked && "bg-muted/40")}>
              <p className="flex items-center gap-1.5 font-medium">
                {locked && <Lock className="size-3.5 text-muted-foreground" aria-hidden />}
                {d.label} research
              </p>
              <p className="text-muted-foreground">
                {d.credits} credit{d.credits === 1 ? "" : "s"}
                {locked ? " · unlocked by any credit pack" : ""}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Research that can&apos;t search any source is refunded automatically. Limits: {limits.max_running} research job
        {limits.max_running === 1 ? "" : "s"} at a time, {limits.daily_launches} per day.
      </p>
    </section>
  );
}

function Usage() {
  const [page, setPage] = useState(1);
  const usage = useQuery({ queryKey: ["billing", "usage", page], queryFn: () => api.usage(page), placeholderData: keepPreviousData });
  return (
    <section aria-labelledby="usage-h" className="rounded-card border border-border bg-card p-5">
      <h2 id="usage-h" className="font-semibold">
        Usage history
      </h2>
      {usage.isPending ? (
        <Skeleton className="mt-4 h-24" />
      ) : usage.isError ? (
        <ErrorState title="Couldn't load your usage" onRetry={() => usage.refetch()} />
      ) : usage.data.results.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No credit changes yet.</p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-border">
            {usage.data.results.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{u.label}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {fmtDate(u.created_at)}
                    {u.project && (
                      <>
                        {" · "}
                        <Link href={`/projects/${u.project.id}/progress`} className="hover:underline">
                          {u.project.name}
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <span className={cn("shrink-0 font-semibold tabular-nums", u.credits > 0 ? "text-success-text" : "text-foreground")}>
                  {u.credits > 0 ? `+${u.credits}` : u.credits}
                </span>
              </li>
            ))}
          </ul>
          {(usage.data.previous || usage.data.next) && (
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" disabled={!usage.data.previous} onClick={() => setPage((p) => p - 1)}>
                Newer
              </Button>
              <Button variant="outline" size="sm" disabled={!usage.data.next} onClick={() => setPage((p) => p + 1)}>
                Older
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function BillingView() {
  const params = useSearchParams();
  const me = useMe();
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Credits & usage</h1>
        <p className="mt-1 text-muted-foreground">Your balance, credit packs and every credit change.</p>
      </header>
      {params.get("checkout") === "success" && <PurchaseReturn />}
      <section className="flex flex-wrap items-center gap-6 rounded-card border border-border bg-card p-5" aria-label="Balance">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-primary/10">
            <Coins className="size-5 text-primary" aria-hidden />
          </span>
          <div>
            <p className="text-sm text-muted-foreground">Balance</p>
            <p className="text-2xl font-semibold tabular-nums">
              {me.data ? `${me.data.credits} credit${me.data.credits === 1 ? "" : "s"}` : "—"}
            </p>
          </div>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Plan</p>
          <p className="font-semibold">{me.data ? (me.data.plan === "paid" ? "Credit packs" : "Free") : "—"}</p>
        </div>
      </section>
      <Packs />
      <Usage />
    </div>
  );
}
