import { describe, expect, it } from "vitest";
import { autosavePatch, launchKey, resumeStep, stepSchemas, withoutAiFlags } from "@/lib/wizard";
import type { Project } from "@/types/api";

const IDEA = "A tool that helps independent restaurants track inventory and reduce food waste.";

const base: Project = {
  id: "p1",
  name: "Restaurant inventory",
  status: "DRAFT",
  description: IDEA,
  objectives: ["validate_demand"],
  existing_product_url: "",
  additional_context: "",
  ai_interpretation: {},
  interpretation_confirmed: false,
  industry: "",
  customer_type: "",
  audiences: [],
  geographies: [],
  business_stage: "",
  current_alternatives: "",
  price_hypothesis: "",
  ai_suggested_fields: [],
  sources: [],
  depth: "standard",
  competitor_discovery: true,
  competitor_urls: [],
  evidence_urls: [],
  competitor_aspects: [],
  exclude_terms: [],
  created_at: "",
  updated_at: "",
};

describe("autosavePatch", () => {
  it("sends only changed fields", () => {
    expect(autosavePatch(1, { ...base, name: "Kitchen waste tracker" }, base)).toEqual({ name: "Kitchen waste tracker" });
    expect(autosavePatch(1, { ...base }, base)).toEqual({});
  });

  it("holds back half-typed invalid values instead of failing the save", () => {
    const patch = autosavePatch(1, { ...base, name: "Ki", additional_context: "Owners in Lahore" }, base);
    expect(patch).toEqual({ additional_context: "Owners in Lahore" });
  });

  it("only sends fields the step owns", () => {
    const patch = autosavePatch(3, { ...base, name: "ignored", depth: "deep", sources: ["hackernews"] }, base);
    expect(patch).toEqual({ depth: "deep", sources: ["hackernews"] });
  });

  it("rejects bad URLs in step 3 lists", () => {
    expect(autosavePatch(3, { ...base, competitor_urls: ["ftp://x.test"] }, base)).toEqual({});
  });
});

describe("step schemas mirror the backend", () => {
  it("step 2 needs at least one audience", () => {
    const v = { industry: "", customer_type: "" as const, audiences: [], geographies: [], business_stage: "" as const, current_alternatives: "", price_hypothesis: "" };
    expect(stepSchemas[2].safeParse(v).success).toBe(false);
    expect(stepSchemas[2].safeParse({ ...v, audiences: ["owners"] }).success).toBe(true);
  });

  it("step 3 caps URL lists at 10 and needs a source", () => {
    const v = { sources: ["web_search"], depth: "standard" as const, competitor_discovery: true, competitor_urls: [], evidence_urls: [], competitor_aspects: [], exclude_terms: [] };
    expect(stepSchemas[3].safeParse(v).success).toBe(true);
    expect(stepSchemas[3].safeParse({ ...v, sources: [] }).success).toBe(false);
    const eleven = Array.from({ length: 11 }, (_, i) => `https://a.test/${i}`);
    expect(stepSchemas[3].safeParse({ ...v, evidence_urls: eleven }).success).toBe(false);
  });
});

describe("resumeStep", () => {
  it("resumes at the first incomplete step", () => {
    expect(resumeStep({ ...base, name: "ab" })).toBe(1);
    expect(resumeStep(base)).toBe(2);
    expect(resumeStep({ ...base, audiences: ["owners"] })).toBe(3);
  });
});

describe("withoutAiFlags", () => {
  it("drops flags for fields the founder edited", () => {
    expect(withoutAiFlags(["industry", "audiences"], ["industry"])).toEqual(["audiences"]);
  });
});

describe("launchKey (no double charge)", () => {
  it("reuses the same key for the same project", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    const first = launchKey("p1", storage);
    expect(launchKey("p1", storage)).toBe(first);
    expect(launchKey("p2", storage)).not.toBe(first);
  });

  it("still works without storage", () => {
    expect(launchKey("p1", null)).toBeTruthy();
  });
});
