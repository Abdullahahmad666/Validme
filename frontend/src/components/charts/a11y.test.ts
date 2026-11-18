import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "..");
const ROOTS = /<(BarChart|LineChart|AreaChart|ComposedChart|PieChart|RadialBarChart|ScatterChart)\b([^>]*)/g;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

describe("chart accessibility", () => {
  it("every Recharts root opts out of the focusable accessibility layer (the SVG is aria-hidden; text alternatives carry it)", () => {
    const offenders: string[] = [];
    let found = 0;
    for (const f of files(SRC)) {
      const src = readFileSync(f, "utf8");
      if (!src.includes('from "recharts"')) continue;
      for (const m of src.matchAll(ROOTS)) {
        found += 1;
        if (!m[2].includes("accessibilityLayer={false}")) offenders.push(`${f.slice(SRC.length + 1)}: <${m[1]}>`);
      }
    }
    expect(found).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });
});
