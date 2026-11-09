import { describe, expect, it } from "vitest";
import { readCookie } from "@/lib/csrf";
import { safeNext } from "@/lib/safe-next";
import { ideaSchema, signupSchema } from "@/lib/validation";

const IDEA = "A tool that helps independent restaurants track inventory and reduce food waste.";

describe("readCookie", () => {
  it("finds a cookie among others and decodes it", () => {
    expect(readCookie("csrftoken", "a=1; csrftoken=x%3Dy; b=2")).toBe("x=y");
    expect(readCookie("csrftoken", "a=1")).toBeNull();
  });
});

describe("safeNext", () => {
  it("allows relative app paths", () => {
    expect(safeNext("/projects?x=1")).toBe("/projects?x=1");
  });
  it.each([null, "", "https://evil.com", "//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "javascript:alert(1)"])(
    "rejects %s",
    (raw) => expect(safeNext(raw)).toBe("/dashboard"),
  );
});

describe("ideaSchema (mirrors backend ProjectSerializer)", () => {
  const valid = { name: "Restaurant inventory", description: IDEA, objectives: ["validate_demand"] };

  it("accepts a minimal valid idea", () => {
    expect(ideaSchema.safeParse(valid).success).toBe(true);
  });
  it("enforces name 3–80 and description 30–2000", () => {
    expect(ideaSchema.safeParse({ ...valid, name: "ab" }).success).toBe(false);
    expect(ideaSchema.safeParse({ ...valid, name: "x".repeat(81) }).success).toBe(false);
    expect(ideaSchema.safeParse({ ...valid, description: "too short" }).success).toBe(false);
    expect(ideaSchema.safeParse({ ...valid, description: "x".repeat(2001) }).success).toBe(false);
  });
  it("requires at least one known objective", () => {
    expect(ideaSchema.safeParse({ ...valid, objectives: [] }).success).toBe(false);
    expect(ideaSchema.safeParse({ ...valid, objectives: ["get_rich"] }).success).toBe(false);
  });
  it("only allows http(s) product URLs, or empty", () => {
    expect(ideaSchema.safeParse({ ...valid, existing_product_url: "" }).success).toBe(true);
    expect(ideaSchema.safeParse({ ...valid, existing_product_url: "https://example.com" }).success).toBe(true);
    expect(ideaSchema.safeParse({ ...valid, existing_product_url: "ftp://example.com" }).success).toBe(false);
  });
});

describe("signupSchema", () => {
  it("requires 8+ char passwords", () => {
    expect(signupSchema.safeParse({ email: "a@b.co", password: "short" }).success).toBe(false);
    expect(signupSchema.safeParse({ email: "a@b.co", password: "long-enough" }).success).toBe(true);
  });
});

describe("safeHref", () => {
  it("keeps http(s) links and drops script or data URLs", async () => {
    const { safeHref } = await import("@/lib/utils");
    expect(safeHref("https://news.ycombinator.com/item?id=1")).toBe("https://news.ycombinator.com/item?id=1");
    expect(safeHref("javascript:alert(1)")).toBeUndefined();
    expect(safeHref("data:text/html,x")).toBeUndefined();
    expect(safeHref("not a url")).toBeUndefined();
    expect(safeHref("")).toBeUndefined();
  });
});
