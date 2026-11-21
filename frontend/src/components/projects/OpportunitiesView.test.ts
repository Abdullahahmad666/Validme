import { describe, expect, it } from "vitest";
import { rankOpportunities } from "@/components/projects/OpportunitiesView";
import type { Project } from "@/types/api";

const p = (name: string, status: string, score: number | null) =>
  ({ id: name, name, status, progress: { score, confidence: "medium", recommendation: null, stages: [], job_status: "COMPLETED" } }) as unknown as Project;

describe("rankOpportunities", () => {
  it("ranks completed ideas by score, unscored last (never as 0), drafts left out", () => {
    const out = rankOpportunities([p("B", "COMPLETED", 61), p("Draft", "DRAFT", null), p("A", "COMPLETED", 82), p("C", "COMPLETED", null)]);
    expect(out.map((x) => x.name)).toEqual(["A", "B", "C"]);
  });
});
