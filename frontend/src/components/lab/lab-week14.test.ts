import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BlockFields } from "@/components/lab/BlockFields";
import { PagePreview } from "@/components/lab/PagePreview";
import { QuestionFields } from "@/components/lab/QuestionFields";
import { SampleWarning } from "@/components/lab/SampleWarning";
import { SurveyPreview } from "@/components/lab/SurveyEditor";
import { changeType, comparisonText, copyVariant, emptyQuestion, nextQuestionId, pct, structureOf, variantsOf, withVariants } from "@/lib/lab";
import type { Block, PricingBlock, Question } from "@/types/lab";

const pricing: PricingBlock = { type: "pricing", items: [{ name: "Basic", price: "$9", period: "/month", features: ["One"] }] };

describe("price test helpers", () => {
  it("keep A in items and B/C in test_variants, dropping the field when there are none", () => {
    expect(variantsOf(pricing)).toHaveLength(1);
    const withB = withVariants(pricing, [pricing.items, copyVariant(pricing.items)]);
    expect(withB.test_variants).toHaveLength(1);
    expect(withB.test_variants?.[0][0]).not.toBe(pricing.items[0]); // a copy, not the same object
    expect(withB.test_variants?.[0][0].features).not.toBe(pricing.items[0].features);
    expect("test_variants" in withVariants(withB, [withB.items])).toBe(false);
  });

  it("describe comparisons without claiming a winner the numbers don't support", () => {
    expect(comparisonText({ metric: "signups", a: "A", b: "B", verdict: "not_enough_data", z: null })).toContain("not enough views yet");
    expect(comparisonText({ metric: "clicks", a: "A", b: "B", verdict: "no_clear_difference", z: 0.4 })).toContain("no clear difference");
    expect(comparisonText({ metric: "signups", a: "A", b: "C", verdict: "b_higher", z: -2.5 })).toContain("C is clearly higher among the people you reached");
    expect(pct(null)).toBe("—");
    expect(pct(0.1234, 1)).toBe("12.3%");
  });
});

describe("survey helpers", () => {
  it("give each question a free id and keep it when the type changes", () => {
    const qs: Question[] = [emptyQuestion("single", "q1"), emptyQuestion("text", "q3")];
    expect(nextQuestionId(qs)).toBe("q2");
    const q = { ...emptyQuestion("single", "q4"), prompt: "How?", options: ["A", "B"], assumption_id: 7 };
    expect(changeType(q, "multi")).toMatchObject({ id: "q4", type: "multi", prompt: "How?", options: ["A", "B"], assumption_id: 7 });
    const scale = changeType(q, "scale");
    expect(scale.options).toBeUndefined();
    expect(scale.low_label).toBe("Not at all");
  });

  it("treat wording as editable and ids, types and options as structure (like the server)", () => {
    const q: Question = { id: "q1", type: "single", prompt: "How?", options: ["Paper", "App"] };
    expect(structureOf([{ ...q, prompt: "How exactly?" }])).toBe(structureOf([q]));
    expect(structureOf([{ ...q, options: ["Paper", "App", "Other"] }])).not.toBe(structureOf([q]));
    expect(structureOf([{ ...q, type: "multi" }])).not.toBe(structureOf([q]));
  });
});

describe("Week 14 components", () => {
  it("edit price variants inside the pricing block", () => {
    const block = withVariants(pricing, [pricing.items, copyVariant(pricing.items)]);
    const out = renderToStaticMarkup(createElement(BlockFields, { block, onChange: () => {} }));
    expect(out).toContain("Variant A");
    expect(out).toContain("Remove variant B");
    expect(out).toContain("Test another price (add variant C)");
  });

  it("say in the preview that visitors see one variant", () => {
    const blocks: Block[] = [withVariants(pricing, [pricing.items, copyVariant(pricing.items)])];
    expect(renderToStaticMarkup(createElement(PagePreview, { blocks, retentionDays: 90 }))).toContain("each visitor sees one of 2 variants");
  });

  it("escape survey text and show the consent text as given", () => {
    const draft = {
      title: "<b>x</b>",
      intro: "",
      slug: null,
      questions: [{ id: "q1", type: "single" as const, prompt: "<img src=x>", options: ["A", "B"], required: true }],
      ask_email: true,
      retention_days: 90,
    };
    const out = renderToStaticMarkup(createElement(SurveyPreview, { draft, consent: "I agree to share these answers." }));
    expect(out).not.toContain("<img src=x>");
    expect(out).toContain("&lt;img src=x&gt;");
    expect(out).toContain("I agree to share these answers.");
    expect(out).toContain("Email address (optional)");
  });

  it("lock the type and options once a survey has answers, but not the wording", () => {
    const q: Question = { id: "q1", type: "single", prompt: "How?", options: ["A", "B"] };
    const out = renderToStaticMarkup(createElement(QuestionFields, { question: q, onChange: () => {}, assumptions: [], locked: true }));
    expect(out).toMatch(/<select[^>]*disabled=""[^>]*>/);
    expect(out).not.toContain("Add an option");
    expect(out).toMatch(/<input[^>]*value="How\?"(?![^>]*disabled)[^>]*>/);
  });

  it("show the server's sample message with icon text, and nothing without data", () => {
    const warn = renderToStaticMarkup(createElement(SampleWarning, { sample: { n: 3, level: "too_small", margin: 0.56, message: "Only 3 answers" } }));
    expect(warn).toContain("Small sample: ");
    expect(warn).toContain("Only 3 answers");
    expect(renderToStaticMarkup(createElement(SampleWarning, { sample: { n: 0, level: "none", margin: null, message: "No answers yet." } }))).toBe("");
  });
});
