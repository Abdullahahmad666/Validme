import type { Metadata } from "next";
import { ComingSoon } from "@/components/marketing/PageShell";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Startup guides",
  description: "Step-by-step validation guides for founders. Coming soon.",
  path: "/guides",
  noindex: true,
});

export default function StartupguidesPage() {
  return <ComingSoon title="Startup guides" body="Step-by-step guides for running customer interviews, reading demand signals and sizing a market. In progress." />;
}
