"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * False on the server and during hydration, true afterwards. Use it to hold back client-only data (e.g. a query that
 * may already be cached when a Suspense boundary hydrates late) so the first client render matches the server HTML.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
