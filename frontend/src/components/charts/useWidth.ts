"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The measured element's current width (ResizeObserver); null until measured. A callback ref, so it keeps working
 * when the element mounts later or is replaced (e.g. a chart that first renders an empty state).
 */
export function useWidth<T extends HTMLElement>() {
  const [width, setWidth] = useState<number | null>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    observer.current = ro;
  }, []);
  useEffect(() => () => observer.current?.disconnect(), []);
  return [ref, width] as const;
}
