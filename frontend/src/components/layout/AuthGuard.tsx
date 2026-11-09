"use client";

import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { BrandLink, LogoMark } from "@/components/shared/BrandLogo";
import { ErrorState } from "@/components/shared/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/useSession";

/**
 * Client-side gate for the app shell. The API enforces auth itself; this only handles UX.
 * Children are always rendered (hidden until the session is confirmed) so the route stays
 * prerenderable for instant navigation and page queries start in parallel with the session check.
 */
/** Reads the URL, so it lives in its own Suspense boundary to keep dynamic routes prerenderable. */
function RedirectToLogin() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [pathname, router]);
  return null;
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data, isPending, isError, refetch } = useSession();
  const anonymous = data !== undefined && !data.isAuthenticated;
  const authenticated = data?.isAuthenticated === true;

  return (
    <>
      {anonymous && (
        <Suspense>
          <RedirectToLogin />
        </Suspense>
      )}
      {isError ? (
        <div className="mx-auto flex max-w-lg flex-col gap-6 p-8">
          <BrandLink href="/" />
          <ErrorState
            title="We couldn't load your workspace"
            body="The service didn't respond. Please try again in a moment."
            onRetry={() => refetch()}
          />
        </div>
      ) : (
        (isPending || anonymous) && (
          // Same shape as the app shell, with the brand in place, so loading doesn't flash a blank frame.
          <div className="flex min-h-screen" aria-busy="true" aria-label="Loading your workspace">
            <div className="hidden w-16 shrink-0 flex-col gap-6 border-r border-border bg-card px-2 py-5 md:flex lg:w-[250px] lg:px-3">
              <div className="flex justify-center lg:justify-start lg:px-3">
                <LogoMark />
              </div>
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
            <div className="flex flex-1 flex-col">
              <div className="flex h-16 items-center border-b border-border bg-card px-4 md:hidden">
                <LogoMark />
              </div>
              <div className="flex flex-col gap-4 p-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-28 w-full" />
              </div>
            </div>
          </div>
        )
      )}
      <div hidden={!authenticated}>{children}</div>
    </>
  );
}
