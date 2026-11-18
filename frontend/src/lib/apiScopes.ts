/** Mirrors backend accounts/scopes.py: what an API key (MCP server) may do. Write scopes are opt-in. */
export const API_SCOPES = [
  { key: "research:read", label: "Read projects, reports and evidence", default: true, write: false },
  { key: "research:run", label: "Start research (spends your credits)", default: true, write: false },
  { key: "monitoring:read", label: "Read watches, page changes, Radar signals and score history", default: true, write: false },
  { key: "lab:read", label: "Read Lab pages, surveys and results as counts (never emails or answers)", default: true, write: false },
  { key: "monitoring:write", label: "Mark Radar signals seen, acted on or dismissed", default: false, write: true },
  { key: "assumptions:write", label: "Set an assumption's status or note", default: false, write: true },
] as const;

export type ApiScope = (typeof API_SCOPES)[number]["key"];
export const DEFAULT_SCOPES: ApiScope[] = API_SCOPES.filter((s) => s.default).map((s) => s.key);

export function scopeLabel(key: string): string {
  return API_SCOPES.find((s) => s.key === key)?.label ?? key;
}
