"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Coins, ExternalLink, Lock, ShoppingCart, Sparkles } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fmtDate } from "@/components/evidence/EvidenceCard";
import { ErrorState } from "@/components/shared/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PACK_PLAN, PLAN_PRICES, usd, watchesLabel, yearlySavingMonths, type Interval } from "@/content/pricing";
import { useMe, meKey } from "@/hooks/useSession";
import { track } from "@/lib/analytics";
import { cn, safeHref } from "@/lib/utils";
import { DEPTHS } from "@/lib/wizard";
import { api, ApiError } from "@/services/api";
import type { Plan, SubscriptionInfo, SubscriptionPlan } from "@/types/api";

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
      Thanks! Your plan and credits appear here as soon as the payment provider confirms the payment, usually within a minute.
    </p>
  );
}

const PLAN_NAMES: Record<Plan, string> = { free: "Free", paid: "Credit packs", founder: "Founder", pro: "Pro" };

export function planLabel(plan: Plan | undefined): string {
  return plan ? PLAN_NAMES[plan] : "—";
}

/** One line describing where a subscription stands (dates come from the payment provider). */
export function subscriptionLine(sub: SubscriptionInfo): string {
  const every = sub.interval === "year" ? "yearly" : "monthly";
  if (sub.status === "cancelled") return sub.ends_at ? `Cancelled. Your plan stays active until ${fmtDate(sub.ends_at)}.` : "Cancelled.";
  if (sub.status === "past_due") return "Your last payment didn't go through. Update your card to keep the plan.";
  if (sub.status === "on_trial") return sub.renews_at ? `Trial, billed ${every} from ${fmtDate(sub.renews_at)}.` : "Trial.";
  return sub.renews_at ? `Billed ${every}. Renews on ${fmtDate(sub.renews_at)}.` : `Billed ${every}.`;
}

/** The provider's own price label wins; the catalog price is shown only until payments are live. */
export function planPrice(id: "founder" | "pro", interval: Interval, live?: SubscriptionPlan): string {
  const label = live?.[interval];
  if (label) return `${label}/${interval}`;
  const n = PLAN_PRICES[id][interval];
  return n == null ? "Price shown at checkout" : `${usd(n)}/${interval}`;
}

function openExternal(url: string) {
  const href = safeHref(url);
  if (href?.startsWith("https://")) window.location.assign(href);
}

