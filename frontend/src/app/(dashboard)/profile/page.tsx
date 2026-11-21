import type { Metadata } from "next";
import Link from "next/link";
import { ProfileView } from "@/components/settings/ProfileView";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Profile</h1>
        <p className="mt-1 text-muted-foreground">
          Your details, password and plan. Email preferences and API keys are in{" "}
          <Link href="/settings" className="font-medium text-primary underline-offset-4 hover:underline">
            Settings
          </Link>
          .
        </p>
      </header>
      <ProfileView />
    </div>
  );
}
