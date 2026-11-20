import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fromInternal, Select, toInternal } from "@/components/ui/select";

const OPTS = [
  { value: "", label: "All sources" },
  { value: "web", label: "Web" },
];

describe("Select", () => {
  it("round-trips an empty option value, which Radix can't hold directly", () => {
    const internal = toInternal("", OPTS);
    expect(internal).not.toBe("");
    expect(fromInternal(internal)).toBe("");
    expect(toInternal(null, OPTS)).toBe(internal);
    expect(toInternal(3, OPTS)).toBe("3");
    // Without an empty option, an empty value means "nothing chosen" so the placeholder shows.
    expect(toInternal("", [{ value: "a", label: "A" }])).toBe("");
  });

  it("renders a labelled combobox trigger showing the chosen option, the placeholder, or disabled", () => {
    const chosen = renderToStaticMarkup(createElement(Select, { id: "src", value: "web", onValueChange: () => {}, options: OPTS }));
    expect(chosen).toMatch(/<button[^>]*role="combobox"/);
    expect(chosen).toContain('id="src"');
    expect(chosen).toContain("Web");
    const empty = renderToStaticMarkup(
      createElement(Select, { value: "", onValueChange: () => {}, options: [{ value: "a", label: "A" }], placeholder: "Choose…", "aria-label": "Stage" }),
    );
    expect(empty).toContain("Choose…");
    expect(empty).toContain('aria-label="Stage"');
    const off = renderToStaticMarkup(createElement(Select, { value: "web", onValueChange: () => {}, options: OPTS, disabled: true }));
    expect(off).toMatch(/<button[^>]*disabled=""/);
  });
});
