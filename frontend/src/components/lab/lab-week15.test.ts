import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExperimentVerdict } from "@/components/lab/ExperimentVerdict";
import { PredictedActualView } from "@/components/lab/PredictedActual";
import { QuestionFields } from "@/components/lab/QuestionFields";
import { removeOption } from "@/lib/lab";
import type { Question } from "@/types/lab";
import type { ExperimentResult, PredictedActual } from "@/types/report";

const exp = (over: Partial<ExperimentResult>): ExperimentResult => ({
  dimension: "demand_evidence",
  trials: 120,
  successes: 18,
  label: "waitlist sign-ups",
  sources: [],
  counted: true,
  rate: 0.15,
  low: 0.0966,
  high: 0.225,
  score: 97,
  confidence: "medium",
  explanation: "",
  ...over,
});

const base: PredictedActual = {
  report: null,
  dimensions: [
    { key: "demand_evidence", label: "Demand", predicted: null, actual: null },
    { key: "willingness_to_pay", label: "Willingness to pay", predicted: null, actual: null },
  ],
  assumptions: [],
  live_pages: 0,
  live_surveys: 0,
  rules: "Scored from the lower end of the 95% range.",
};

describe("PredictedActualView", () => {
  it("says nothing is known yet instead of inventing numbers", () => {
    const out = renderToStaticMarkup(createElement(PredictedActualView, { data: base, projectId: "p1" }));
    expect(out).toContain("No report yet");
    expect(out).toContain("No result yet");
    expect(out).toContain("Once a test page or survey has been live");
    expect(out).not.toMatch(/\d+\/100/);
  });

  it("shows the prediction next to counted and too-small experiment results", () => {
    const data: PredictedActual = {
      ...base,
      report: { id: 1, created_at: "2026-11-01T00:00:00Z" },
      live_pages: 1,
      dimensions: [
        { key: "demand_evidence", label: "Demand", predicted: { score: 40, confidence: "medium", explanation: "" }, actual: exp({}) },
        {
          key: "willingness_to_pay",
          label: "Willingness to pay",
          predicted: { score: null, confidence: "low", explanation: "" },
          actual: exp({ counted: false, score: null, trials: 12, successes: 2, label: "“Choose” presses on a tested price" }),
        },
      ],
      assumptions: [
        { id: 1, text: "Owners count on paper", source: "founder", status: "supported", status_locked: false, auto_status: "supported", auto_basis: "", auto_refs: [] },
        { id: 2, text: "They pay for tools", source: "ai", status: "untested", status_locked: false, auto_status: "", auto_basis: "", auto_refs: [] },
      ],
    };
    const out = renderToStaticMarkup(createElement(PredictedActualView, { data, projectId: "p1" }));
    expect(out).toContain("40/100");
    expect(out).toContain("97/100");
    expect(out).toContain("18 waitlist sign-ups from 120 views (15.0%, at least 9.7%)");
    expect(out).toContain("Not scored");
    expect(out).toContain("too few to count yet");
    expect(out).toContain("(from your survey)");
    expect(out).toContain("1 assumption isn&#x27;t tested by a survey yet");
  });
});

describe("assumption verdicts", () => {
  it("render only when a survey judged the assumption, with the counts", () => {
    expect(renderToStaticMarkup(createElement(ExperimentVerdict, { a: { auto_status: "", auto_refs: [] } }))).toBe("");
    const ref = { survey_id: 1, survey_title: "S", question_id: "q1", prompt: "How?", n: 20, k: 18, low: 0.7, high: 0.97, verdict: "supported" as const, late_rule: false, basis: "18 of 20 gave a supporting answer." };
    const out = renderToStaticMarkup(createElement(ExperimentVerdict, { a: { auto_status: "supported", auto_refs: [ref] } }));
    expect(out).toContain("Supported by your survey");
    expect(out).toContain("18 of 20 gave a supporting answer.");
  });

  it("keep supporting answers pointing at the same options when one is removed", () => {
    const q: Question = { id: "q1", type: "single", prompt: "How?", options: ["Paper", "App", "Sheet"], support_options: [0, 2] };
    expect(removeOption(q, 1)).toMatchObject({ options: ["Paper", "Sheet"], support_options: [0, 1] });
    expect(removeOption(q, 0).support_options).toEqual([1]);
  });

  it("ask which answers support a linked assumption, and flag rules set after answers", () => {
    const q: Question = { id: "q1", type: "single", prompt: "How?", options: ["Paper", "App"], assumption_id: 3, support_options: [0] };
    const out = renderToStaticMarkup(createElement(QuestionFields, { question: q, onChange: () => {}, assumptions: [], locked: true }));
    expect(out).toContain("Which answers support the assumption?");
    expect(out).toContain("marked as chosen after seeing results");
    const unlinked = renderToStaticMarkup(createElement(QuestionFields, { question: { ...q, assumption_id: null }, onChange: () => {}, assumptions: [], locked: false }));
    expect(unlinked).not.toContain("Which answers support");
  });
});

describe("type changes keep the supporting-answer rule between choice types", () => {
  it("single ↔ multi keeps it; scale drops it", async () => {
    const { changeType } = await import("@/lib/lab");
    const q: Question = { id: "q1", type: "single", prompt: "How?", options: ["A", "B"], assumption_id: 1, support_options: [1] };
    expect(changeType(q, "multi").support_options).toEqual([1]);
    expect(changeType(q, "scale").support_options).toBeUndefined();
  });
});
