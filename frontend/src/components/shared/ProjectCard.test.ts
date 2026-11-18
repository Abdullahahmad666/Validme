import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProjectCard } from "@/components/shared/ProjectCard";
import type { Project } from "@/types/api";

const base = {
  id: "p1",
  name: "Stock app",
  description: "Stock counting",
  updated_at: "2026-11-01T00:00:00Z",
} as unknown as Project;

describe("ProjectCard", () => {
  it("links to the project overview and shows stages with their state in words", () => {
    const p = {
      ...base,
      status: "RESEARCHING",
      progress: { job_status: "RUNNING", stages: [{ name: "web_research", status: "COMPLETED" }, { name: "report", status: "PROCESSING" }], score: null, confidence: null, recommendation: null },
    } as Project;
    const out = renderToStaticMarkup(createElement(ProjectCard, { project: p }));
    expect(out).toContain('href="/projects/p1"');
    expect(out).toContain("Web research<span class=\"sr-only\">: done</span>");
    expect(out).toContain("Opportunity report<span class=\"sr-only\">: running</span>");
    expect(out).not.toContain("/100");
  });

  it("shows the score only for completed projects, always with its confidence", () => {
    const p = { ...base, status: "COMPLETED", progress: { job_status: "COMPLETED", stages: [], score: 64, confidence: "low", recommendation: "research_more" } } as Project;
    const out = renderToStaticMarkup(createElement(ProjectCard, { project: p }));
    expect(out).toContain("64/100");
    expect(out).toContain("low confidence");
    expect(out).toContain("Research more");
  });
});
