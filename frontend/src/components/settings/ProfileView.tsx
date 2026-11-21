"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Coins, CreditCard, KeyRound, LogOut, Mail, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { fieldA11y, FormField } from "@/components/auth/FormField";
import { planLabel } from "@/components/billing/BillingView";
import { fmtDate } from "@/components/evidence/EvidenceCard";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useHydrated } from "@/hooks/useHydrated";
import { meKey, sessionKey, useLogout, useMe, useSession } from "@/hooks/useSession";
import { api, ApiError } from "@/services/api";
import { auth, AuthError } from "@/services/auth";
import type { Me } from "@/types/api";

function Card({ id, icon: Icon, title, body, children }: { id: string; icon: typeof UserRound; title: string; body?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-card border border-border bg-card p-5 sm:p-6">
      <h2 id={id} className="flex items-center gap-2 font-semibold">
        <Icon className="size-4 text-primary" aria-hidden />
        {title}
      </h2>
      {body && <p className="mt-1 text-sm text-muted-foreground">{body}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function initials(first: string, last: string, email: string) {
  const s = `${first.trim()[0] ?? ""}${last.trim()[0] ?? ""}`;
  return (s || email[0] || "?").toUpperCase();
}

function Details() {
  const me = useMe();
  if (me.isPending) return <Skeleton className="h-64" />;
  if (me.isError) return <ErrorState title="Couldn't load your profile" onRetry={() => me.refetch()} />;
  // Keyed on the saved name so the form starts from the server's values (and again after a save).
  return <DetailsForm key={`${me.data.first_name}|${me.data.last_name}`} m={me.data} />;
}

function DetailsForm({ m }: { m: Me }) {
  const qc = useQueryClient();
  const [first, setFirst] = useState(m.first_name);
  const [last, setLast] = useState(m.last_name);
  const save = useMutation({
    mutationFn: () => api.updateMe({ first_name: first.trim(), last_name: last.trim() }),
    onSuccess: (data) => {
      qc.setQueryData(meKey, data);
      toast.success("Profile saved.");
    },
  });
  const dirty = first.trim() !== m.first_name || last.trim() !== m.last_name;
  const fieldErrors: Record<string, string> =
    save.error instanceof ApiError && save.error.details
      ? Object.fromEntries(Object.entries(save.error.details).map(([k, v]) => [k, Array.isArray(v) ? String(v[0]) : String(v)]))
      : {};

  return (
    <Card id="profile-h" icon={UserRound} title="Your details">
      <div className="mb-5 flex items-center gap-4">
        <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
          {initials(m.first_name, m.last_name, m.email)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium">{[m.first_name, m.last_name].filter(Boolean).join(" ") || "Add your name"}</p>
          <p className="truncate text-sm text-muted-foreground">Member since {fmtDate(m.date_joined)}</p>
        </div>
      </div>
      <form
        noValidate
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty) save.mutate();
        }}
      >
        <FormField id="first_name" label="First name" optional error={fieldErrors.first_name}>
          <Input className="h-11" maxLength={150} autoComplete="given-name" value={first} onChange={(e) => setFirst(e.target.value)} {...fieldA11y("first_name", fieldErrors.first_name)} />
        </FormField>
        <FormField id="last_name" label="Last name" optional error={fieldErrors.last_name}>
          <Input className="h-11" maxLength={150} autoComplete="family-name" value={last} onChange={(e) => setLast(e.target.value)} {...fieldA11y("last_name", fieldErrors.last_name)} />
        </FormField>
        <div className="sm:col-span-2">
          <FormField id="email" label="Email" hint="Your sign-in email. It can't be changed here yet; contact us if you need it changed.">
            <div className="flex h-11 items-center gap-2 rounded-lg border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
              <Mail className="size-4" aria-hidden />
              <span id="email" className="truncate">
                {m.email}
              </span>
            </div>
          </FormField>
        </div>
        {save.isError && !Object.keys(fieldErrors).length && (
          <p role="alert" className="text-sm text-destructive-text sm:col-span-2">
            {save.error instanceof ApiError ? save.error.message : "Couldn't save. Please try again."}
          </p>
        )}
        <div className="sm:col-span-2">
          <Button type="submit" className="min-h-11" disabled={!dirty || save.isPending}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Password() {
  const session = useSession();
  const qc = useQueryClient();
  const hasPassword = session.data?.isAuthenticated ? session.data.user.has_usable_password : true;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const change = useMutation({
    mutationFn: () => auth.changePassword(next, hasPassword ? current : undefined),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setConfirm("");
      qc.invalidateQueries({ queryKey: sessionKey });
      toast.success(hasPassword ? "Password changed." : "Password set. You can now also log in with your email.");
    },
  });
  const errs = change.error instanceof AuthError ? change.error.fieldErrors() : {};
  const general = change.error && !errs.current_password && !errs.new_password ? (change.error as Error).message : null;

  return (
    <Card
      id="password-h"
      icon={KeyRound}
      title={hasPassword ? "Change password" : "Set a password"}
      body={hasPassword ? undefined : "You signed up with Google. Add a password to also log in with your email."}
    >
      <form
        noValidate
        className="grid gap-4 sm:max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (next !== confirm) {
            setMismatch(true);
            return;
          }
          setMismatch(false);
          change.mutate();
        }}
      >
        {hasPassword && (
          <FormField id="current_password" label="Current password" required error={errs.current_password}>
            <Input type="password" className="h-11" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} {...fieldA11y("current_password", errs.current_password)} />
          </FormField>
        )}
        <FormField id="new_password" label="New password" required error={errs.new_password} hint="At least 8 characters; avoid common passwords.">
          <Input type="password" className="h-11" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} {...fieldA11y("new_password", errs.new_password, true)} />
        </FormField>
        <FormField id="confirm_password" label="Repeat new password" required error={mismatch ? "The two passwords don't match." : undefined}>
          <Input type="password" className="h-11" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} {...fieldA11y("confirm_password", mismatch ? "x" : undefined)} />
        </FormField>
        {general && (
          <p role="alert" className="text-sm text-destructive-text">
            {general}
          </p>
        )}
        <div>
          <Button type="submit" className="min-h-11" disabled={change.isPending || !next || (hasPassword && !current)}>
            {change.isPending ? "Saving…" : hasPassword ? "Change password" : "Set password"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PlanSummary() {
  const me = useMe();
  if (!me.data) return null;
  const m = me.data;
  return (
    <Card id="plan-h" icon={CreditCard} title="Plan & credits">
      <dl className="grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">Plan</dt>
          <dd className="mt-1 font-semibold">{planLabel(m.plan)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Research credits</dt>
          <dd className="mt-1 flex items-center gap-1.5 font-semibold tabular-nums">
            <Coins className="size-4 text-muted-foreground" aria-hidden />
            {m.credits}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Competitor pages watched</dt>
          <dd className="mt-1 font-semibold tabular-nums">
            {m.monitoring.used} of {m.monitoring.max_watches}
          </dd>
        </div>
      </dl>
      <Button asChild variant="outline" className="mt-4 min-h-11">
        <Link href="/billing">Manage plan and credits</Link>
      </Button>
    </Card>
  );
}

function SignOut() {
  const logout = useLogout();
  return (
    <section aria-labelledby="signout-h" className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-card p-5 sm:p-6">
      <div>
        <h2 id="signout-h" className="font-semibold">
          Log out
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Ends your session on this device.</p>
      </div>
      <Button variant="outline" className="min-h-11" onClick={() => logout.mutate()} disabled={logout.isPending}>
        <LogOut aria-hidden />
        {logout.isPending ? "Logging out…" : "Log out"}
      </Button>
    </section>
  );
}

/** The signed-in founder's profile: name, password, plan at a glance, log out. */
export function ProfileView() {
  // Account data may already be cached when this page hydrates; render it only after hydration so the first
  // client render matches the server's.
  const hydrated = useHydrated();
  if (!hydrated) return <Skeleton className="h-96" />;
  return (
    <div className="flex flex-col gap-6">
      <Details />
      <Password />
      <PlanSummary />
      <SignOut />
    </div>
  );
}
