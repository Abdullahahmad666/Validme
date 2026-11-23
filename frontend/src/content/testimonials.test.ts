import { describe, expect, it } from "vitest";
import { TESTIMONIALS, visibleTestimonials, type Testimonial } from "@/content/testimonials";

describe("testimonials", () => {
  it("never shows sample testimonials in a production build", () => {
    expect(visibleTestimonials(TESTIMONIALS, "production").filter((t) => t.sample)).toEqual([]);
    const real: Testimonial = { quote: "Real words, with permission.", name: "A Real Person", role: "Founder" };
    expect(visibleTestimonials([...TESTIMONIALS, real], "production")).toEqual([real]);
  });

  it("shows the samples in development so the layout can be designed", () => {
    expect(visibleTestimonials(TESTIMONIALS, "development").length).toBe(TESTIMONIALS.length);
  });

  it("uses unique names and no star ratings", () => {
    expect(new Set(TESTIMONIALS.map((t) => t.name)).size).toBe(TESTIMONIALS.length);
    expect(JSON.stringify(TESTIMONIALS)).not.toMatch(/★|\bstars?\b|\/5\b/);
  });
});
