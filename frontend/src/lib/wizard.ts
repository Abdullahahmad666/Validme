import { z } from "zod";
import { ideaSchema } from "@/lib/validation";
import type {
  AISuggestedField,
  BusinessStage,
  CompetitorAspect,
  Depth,
  Project,
  ProjectPatch,
  QueryIntent,
  StageName,
} from "@/types/api";

// Limits must match docs/design/screens.md and backend/projects/serializers.py.

export const STEPS = [
  { n: 1, title: "Describe your idea", short: "Idea" },
  { n: 2, title: "Define your market", short: "Market" },
  { n: 3, title: "Configure research", short: "Research" },
  { n: 4, title: "Review and launch", short: "Launch" },
] as const;
export type StepNumber = 1 | 2 | 3 | 4;

export const BUSINESS_STAGES: { value: BusinessStage; label: string }[] = [
  { value: "idea", label: "Just an idea" },
  { value: "mvp", label: "Building an MVP" },
  { value: "launched", label: "Launched" },
  { value: "existing", label: "Existing business" },
];

export const INTENTS: { value: QueryIntent; label: string; hint: string }[] = [
  { value: "problem_discovery", label: "Problem discovery", hint: "How people describe the pain in their own words." },
  { value: "buying_intent", label: "Buying intent", hint: "People asking for tools, alternatives or recommendations." },
  { value: "competitor_gaps", label: "Competitor gaps", hint: "Complaints about and comparisons of existing tools." },
  { value: "customer_acquisition", label: "Customer acquisition", hint: "Where these customers gather and what they read." },
];

export const DEPTHS: { value: Depth; label: string; credits: number; body: string; recommended?: boolean }[] = [
  { value: "quick", label: "Quick", credits: 1, body: "A fast read on demand and the obvious competitors." },
  { value: "standard", label: "Standard", credits: 2, body: "More queries and sources. Best for most ideas.", recommended: true },
  { value: "deep", label: "Deep", credits: 4, body: "The widest search budget, for ideas you're close to committing to." },
];

export const COMPETITOR_ASPECTS: { value: CompetitorAspect; label: string }[] = [
  { value: "features", label: "Features" },
  { value: "pricing", label: "Pricing" },
  { value: "audience", label: "Audience" },
  { value: "positioning", label: "Positioning" },
  { value: "complaints", label: "Complaints" },
  { value: "gaps", label: "Gaps" },
];

export const STAGE_LABELS: Record<StageName, string> = {
  idea_analysis: "Idea analysis",
  web_research: "Web research",
  community_research: "Community research",
  evidence_analysis: "Evidence analysis",
  competitor_analysis: "Competitor analysis",
  report: "Opportunity report",
};

export const SOURCE_GROUPS: { stage: StageName; title: string }[] = [
  { stage: "web_research", title: "Web & search" },
  { stage: "community_research", title: "Community" },
  { stage: "competitor_analysis", title: "Competitor pages" },
];

export const COMMON_GEOGRAPHIES = [
  "Worldwide",
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "European Union",
  "Germany",
  "France",
  "India",
  "Pakistan",
  "United Arab Emirates",
  "Singapore",
  "Brazil",
];

const httpUrl = z.url({ protocol: /^https?$/, error: "Use a full http:// or https:// URL." }).max(500);

export const stepSchemas = {
  1: ideaSchema,
  2: z.object({
    industry: z.string().trim().max(120, "Keep it under 120 characters."),
    customer_type: z.enum(["B2B", "B2C", "B2B2C", ""]),
    audiences: z
      .array(z.string().trim().min(1).max(120))
      .min(1, "Add at least one audience segment.")
      .max(10, "Up to 10 segments."),
    geographies: z.array(z.string().trim().min(1).max(80)).max(20, "Up to 20 regions."),
    business_stage: z.enum(["idea", "mvp", "launched", "existing", ""]),
    current_alternatives: z.string().max(1000, "Keep it under 1,000 characters."),
    price_hypothesis: z.string().max(120, "Keep it under 120 characters."),
  }),
  3: z.object({
    sources: z.array(z.string()).min(1, "Pick at least one source."),
    depth: z.enum(["quick", "standard", "deep"]),
    competitor_discovery: z.boolean(),
    competitor_urls: z.array(httpUrl).max(10, "Up to 10 competitor URLs."),
    evidence_urls: z.array(httpUrl).max(10, "Up to 10 links."),
    competitor_aspects: z.array(z.enum(["features", "pricing", "audience", "positioning", "complaints", "gaps"])),
    exclude_terms: z.array(z.string().trim().min(1).max(40)).max(20, "Up to 20 excluded terms."),
  }),
} as const;

/** Fields a step owns, so autosave only sends what that step edits. */
export const STEP_FIELDS = {
  1: ["name", "description", "objectives", "existing_product_url", "additional_context"],
  2: ["industry", "customer_type", "audiences", "geographies", "business_stage", "current_alternatives", "price_hypothesis"],
  3: ["sources", "depth", "competitor_discovery", "competitor_urls", "evidence_urls", "competitor_aspects", "exclude_terms"],
} as const;

const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Build the autosave PATCH: fields that changed since the last save AND are individually valid.
 * Half-typed invalid values (a 2-character name) are simply not sent yet, instead of failing the save.
 */
export function autosavePatch<S extends 1 | 2 | 3>(
  step: S,
  values: Record<string, unknown>,
  saved: Partial<Record<string, unknown>>,
): ProjectPatch {
  const shape = stepSchemas[step].shape as Record<string, z.ZodType>;
  const patch: Record<string, unknown> = {};
  for (const field of STEP_FIELDS[step]) {
    const value = values[field];
    if (value === undefined || equal(value, saved[field])) continue;
    if (shape[field] && !shape[field].safeParse(value).success) continue;
    patch[field] = value;
  }
  return patch as ProjectPatch;
}

/** Editing a field the AI suggested makes it the founder's own: drop the "AI suggested" badge. */
export function withoutAiFlags(current: AISuggestedField[], edited: string[]): AISuggestedField[] {
  return current.filter((f) => !edited.includes(f));
}

/** First step that still needs input, used to resume a draft. */
export function resumeStep(project: Project): StepNumber {
  if (!stepSchemas[1].safeParse(project).success) return 1;
  if (!stepSchemas[2].safeParse(project).success) return 2;
  return 3;
}

/**
 * Idempotency key for launching research on a project. Stored per project so a double-click,
 * retry or page refresh re-sends the same key and the backend charges credits only once.
 */
export function launchKey(projectId: string, storage: Pick<Storage, "getItem" | "setItem"> | null): string {
  const slot = `validme:launch:${projectId}`;
  try {
    const existing = storage?.getItem(slot);
    if (existing) return existing;
  } catch {
    // storage unavailable (private mode); fall through to a fresh key
  }
  const key = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${projectId}-${Date.now()}`;
  try {
    storage?.setItem(slot, key);
  } catch {
    // best effort
  }
  return key;
}

export function normaliseChip(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
