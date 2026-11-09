import type { Metadata } from "next";
import { Suspense } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { MobileNav } from "@/components/layout/MobileNav";

// The signed-in app is private: keep it out of search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        {/* Nav reads the URL for its active state; Suspense keeps dynamic routes prerenderable. */}
        <Suspense fallback={<div className="hidden w-16 shrink-0 border-r border-border bg-card md:block lg:w-[250px]" />}>
          <AppSidebar />
        </Suspense>
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-24 pt-6 sm:px-6 md:pb-8 lg:px-8">{children}</main>
        </div>
        <Suspense>
          <MobileNav />
        </Suspense>
      </div>
    </AuthGuard>
  );
}
