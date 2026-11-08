"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

/** Profile + credit balance from the ValidMe API (credits never come from the auth service). */
export function useMe(enabled = true) {
  return useQuery({ queryKey: meKey, queryFn: api.me, enabled });
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
