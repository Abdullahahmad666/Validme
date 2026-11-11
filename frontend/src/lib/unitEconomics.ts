/**
 * Unit-economics simulator: plain arithmetic on the founder's own inputs. No market data, no AI.
 * Monthly model: customers(t) = customers(t-1) × (1 − churn) + new customers.
 */

export type Scenario = { price: number; cac: number; churn: number; growth: number }; // % changes vs base

export type UnitInputs = {
  currency: string;
  price: number; // per customer per month
  cac: number; // cost to acquire one customer
  churn_pct: number; // monthly churn, %
  margin_pct: number; // gross margin, %
  fixed_costs: number; // per month
  new_customers: number; // per month
  pessimistic: Scenario;
  optimistic: Scenario;
};

export type ScenarioKey = "pessimistic" | "realistic" | "optimistic";

export type Projection = { month: number; customers: number; mrr: number; profit: number; cash: number };

export type UnitResult = {
  scenario: ScenarioKey;
  price: number;
  cac: number;
  churnPct: number;
  newCustomers: number;
  contribution: number; // gross profit per customer per month
  ltv: number | null; // contribution / churn
  ltvToCac: number | null;
  paybackMonths: number | null;
  breakEvenCustomers: number | null;
  steadyStateCustomers: number;
  months: Projection[];
  firstProfitableMonth: number | null;
  lowestCash: number;
};

export const DEFAULT_INPUTS: UnitInputs = {
  currency: "USD",
  price: 29,
  cac: 120,
  churn_pct: 4,
  margin_pct: 80,
  fixed_costs: 2000,
  new_customers: 15,
  pessimistic: { price: -20, cac: 30, churn: 50, growth: -40 },
  optimistic: { price: 10, cac: -20, churn: -25, growth: 50 },
};

const pct = (base: number, change: number) => Math.max(0, base * (1 + change / 100));

export function applyScenario(i: UnitInputs, key: ScenarioKey) {
  if (key === "realistic") return { price: i.price, cac: i.cac, churnPct: i.churn_pct, newCustomers: i.new_customers };
  const s = i[key];
  return {
    price: pct(i.price, s.price),
    cac: pct(i.cac, s.cac),
    churnPct: Math.min(100, Math.max(0.1, pct(i.churn_pct, s.churn))),
    newCustomers: pct(i.new_customers, s.growth),
  };
}

export function simulate(i: UnitInputs, key: ScenarioKey = "realistic", horizon = 24): UnitResult {
  const { price, cac, churnPct, newCustomers } = applyScenario(i, key);
  const churn = churnPct / 100;
  const contribution = price * (i.margin_pct / 100);
  const ltv = churn > 0 ? contribution / churn : null;
  const months: Projection[] = [];
  let customers = 0;
  let cash = 0;
  let lowestCash = 0;
  let firstProfitableMonth: number | null = null;
  for (let m = 1; m <= horizon; m++) {
    customers = customers * (1 - churn) + newCustomers;
    const profit = customers * contribution - i.fixed_costs - newCustomers * cac;
    cash += profit;
    lowestCash = Math.min(lowestCash, cash);
    if (firstProfitableMonth === null && profit >= 0) firstProfitableMonth = m;
    months.push({ month: m, customers, mrr: customers * price, profit, cash });
  }
  return {
    scenario: key,
    price,
    cac,
    churnPct,
    newCustomers,
    contribution,
    ltv,
    ltvToCac: ltv !== null && cac > 0 ? ltv / cac : null,
    paybackMonths: contribution > 0 ? cac / contribution : null,
    breakEvenCustomers: contribution > 0 ? Math.ceil(i.fixed_costs / contribution) : null,
    steadyStateCustomers: churn > 0 ? newCustomers / churn : 0,
    months,
    firstProfitableMonth,
    lowestCash,
  };
}

/** First number in a free-text price ("$29/month", "29 USD") — used to prefill from the price hypothesis. */
export function parsePrice(text: string | null | undefined): number | null {
  const m = (text ?? "").replace(/,/g, "").match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export function money(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: Math.abs(n) < 100 ? 2 : 0 }).format(n);
  } catch {
    return `${Math.round(n)} ${currency}`;
  }
}
