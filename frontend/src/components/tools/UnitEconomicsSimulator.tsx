"use client";

import { Calculator, Info, Save } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { fmtDate } from "@/components/evidence/EvidenceCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEFAULT_INPUTS, money, simulate, type ScenarioKey, type UnitInputs } from "@/lib/unitEconomics";

type FieldKey = keyof Omit<UnitInputs, "currency" | "pessimistic" | "optimistic">;
const FIELDS: { key: FieldKey; label: string; hint: string; step: number; min: number; max: number; minExclusive?: boolean }[] = [
  { key: "price", label: "Price per customer / month", hint: "What one customer pays monthly", step: 1, min: 0, max: 1_000_000 },
  { key: "cac", label: "Cost to acquire a customer", hint: "Ads, content and time per new customer", step: 1, min: 0, max: 10_000_000 },
  { key: "churn_pct", label: "Monthly churn (%)", hint: "Share of customers who cancel each month (0.1–100)", step: 0.5, min: 0.1, max: 100 },
  { key: "margin_pct", label: "Gross margin (%)", hint: "After hosting, payment fees and support (0–100)", step: 1, min: 0, max: 100 },
  { key: "fixed_costs", label: "Fixed costs / month", hint: "Tools, salaries, everything that doesn't scale", step: 50, min: 0, max: 100_000_000 },
  { key: "new_customers", label: "New customers / month", hint: "Your realistic acquisition pace", step: 1, min: 0, max: 1_000_000 },
];
const SCENARIO_FIELDS = [
  { key: "price", label: "Price" },
  { key: "cac", label: "CAC" },
  { key: "churn", label: "Churn" },
  { key: "growth", label: "New customers" },
] as const;
const SCENARIOS: { key: ScenarioKey; label: string }[] = [
  { key: "pessimistic", label: "Pessimistic" },
  { key: "realistic", label: "Realistic" },
  { key: "optimistic", label: "Optimistic" },
];
const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "INR", "PKR"];
const n = (v: number) => v.toLocaleString("en", { maximumFractionDigits: 0 });

function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "good" | "bad" }) {
  return (
    <div className="min-w-0 rounded-control border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 break-words text-lg font-semibold tabular-nums",
          tone === "good" && "text-success-text",
          tone === "bad" && "text-destructive-text",
        )}
      >
        {value}
      </p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

/**
 * Deterministic simulator on the founder's own numbers. Nothing here is market data or AI output.
 * `example` = the inputs are our example values, not the founder's: labelled, and Save waits for an edit.
 */
