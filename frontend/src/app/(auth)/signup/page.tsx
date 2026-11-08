import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthSplit } from "@/components/auth/AuthSplit";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <AuthSplit mode="signup">
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </AuthSplit>
  );
}
