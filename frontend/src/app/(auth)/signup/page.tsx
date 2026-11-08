import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthSplit } from "@/components/auth/AuthSplit";
import { PageJsonLd } from "@/components/marketing/PageJsonLd";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata("signup");

export default function SignupPage() {
  return (
    <AuthSplit mode="signup">
      <PageJsonLd page="signup" />
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </AuthSplit>
  );
}
