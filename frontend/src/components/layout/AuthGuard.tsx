"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ErrorState } from "@/components/shared/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/useSession";

/**
 * Client-side gate for the app shell. The API enforces auth itself; this only handles UX.
 * Children are always rendered (hidden until the session is confirmed) so the route stays
 * prerenderable for instant navigation and page queries start in parallel with the session check.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data, isPending, isError, refetch } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const anonymous = data !== undefined && !data.isAuthenticated;
  const authenticated = data?.isAuthenticated === true;

  useEffect(() => {
    if (anonymous) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [anonymous, pathname, router]);

  return (
    <>
      {isError ? (
        <div className="mx-auto max-w-lg p-8">
          <ErrorState
            title="We couldn't reach the server"
            body="Check that the backend is running, then try again."
            onRetry={() => refetch()}
          />
        </div>
      ) : (
        (isPending || anonymous) && (
          <div className="flex min-h-screen" aria-busy="true" aria-label="Loading your workspace">
            <Skeleton className="hidden w-16 shrink-0 rounded-none md:block lg:w-[250px]" />
            <div className="flex flex-1 flex-col gap-4 p-6">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-28 w-full" />
            </div>
          </div>
        )
      )}
      <div hidden={!authenticated}>{children}</div>
    </>
  );
}
