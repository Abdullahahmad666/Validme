import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { API_SCOPES, DEFAULT_SCOPES, VERDICT_MAJORITY_PCT, VERDICT_MIN_ANSWERS } from "@/lib/apiScopes";

// The backend is the source of truth (accounts/scopes.py); this keeps the Settings list in step with it.
const backend = readFileSync(resolve(__dirname, "../../../backend/accounts/scopes.py"), "utf8");

describe("API key scopes", () => {
  it("match the backend's scopes and defaults", () => {
    const block = backend.slice(backend.indexOf("SCOPES = {"), backend.indexOf("}", backend.indexOf("SCOPES = {")));
    const keys = [...block.matchAll(/"([a-z]+:[a-z]+)":/g)].map((m) => m[1]);
    expect(API_SCOPES.map((s) => s.key).sort()).toEqual([...keys].sort());
    const defaults = backend.match(/DEFAULT_SCOPES = \[([^\]]+)\]/)?.[1] ?? "";
    expect([...DEFAULT_SCOPES].sort()).toEqual([...defaults.matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort());
  });

  it("never turn write scopes on by default", () => {
    expect(API_SCOPES.filter((s) => s.write && s.default)).toEqual([]);
  });
});

describe("survey verdict rule shown in the editor", () => {
  it("matches backend/lab/verdicts.py", () => {
    const verdicts = readFileSync(resolve(__dirname, "../../../backend/lab/verdicts.py"), "utf8");
    expect(Number(verdicts.match(/^MIN_ANSWERS = (\d+)/m)?.[1])).toBe(VERDICT_MIN_ANSWERS);
    expect(Number(verdicts.match(/^MAJORITY = ([\d.]+)/m)?.[1]) * 100).toBe(VERDICT_MAJORITY_PCT);
  });
});
