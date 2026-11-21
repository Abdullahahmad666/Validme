import { describe, expect, it } from "vitest";
import { matchSuggestions } from "@/components/shared/ChipsInput";
import { ALL_GEOGRAPHIES, COUNTRIES, REGIONS } from "@/lib/geographies";
import { COMMON_GEOGRAPHIES } from "@/lib/wizard";

describe("geography suggestions", () => {
  it("covers every country, not a short list", () => {
    expect(COUNTRIES.length).toBeGreaterThan(240);
    for (const c of ["Pakistan", "Nigeria", "Vietnam", "Kenya", "Ireland", "New Zealand", "Saudi Arabia"]) expect(COUNTRIES).toContain(c);
    expect(new Set(ALL_GEOGRAPHIES).size).toBe(ALL_GEOGRAPHIES.length);
    expect(REGIONS[0]).toBe("Worldwide");
  });

  it("puts names starting with the draft first, then other matches, and skips ones already added", () => {
    const m = matchSuggestions("ni", ALL_GEOGRAPHIES, ["Nigeria"]);
    expect(m[0].toLowerCase().startsWith("ni") || m[0].split(/\s/).some((w) => w.toLowerCase().startsWith("ni"))).toBe(true);
    expect(m).not.toContain("Nigeria");
    expect(m.length).toBeLessThanOrEqual(8);
    expect(matchSuggestions("kingdom", ALL_GEOGRAPHIES, [])).toContain("United Kingdom");
    // A name starting with the text beats one where only a later word does.
    const inMatches = matchSuggestions("in", ALL_GEOGRAPHIES, []);
    expect(inMatches.indexOf("India")).toBeLessThan(inMatches.indexOf("British Indian Ocean Territory") === -1 ? 99 : inMatches.indexOf("British Indian Ocean Territory"));
    expect(inMatches[0]).toBe("India");
  });

  it("shows the popular picks when empty", () => {
    expect(matchSuggestions("", ALL_GEOGRAPHIES, ["Worldwide"], COMMON_GEOGRAPHIES)).toEqual(
      COMMON_GEOGRAPHIES.filter((g) => g !== "Worldwide").slice(0, 8),
    );
  });
});