export function UnitEconomicsSimulator({
  initial,
  example = !initial,
  onSave,
  saving,
  savedAt,
}: {
  initial?: UnitInputs | null;
  example?: boolean;
  onSave?: (inputs: UnitInputs) => void;
  saving?: boolean;
  savedAt?: string | null;
}) {
  const uid = useId();
  const [inputs, setInputs] = useState<UnitInputs>(initial ?? DEFAULT_INPUTS);
  const [raw, setRaw] = useState<Record<string, string>>({});
  const [edited, setEdited] = useState(false);
  const [scenario, setScenario] = useState<ScenarioKey>("realistic");
  const isExample = example && !edited;

  const errors: Record<string, string> = {};
  for (const f of FIELDS) {
    const text = raw[f.key];
    if (text === undefined) continue;
    const v = Number(text);
    if (text.trim() === "" || !Number.isFinite(v)) errors[f.key] = "Enter a number.";
    else if (v < f.min || v > f.max) errors[f.key] = `Between ${f.min.toLocaleString("en")} and ${f.max.toLocaleString("en")}.`;
  }
  for (const s of ["pessimistic", "optimistic"] as const) {
    for (const { key } of SCENARIO_FIELDS) {
      const text = raw[`${s}.${key}`];
      if (text === undefined) continue;
      const v = Number(text);
      const min = key === "growth" ? -100 : -90;
      if (text.trim() === "" || !Number.isFinite(v) || v < min || v > 500) errors[`${s}.${key}`] = `${min} to 500.`;
    }
  }
  const hasErrors = Object.keys(errors).length > 0;

  const results = useMemo(() => Object.fromEntries(SCENARIOS.map((s) => [s.key, simulate(inputs, s.key)])), [inputs]);
  const r = results[scenario];
  const fmt = (v: number) => money(v, inputs.currency);

  const change = (key: string, text: string, apply: (v: number) => void, min: number, max: number) => {
    setRaw((s) => ({ ...s, [key]: text }));
    setEdited(true);
    const v = Number(text);
    if (text.trim() !== "" && Number.isFinite(v) && v >= min && v <= max) apply(v);
  };
  const shown = (key: string, value: number) => raw[key] ?? String(value);
  const maxCash = Math.max(1, ...r.months.map((m) => Math.abs(m.cash)));

  return (
    <div className="flex flex-col gap-5">
      <p className="flex items-start gap-2 rounded-control bg-muted/60 p-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span>
          {isExample ? (
            <>
              <span className="font-medium">Example numbers: replace them with yours.</span> The results below are arithmetic on
              these inputs, not market data.
            </>
          ) : (
            <>
              <span className="font-medium">Your numbers, not market data.</span> This is arithmetic on what you enter: test the
              price and churn assumptions with customers before trusting the result.
            </>
          )}
        </span>
      </p>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <section aria-labelledby={`${uid}-inputs`} className="rounded-card border border-border bg-card p-5">
          <h2 id={`${uid}-inputs`} className="flex flex-wrap items-center gap-2 font-semibold">
            <Calculator className="size-4 text-primary" aria-hidden /> Inputs
            {isExample && <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning-text">Example</span>}
          </h2>
          <div className="mt-4 flex flex-col gap-1">
            <label htmlFor={`${uid}-currency`} className="text-sm font-medium">
              Currency
            </label>
            <select
              id={`${uid}-currency`}
              value={inputs.currency}
              onChange={(e) => (setInputs((s) => ({ ...s, currency: e.target.value })), setEdited(true))}
              className="h-11 rounded-control border border-input bg-card px-2 text-sm"
            >
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {FIELDS.map((f) => {
              const id = `${uid}-${f.key}`;
              const err = errors[f.key];
              return (
                <div key={f.key} className="flex flex-col gap-1">
                  <label htmlFor={id} className="text-sm font-medium">
                    {f.label}
                  </label>
                  <input
                    id={id}
                    type="number"
                    inputMode="decimal"
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={shown(f.key, inputs[f.key])}
                    onChange={(e) => change(f.key, e.target.value, (v) => setInputs((s) => ({ ...s, [f.key]: v })), f.min, f.max)}
                    aria-invalid={!!err}
                    aria-describedby={`${id}-hint`}
                    className={cn(
                      "h-11 rounded-control border bg-card px-3 text-sm tabular-nums",
                      err ? "border-destructive" : "border-input",
                    )}
                  />
                  <span id={`${id}-hint`} className={cn("text-xs", err ? "text-destructive-text" : "text-muted-foreground")}>
                    {err ?? f.hint}
                  </span>
                </div>
              );
            })}
          </div>
          <details className="mt-4">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-primary">Scenario assumptions</summary>
            {(["pessimistic", "optimistic"] as const).map((s) => (
              <fieldset key={s} className="mt-3">
                <legend className="text-xs font-medium text-muted-foreground">
                  {s[0].toUpperCase() + s.slice(1)}: % change vs realistic
                </legend>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {SCENARIO_FIELDS.map(({ key, label }) => {
                    const id = `${uid}-${s}-${key}`;
                    const err = errors[`${s}.${key}`];
                    const min = key === "growth" ? -100 : -90;
                    return (
                      <div key={key} className="flex flex-col gap-0.5">
                        <label htmlFor={id} className="text-xs">
                          {label}
                        </label>
                        <input
                          id={id}
                          type="number"
                          step={5}
                          min={min}
                          max={500}
                          value={shown(`${s}.${key}`, inputs[s][key])}
                          onChange={(e) =>
                            change(`${s}.${key}`, e.target.value, (v) => setInputs((cur) => ({ ...cur, [s]: { ...cur[s], [key]: v } })), min, 500)
                          }
                          aria-invalid={!!err}
                          aria-describedby={err ? `${id}-err` : undefined}
                          className={cn("h-11 rounded-control border bg-card px-2 text-sm tabular-nums", err ? "border-destructive" : "border-input")}
                        />
                        {err && (
                          <span id={`${id}-err`} className="text-xs text-destructive-text">
                            {err}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </details>
          {onSave && (
            <div className="mt-5 flex flex-col gap-2">
              <Button onClick={() => onSave(inputs)} disabled={saving || hasErrors || isExample} className="self-start">
                <Save aria-hidden /> {saving ? "Saving…" : "Save to project"}
              </Button>
              <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
                {hasErrors
                  ? "Fix the highlighted fields to save."
                  : isExample
                    ? "Change at least one number to save your own inputs."
                    : savedAt
                      ? `Saved ${fmtDate(savedAt)}. Saved to the project, so every report version uses the same inputs.`
                      : "Saved to the project, so every report version uses the same inputs."}
              </p>
            </div>
          )}
        </section>

        <section aria-labelledby={`${uid}-results`} className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id={`${uid}-results`} className="font-semibold">
              Results {isExample && <span className="text-sm font-normal text-muted-foreground">(from example numbers)</span>}
            </h2>
            <fieldset className="inline-flex rounded-control border border-border p-0.5">
              <legend className="sr-only">Scenario</legend>
              {SCENARIOS.map((s) => (
                <label
                  key={s.key}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center rounded-[calc(var(--radius-control)-2px)] px-3 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary",
                    scenario === s.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <input
                    type="radio"
                    name={`${uid}-scenario`}
                    value={s.key}
                    checked={scenario === s.key}
                    onChange={() => setScenario(s.key)}
                    className="sr-only"
                  />
                  {s.label}
                </label>
              ))}
            </fieldset>
          </div>
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-3">
            <Stat label="Gross profit / customer / month" value={fmt(r.contribution)} />
            <Stat
              label="Customer lifetime value"
              value={r.ltv === null ? "—" : fmt(r.ltv)}
              note={r.ltv === null ? "Needs churn above 0" : `At ${r.churnPct.toFixed(1)}% monthly churn`}
            />
            <Stat
              label="LTV : CAC"
              value={r.ltvToCac === null ? "—" : `${r.ltvToCac.toFixed(1)} : 1`}
              note={r.ltvToCac === null ? "Needs a CAC above 0" : "3:1 or better is a common target"}
              tone={r.ltvToCac === null ? undefined : r.ltvToCac >= 3 ? "good" : r.ltvToCac < 1 ? "bad" : undefined}
            />
            <Stat
              label="CAC payback"
              value={r.paybackMonths === null ? "Never" : `${r.paybackMonths.toFixed(1)} months`}
              note={r.paybackMonths === null ? "No gross profit per customer" : undefined}
            />
            <Stat
              label="Customers to cover fixed costs"
              value={r.breakEvenCustomers === null ? "—" : n(r.breakEvenCustomers)}
              note={r.breakEvenCustomers === null ? "No gross profit per customer" : undefined}
            />
            <Stat
              label="First profitable month"
              value={r.firstProfitableMonth === null ? "Not within 24 months" : `Month ${r.firstProfitableMonth}`}
              note={`Lowest cash point ${fmt(r.lowestCash)}`}
              tone={r.firstProfitableMonth === null ? "bad" : undefined}
            />
          </div>

          <div className="rounded-card border border-border bg-card p-4">
            <p className="text-sm font-medium">Cumulative cash over 24 months ({SCENARIOS.find((s) => s.key === scenario)?.label})</p>
            <div className="mt-3 flex h-36 items-center gap-[3px]" role="img" aria-label={`Cash after 24 months: ${fmt(r.months.at(-1)!.cash)}`}>
              {r.months.map((m) => (
                <div key={m.month} className="flex h-full flex-1 flex-col justify-center">
                  <div className="flex h-1/2 items-end">
                    {m.cash > 0 && <div className="w-full rounded-t-sm bg-success" style={{ height: `${(m.cash / maxCash) * 100}%` }} />}
                  </div>
                  <div className="flex h-1/2 items-start border-t border-border">
                    {m.cash < 0 && <div className="w-full rounded-b-sm bg-destructive/70" style={{ height: `${(-m.cash / maxCash) * 100}%` }} />}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] text-right text-sm tabular-nums">
                <caption className="sr-only">Projection by month</caption>
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="py-1 text-left font-medium">Month</th>
                    <th scope="col" className="py-1 font-medium">Customers</th>
                    <th scope="col" className="py-1 font-medium">MRR</th>
                    <th scope="col" className="py-1 font-medium">Profit</th>
                    <th scope="col" className="py-1 font-medium">Cash</th>
                  </tr>
                </thead>
                <tbody>
                  {r.months.filter((m) => [1, 3, 6, 12, 18, 24].includes(m.month)).map((m) => (
                    <tr key={m.month} className="border-t border-border">
                      <th scope="row" className="py-1.5 text-left font-normal">{m.month}</th>
                      <td>{n(m.customers)}</td>
                      <td>{fmt(m.mrr)}</td>
                      <td className={m.profit < 0 ? "text-destructive-text" : ""}>{fmt(m.profit)}</td>
                      <td className={m.cash < 0 ? "text-destructive-text" : ""}>{fmt(m.cash)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Model: customers each month = last month × (1 − churn) + new customers. Profit = customers × gross profit − fixed
            costs − new customers × CAC. Long-run customer base ≈ {n(r.steadyStateCustomers)} at this churn and pace.
          </p>
        </section>
      </div>
    </div>
  );
}
