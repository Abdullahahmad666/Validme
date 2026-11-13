import type { Metadata } from "next";
import { ApiKeys } from "@/components/settings/ApiKeys";
import { EmailPreferences } from "@/components/settings/EmailPreferences";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-muted-foreground">Email, API keys and the MCP server for Claude.</p>
      </header>
      <EmailPreferences />
      <ApiKeys />
    </div>
  );
}
