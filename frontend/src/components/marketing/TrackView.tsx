"use client";

import { useEffect, useRef } from "react";
import { track, type AnalyticsEvent, type AnalyticsProps } from "@/lib/analytics";

/** Fires an analytics event once: on mount, or when the wrapped area first scrolls into view. */
export function TrackView({
  event,
  props,
  onView = false,
  children,
}: {
  event: AnalyticsEvent;
  props?: AnalyticsProps;
  onView?: boolean;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fired = useRef(false);
  const propsKey = JSON.stringify(props ?? {});

  useEffect(() => {
    const fire = () => {
      if (fired.current) return;
      fired.current = true;
      track(event, JSON.parse(propsKey));
    };
    if (!onView || !ref.current) {
      fire();
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          fire();
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [event, onView, propsKey]);

  return children ? <div ref={ref}>{children}</div> : null;
}
