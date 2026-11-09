import { getCsrfToken, UNSAFE_METHODS } from "@/lib/csrf";
import type { Report } from "@/types/report";
import type {
  ApiKey,
  DashboardSummary,
  Depth,
  Estimate,
  Evidence,
  EvidenceFacets,
  EvidenceFilters,
  EvidenceTheme,
  Interpretation,
  Me,
  Paginated,
  Project,
  ProjectInput,
  ProjectPatch,
  ProjectStatus,
  QueryIntent,
  ResearchJob,
  ResearchQuery,
  ResearchSource,
} from "@/types/api";

// Same-origin by default: next.config.ts proxies /api to Django.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (UNSAFE_METHODS.has(method)) {
    const token = getCsrfToken();
    if (token) headers.set("X-CSRFToken", token);
  }
  const res = await fetch(`${API_URL}${path}`, { ...init, method, headers, credentials: "same-origin" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const err = body?.error;
    throw new ApiError(res.status, err?.code ?? "error", err?.message ?? res.statusText, err?.details);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const json = (body: unknown) => JSON.stringify(body);

/** Query string for the evidence explorer; empty filters are left out. */
export function evidenceQuery(f: EvidenceFilters): string {
  const q = new URLSearchParams();
  if (f.project) q.set("project", f.project);
  if (f.category?.length) q.set("category", f.category.join(","));
  if (f.provider) q.set("provider", f.provider);
  if (f.cluster) q.set("cluster", String(f.cluster));
  if (f.q?.trim()) q.set("q", f.q.trim());
  if (f.saved) q.set("saved", "1");
  if (f.page && f.page > 1) q.set("page", String(f.page));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const api = {
  me: () => request<Me>("/me"),
  dashboardSummary: () => request<DashboardSummary>("/dashboard/summary"),

  listProjects: (params: { status?: ProjectStatus; page?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.page) q.set("page", String(params.page));
    const qs = q.toString();
    return request<Paginated<Project>>(`/projects${qs ? `?${qs}` : ""}`);
  },
  getProject: (id: string) => request<Project>(`/projects/${id}`),
  createProject: (input: ProjectInput) => request<Project>("/projects", { method: "POST", body: json(input) }),
  updateProject: (id: string, input: ProjectPatch) =>
    request<Project>(`/projects/${id}`, { method: "PATCH", body: json(input) }),
  interpretProject: (id: string) =>
    request<{ ai_interpretation: Interpretation }>(`/projects/${id}/interpret`, { method: "POST" }),
  generateQueries: (id: string, intent?: QueryIntent) =>
    request<{ results: ResearchQuery[] }>(`/projects/${id}/keywords/generate`, {
      method: "POST",
      body: json(intent ? { intent } : {}),
    }),

  listQueries: (projectId: string) => request<ResearchQuery[]>(`/projects/${projectId}/queries`),
  createQuery: (projectId: string, input: Pick<ResearchQuery, "text" | "intent">) =>
    request<ResearchQuery>(`/projects/${projectId}/queries`, { method: "POST", body: json(input) }),
  updateQuery: (projectId: string, id: number, input: Partial<Pick<ResearchQuery, "text" | "enabled">>) =>
    request<ResearchQuery>(`/projects/${projectId}/queries/${id}`, { method: "PATCH", body: json(input) }),
  deleteQuery: (projectId: string, id: number) =>
    request<void>(`/projects/${projectId}/queries/${id}`, { method: "DELETE" }),

  getEstimate: (projectId: string, depth: Depth) =>
    request<Estimate>(`/research/estimate?project=${encodeURIComponent(projectId)}&depth=${depth}`),
  createJob: (projectId: string, idempotencyKey: string) =>
    request<ResearchJob>("/research/jobs", {
      method: "POST",
      body: json({ project: projectId }),
      headers: { "Idempotency-Key": idempotencyKey },
    }),
  listJobs: (projectId: string) => request<Paginated<ResearchJob>>(`/research/jobs?project=${encodeURIComponent(projectId)}`),
  getJob: (id: string) => request<ResearchJob>(`/research/jobs/${id}`),
  deleteProject: (id: string) => request<void>(`/projects/${id}`, { method: "DELETE" }),

  listApiKeys: () => request<Paginated<ApiKey>>("/api-keys"),
  createApiKey: (name: string) => request<ApiKey & { key: string }>("/api-keys", { method: "POST", body: json({ name }) }),
  revokeApiKey: (id: number) => request<void>(`/api-keys/${id}`, { method: "DELETE" }),

  getSources: () => request<{ results: ResearchSource[] }>("/research/sources"),

  listEvidence: (f: EvidenceFilters) => request<Paginated<Evidence>>(`/evidence${evidenceQuery(f)}`),
  evidenceFacets: (project?: string) =>
    request<EvidenceFacets>(`/evidence/facets${project ? `?project=${encodeURIComponent(project)}` : ""}`),
  listThemes: (project: string) => request<EvidenceTheme[]>(`/evidence/clusters?project=${encodeURIComponent(project)}`),
  getReport: (projectId: string) => request<Report>(`/reports/${encodeURIComponent(projectId)}`),
  saveEvidence: (id: number, saved: boolean) =>
    request<Evidence>(`/evidence/${id}`, { method: "PATCH", body: json({ saved_by_user: saved }) }),
};
