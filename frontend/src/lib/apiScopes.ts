/** Mirrors backend accounts/scopes.py: what an API key (MCP server) may do. Write scopes are opt-in. */
export const API_SCOPES = [
  { key: "research:read", short: "Read research", label: "Read projects, reports and evidence", default: true, write: false, spends: false },
  { key: "research:run", short: "Start research", label: "Start research", default: true, write: false, spends: true },
  { key: "monitoring:read", short: "Read monitoring", label: "Read watches, page changes, Radar signals and score history", default: true, write: false, spends: false },
  { key: "lab:read", short: "Read Lab results", label: "Read Lab pages, surveys and results as counts (never emails or answers)", default: true, write: false, spends: false },
  { key: "monitoring:write", short: "Update Radar signals", label: "Mark Radar signals seen, acted on or dismissed", default: false, write: true, spends: false },
  { key: "assumptions:write", short: "Set assumption status", label: "Set an assumption's status or note", default: false, write: true, spends: false },
] as const;

export type ApiScope = (typeof API_SCOPES)[number]["key"];
export const DEFAULT_SCOPES: ApiScope[] = API_SCOPES.filter((s) => s.default).map((s) => s.key);

export function scopeInfo(key: string) {
  return API_SCOPES.find((s) => s.key === key) ?? { key, short: key, label: key, default: false, write: false, spends: false };
}

/** Mirrors backend lab/verdicts.py (MIN_ANSWERS, MAJORITY); a test pins them to the backend file. */
export const VERDICT_MIN_ANSWERS = 10;
export const VERDICT_MAJORITY_PCT = 50;
