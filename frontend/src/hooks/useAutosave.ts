"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { projectKey } from "@/hooks/useResearch";
import { api } from "@/services/api";
import type { Project, ProjectPatch } from "@/types/api";

export type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 800;

/**
 * Debounced autosave for the wizard (docs/design/screens.md): 800ms after the last change,
 * PATCH whatever `buildPatch` returns. `flush()` saves immediately (used on step change).
 * Warns before leaving the page while a save is pending or failed.
 */
export function useAutosave(projectId: string | null, buildPatch: () => ProjectPatch, deps: unknown[]) {
  const qc = useQueryClient();
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<void> | null>(null);
  const build = useRef(buildPatch);

  useEffect(() => {
    build.current = buildPatch;
  });

  const save = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!projectId) return;
    const patch = build.current();
    if (Object.keys(patch).length === 0) {
      setState((s) => (s === "pending" ? "saved" : s));
      return;
    }
    setState("saving");
    const run = api
      .updateProject(projectId, patch)
      .then((project) => {
        qc.setQueryData<Project>(projectKey(projectId), project);
        setState("saved");
      })
      .catch(() => setState("error"));
    inflight.current = run;
    await run;
  }, [projectId, qc]);

  // Debounce on every change of the watched values.
  useEffect(() => {
    if (!projectId) return;
    if (Object.keys(build.current()).length === 0) return;
    setState("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are the watched form values
  }, [projectId, save, ...deps]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (state !== "pending" && state !== "saving" && state !== "error") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [state]);

  const flush = useCallback(async () => {
    await save();
    if (inflight.current) await inflight.current;
  }, [save]);

  return { state, flush, retry: save };
}
