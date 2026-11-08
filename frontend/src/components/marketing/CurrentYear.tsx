"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * Current year, resolved in the browser so static marketing pages stay fully prerenderable
 * (Cache Components disallows reading the clock while prerendering).
 */
export function CurrentYear() {
  const year = useSyncExternalStore(
    noop,
    () => new Date().getFullYear(),
    () => null,
  );
  return <>{year}</>;
}