function Plans() {
  const data = useQuery({ queryKey: ["billing", "packs"], queryFn: api.billingPacks });
  const [interval, setBillingInterval] = useState<Interval>("month");
  const [busy, setBusy] = useState<string | null>(null);
  const subscribe = useMutation({
    mutationFn: (plan: "founder" | "pro") => api.subscribe(plan, interval),
    onMutate: (plan) => {
      setBusy(plan);
      track("checkout_clicked", { plan, interval });
    },
    onSuccess: ({ url }) => openExternal(url),
    onSettled: () => setBusy(null),
  });
  const portal = useMutation({
    mutationFn: api.billingPortal,
    onMutate: () => setBusy("portal"),
    onSuccess: ({ url }) => openExternal(url),
    onSettled: () => setBusy(null),
  });

  if (data.isPending) return <Skeleton className="h-72" />;
  if (data.isError) return <ErrorState title="Couldn't load plans and credit packs" onRetry={() => data.refetch()} />;
  const { limits, subscription: sub, subscriptions_available: open } = data.data;
  const live = Object.fromEntries(data.data.plans.map((p) => [p.id, p])) as Partial<Record<"founder" | "pro", SubscriptionPlan>>;
  const error = subscribe.error ?? portal.error;

  return (
    <section aria-labelledby="plans-h" className="rounded-card border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="plans-h" className="flex items-center gap-2 font-semibold">
            <Sparkles className="size-4 text-primary" aria-hidden /> Plans
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Monthly research credits plus daily competitor monitoring. Cancel any time; you keep the plan until the end
            of the period you&apos;ve paid for.
          </p>
        </div>
        <div role="group" aria-label="Billing period" className="inline-flex rounded-control border border-border p-0.5 text-sm">
          {(["month", "year"] as const).map((i) => (
            <button
              key={i}
              type="button"
              aria-pressed={interval === i}
              onClick={() => setBillingInterval(i)}
              className={cn(
                "rounded-[calc(var(--radius-control)_-_2px)] px-3 py-1.5 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                interval === i ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {i === "month" ? "Monthly" : `Yearly · ${yearlySavingMonths(PLAN_PRICES.founder)} months free`}
            </button>
          ))}
        </div>
      </div>

      {sub && (
        <div
          className={cn(
            "mt-4 flex flex-wrap items-center justify-between gap-3 rounded-control border p-3 text-sm",
            sub.status === "past_due" ? "border-warning/50 bg-warning/5" : "border-border bg-muted/40",
          )}
        >
          <p>
            <span className="font-medium">{planLabel(sub.plan)} plan.</span> {subscriptionLine(sub)}
          </p>
          <Button variant="outline" size="sm" onClick={() => portal.mutate()} disabled={portal.isPending}>
            {busy === "portal" ? "Opening…" : "Manage subscription"}
            <ExternalLink className="size-3.5" aria-hidden />
          </Button>
        </div>
      )}

      {limits.plan === "paid" && (
        <p className="mt-4 rounded-control border border-border bg-muted/40 p-3 text-sm">
          <span className="font-medium">Credit packs.</span> All research depths, {PACK_PLAN.watches} competitor pages
          checked weekly, {PACK_PLAN.maxRunning} research jobs at once. A plan adds monthly credits and daily checks.
        </p>
      )}

      <ul className="mt-4 grid gap-3 md:grid-cols-3">
        {(["free", "founder", "pro"] as const).map((id) => {
          const p = PLAN_PRICES[id];
          const current = limits.plan === id;
          const credits = id === "free" ? 0 : (live[id]?.monthly_credits ?? p.monthlyCredits);
          return (
            <li
              key={id}
              className={cn("flex flex-col gap-3 rounded-control border p-4", current ? "border-primary" : "border-border")}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">{p.name}</h3>
                {current && <Badge variant="secondary">Current plan</Badge>}
              </div>
              <p className="text-xl font-semibold tabular-nums">{id === "free" ? "$0" : planPrice(id, interval, live[id])}</p>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>{id === "free" ? "Quick research only" : `${credits} research credits a month, all depths`}</li>
                <li>
                  {watchesLabel(p.watches)}, checked {p.dailyChecks ? "daily" : "weekly"}
                </li>
                <li>Up to {p.aiSummariesPerDay} AI change summaries a day</li>
                <li>Weekly digest email</li>
              </ul>
              {id !== "free" && (
                <div className="mt-auto">
                  {current ? null : sub ? (
                    <Button variant="outline" className="w-full" onClick={() => portal.mutate()} disabled={portal.isPending}>
                      Switch in billing portal
                    </Button>
                  ) : open ? (
                    <Button className="w-full" onClick={() => subscribe.mutate(id)} disabled={subscribe.isPending}>
                      {busy === id ? "Opening checkout…" : `Choose ${p.name}`}
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">Opens at launch.</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive-text">
          {error instanceof ApiError ? error.message : "Couldn't reach the payment provider. Please try again."}
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Prices in US dollars; any sales tax or VAT is calculated at checkout by Lemon Squeezy, our merchant of record.
      </p>
    </section>
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
  if (packs.isError) return null; // the Plans section above already shows the error and a retry
  const { limits } = packs.data;

  return (
    <section aria-labelledby="packs-h" className="rounded-card border border-border bg-card p-5">
      <h2 id="packs-h" className="flex items-center gap-2 font-semibold">
        <ShoppingCart className="size-4 text-primary" aria-hidden /> Credit packs
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        One-off packs if you&apos;d rather not subscribe. Credits don&apos;t expire, and any pack unlocks Standard and Deep
        research.
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
                {locked ? " · unlocked by a plan or any credit pack" : ""}
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
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Plan & credits</h1>
        <p className="mt-1 text-muted-foreground">Your plan, balance, credit packs and every credit change.</p>
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
          <p className="font-semibold">{planLabel(me.data?.plan)}</p>
        </div>
      </section>
      <Plans />
      <Packs />
      <Usage />
    </div>
  );
}
