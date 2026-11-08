import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthSplit } from "@/components/auth/AuthSplit";
import { VerifyEmail } from "@/components/auth/VerifyEmail";

export const metadata: Metadata = { title: "Confirm email", robots: { index: false, follow: false } };

export default function VerifyEmailPage() {
  return (
    <AuthSplit mode="verify">
      <Suspense>
        <VerifyEmail />
      </Suspense>
    </AuthSplit>
  );
}
