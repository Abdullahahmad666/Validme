import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/ComingSoon";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return <ComingSoon title="Settings" body="Profile and API keys for the MCP server." />;
}
