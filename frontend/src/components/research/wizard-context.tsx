"use client";

import { createContext, useContext } from "react";
import type { SaveState } from "@/hooks/useAutosave";
import type { StepNumber } from "@/lib/wizard";
import type { Project } from "@/types/api";

export type SaveHandle = { state: SaveState; flush: () => Promise<void>; retry: () => void };

export type WizardContextValue = {
  project: Project | null;
  step: StepNumber;
  /** Save the current step, then move to another step. */
  goTo: (step: StepNumber) => Promise<void>;
  /** Steps report their autosave state so the header can show it and step changes can flush it. */
  reportSave: (handle: SaveHandle) => void;
};

export const WizardContext = createContext<WizardContextValue | null>(null);

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard must be used inside <ResearchWizard>");
  return ctx;
}
