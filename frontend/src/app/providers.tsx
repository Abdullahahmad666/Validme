"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { installFirstPartyAnalytics } from "@/lib/analytics";
import { api, ApiError } from "@/services/api";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            // Don't retry auth/permission/validation errors; do retry flaky network once.
            retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 1,
          },
        },
      }),
  );
  // Best effort: an analytics failure never surfaces to the user.
  useEffect(() => installFirstPartyAnalytics((body) => void api.sendEvent(body).catch(() => {})), []);
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
