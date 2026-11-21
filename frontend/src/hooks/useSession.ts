"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHydrated } from "@/hooks/useHydrated";
import { auth } from "@/services/auth";
import { api } from "@/services/api";

export const sessionKey = ["auth", "session"] as const;
export const meKey = ["me"] as const;

export function useSession() {
  return useQuery({ queryKey: sessionKey, queryFn: auth.session, staleTime: 60_000, retry: 1 });
}

export function useAuthConfig() {
  return useQuery({ queryKey: ["auth", "config"], queryFn: auth.config, staleTime: Infinity });
}

/**
 * Profile + credit balance from the ValidMe API (credits never come from the auth service).
 *
 * The app shell fetches this early, so pages that hydrate later (inside Suspense) would find it already cached and
 * render content the server never rendered: a hydration mismatch. Until hydration finishes it reports "pending",
 * exactly like the server; afterwards (and on every client-side navigation) it's the real query.
 */
export function useMe(enabled = true) {
  const q = useQuery({ queryKey: meKey, queryFn: api.me, enabled });
  const hydrated = useHydrated();
  if (hydrated) return q;
  return { ...q, data: undefined, isPending: true, isSuccess: false, status: "pending" } as unknown as typeof q;
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: auth.logout,
    onSuccess: () => {
      qc.clear();
      qc.setQueryData(sessionKey, { isAuthenticated: false });
    },
  });
}
