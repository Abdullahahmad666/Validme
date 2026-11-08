import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthSplit } from "@/components/auth/AuthSplit";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <AuthSplit mode="login">
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </AuthSplit>
  );
}
