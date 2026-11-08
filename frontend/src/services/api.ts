import type { Paginated, Project, ResearchSource } from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.error?.code ?? "error", body?.error?.message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listProjects: () => request<Paginated<Project>>("/projects"),
  getSources: () => request<{ results: ResearchSource[] }>("/research/sources"),
};
