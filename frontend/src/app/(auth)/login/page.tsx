import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthSplit } from "@/components/auth/AuthSplit";
import { PageJsonLd } from "@/components/marketing/PageJsonLd";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata("login");

export default function LoginPage() {
  return (
    <AuthSplit mode="login">
      <PageJsonLd page="login" />
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </AuthSplit>
  );
}
