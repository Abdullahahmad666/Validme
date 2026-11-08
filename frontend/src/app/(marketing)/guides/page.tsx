import type { Metadata } from "next";
import { ComingSoon } from "@/components/marketing/PageShell";
import { pageMetadata } from "@/lib/seo";
import { PageJsonLd } from "@/components/marketing/PageJsonLd";

export const metadata: Metadata = pageMetadata("guides");

export default function StartupguidesPage() {
  return (
    <>
      <PageJsonLd page="guides" />
      <ComingSoon title="Startup guides" body="Step-by-step guides for running customer interviews, reading demand signals and sizing a market. In progress." />
    </>
  );
}
