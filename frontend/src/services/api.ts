import { getCsrfToken, UNSAFE_METHODS } from "@/lib/csrf";
import type {
  ApiKey,
  DashboardSummary,
  Me,
  Paginated,
  Project,
  ProjectInput,
  ProjectStatus,
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
  updateProject: (id: string, input: Partial<ProjectInput>) =>
    request<Project>(`/projects/${id}`, { method: "PATCH", body: json(input) }),
  deleteProject: (id: string) => request<void>(`/projects/${id}`, { method: "DELETE" }),

  listApiKeys: () => request<Paginated<ApiKey>>("/api-keys"),
  createApiKey: (name: string) => request<ApiKey & { key: string }>("/api-keys", { method: "POST", body: json({ name }) }),
  revokeApiKey: (id: number) => request<void>(`/api-keys/${id}`, { method: "DELETE" }),

  getSources: () => request<{ results: ResearchSource[] }>("/research/sources"),
};
