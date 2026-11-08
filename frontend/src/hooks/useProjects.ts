"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import type { ProjectInput, ProjectStatus } from "@/types/api";

export const projectsKey = ["projects"] as const;
export const summaryKey = ["dashboard", "summary"] as const;

export function useProjects(params: { status?: ProjectStatus; page?: number } = {}) {
  return useQuery({ queryKey: [...projectsKey, params], queryFn: () => api.listProjects(params) });
}

export function useDashboardSummary() {
  return useQuery({ queryKey: summaryKey, queryFn: api.dashboardSummary });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProjectInput) => api.createProject(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectsKey });
      qc.invalidateQueries({ queryKey: summaryKey });
    },
  });
}
