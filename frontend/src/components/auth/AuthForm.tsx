"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { fieldA11y, FormField } from "@/components/auth/FormField";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sessionKey, useSession } from "@/hooks/useSession";
import { track } from "@/lib/analytics";
import { safeNext } from "@/lib/safe-next";
import { loginSchema, signupSchema, type LoginForm } from "@/lib/validation";
import { auth, AuthError } from "@/services/auth";
import type { Session } from "@/types/auth";

const COPY = {
  login: {
    title: "Log in",
    submit: "Log in",
    switchText: "New here?",
    switchLabel: "Create an account",
    switchHref: "/signup",
  },
  signup: {
    title: "Create your account",
    submit: "Create account",
    switchText: "Already have an account?",
    switchLabel: "Log in",
    switchHref: "/login",
  },
} as const;

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const copy = COPY[mode];
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const qc = useQueryClient();
  const { data: session } = useSession();
  const [formError, setFormError] = useState<string | null>(
    params.get("error") === "social" ? "Google sign-in didn't complete. Please try again." : null,
  );
  const [pendingVerification, setPendingVerification] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(mode === "login" ? loginSchema : signupSchema),
    defaultValues: { email: "", password: "" },
  });
  const { errors, isSubmitting } = form.formState;

  // Already signed in (e.g. back button after login) → go straight to the app.
  useEffect(() => {
    if (session?.isAuthenticated) router.replace(next);
  }, [session, next, router]);

  async function onSubmit(values: LoginForm) {
    setFormError(null);
    if (mode === "signup") track("signup_started", { method: "email" });
    try {
      const result: Session =
        mode === "login" ? await auth.login(values.email, values.password) : await auth.signup(values.email, values.password);
      qc.setQueryData(sessionKey, result);
      if (result.isAuthenticated) {
        if (mode === "signup") {
          track("signup_completed", { method: "email" });
          toast.info("Confirm your email to unlock your free report", {
            description: `We sent a link to ${values.email}.`,
          });
        }
        router.replace(next);
      } else if (result.pendingFlow === "verify_email") {
        if (mode === "signup") track("signup_completed", { method: "email", verification: "pending" });
        setPendingVerification(true);
      } else {
        setFormError("We couldn't sign you in. Please try again.");
      }
    } catch (err) {
      if (err instanceof AuthError) {
        const fields = err.fieldErrors();
        for (const name of ["email", "password"] as const) {
          if (fields[name]) form.setError(name, { message: fields[name] });
        }
        if (!fields.email && !fields.password) setFormError(err.message);
      } else {
        setFormError("We couldn't reach the server. Check your connection and try again.");
      }
    }
  }

  if (pendingVerification) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Check your inbox</h1>
        <p className="text-sm text-muted-foreground">
          We sent a verification link to <strong className="text-foreground">{form.getValues("email")}</strong>. Open it
          to finish signing in.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="mt-2 text-muted-foreground">
          {mode === "signup"
            ? "Your first Quick report is free once you verify your email. No card required."
            : "Welcome back. Pick up your research where you left off."}
        </p>
      </div>

      <GoogleButton next={next} mode={mode} />

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        <FormField id="email" label="Email" error={errors.email?.message}>
          <Input
            type="email"
            autoComplete="email"
            className="h-11"
            {...fieldA11y("email", errors.email?.message)}
            {...form.register("email")}
          />
        </FormField>
        <FormField
          id="password"
          label="Password"
          error={errors.password?.message}
          hint={mode === "signup" ? "At least 8 characters." : undefined}
        >
          <Input
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="h-11"
            {...fieldA11y("password", errors.password?.message, mode === "signup")}
            {...form.register("password")}
          />
        </FormField>
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          {copy.submit}
        </Button>
        {mode === "signup" && (
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            By creating an account you agree to the{" "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              Privacy policy
            </Link>
            .
          </p>
        )}
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {copy.switchText}{" "}
        <Link
          href={next === "/dashboard" ? copy.switchHref : `${copy.switchHref}?next=${encodeURIComponent(next)}`}
          className="font-medium text-primary hover:underline"
        >
          {copy.switchLabel}
        </Link>
      </p>
    </div>
  );
}
