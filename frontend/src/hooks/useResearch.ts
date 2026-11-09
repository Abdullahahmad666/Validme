"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { meKey } from "@/hooks/useSession";
import { projectsKey, summaryKey } from "@/hooks/useProjects";
import { api } from "@/services/api";
import type { Depth, Project, QueryIntent, ResearchJob, ResearchQuery } from "@/types/api";

export const projectKey = (id: string) => ["project", id] as const;
export const queriesKey = (id: string) => ["project", id, "queries"] as const;

export function useProject(id: string | null) {
  return useQuery({ queryKey: projectKey(id ?? ""), queryFn: () => api.getProject(id!), enabled: !!id });
}

export function useSources() {
  return useQuery({ queryKey: ["research", "sources"], queryFn: api.getSources, staleTime: 5 * 60_000 });
}

export function useQueries(projectId: string) {
  return useQuery({ queryKey: queriesKey(projectId), queryFn: () => api.listQueries(projectId) });
}

export function useEstimate(projectId: string, depth: Depth) {
  return useQuery({ queryKey: ["estimate", projectId, depth], queryFn: () => api.getEstimate(projectId, depth) });
}

export function useInterpret(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.interpretProject(projectId),
    onSuccess: ({ ai_interpretation }) => {
      qc.setQueryData<Project>(projectKey(projectId), (p) =>
        p ? { ...p, ai_interpretation, interpretation_confirmed: false } : p,
      );
    },
  });
}

export function useGenerateQueries(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (intent?: QueryIntent) => api.generateQueries(projectId, intent),
    onSuccess: ({ results }) => qc.setQueryData(queriesKey(projectId), results),
  });
}

/** Optimistic query edits: the list updates instantly and rolls back on error. */
export function useQueryMutations(projectId: string) {
  const qc = useQueryClient();
  const key = queriesKey(projectId);
  const snapshot = () => qc.getQueryData<ResearchQuery[]>(key);
  const restore = (prev?: ResearchQuery[]) => prev && qc.setQueryData(key, prev);

  const create = useMutation({
    mutationFn: (input: Pick<ResearchQuery, "text" | "intent">) => api.createQuery(projectId, input),
    onSuccess: (q) => qc.setQueryData<ResearchQuery[]>(key, (list = []) => [...list, q]),
  });
  const update = useMutation({
    mutationFn: ({ id, ...input }: { id: number; text?: string; enabled?: boolean }) =>
      api.updateQuery(projectId, id, input),
    onMutate: ({ id, ...input }) => {
      const prev = snapshot();
      qc.setQueryData<ResearchQuery[]>(key, (list = []) => list.map((q) => (q.id === id ? { ...q, ...input } : q)));
      return prev;
    },
    onError: (_e, _v, prev) => restore(prev),
    onSuccess: (q) => qc.setQueryData<ResearchQuery[]>(key, (list = []) => list.map((x) => (x.id === q.id ? q : x))),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteQuery(projectId, id),
    onMutate: (id) => {
      const prev = snapshot();
      qc.setQueryData<ResearchQuery[]>(key, (list = []) => list.filter((q) => q.id !== id));
      return prev;
    },
    onError: (_e, _v, prev) => restore(prev),
  });
  return { create, update, remove };
}

export function useLaunch(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (idempotencyKey: string) => api.createJob(projectId, idempotencyKey),
    onSuccess: (job) => {
      qc.setQueryData(["jobs", projectId], { count: 1, next: null, previous: null, results: [job] });
      // Don't refetch the project here: it's no longer a draft, and the wizard would redirect away
      // before the "Research launched" confirmation shows. The progress page loads it fresh.
      qc.removeQueries({ queryKey: projectKey(projectId), type: "inactive" });
      qc.invalidateQueries({ queryKey: meKey });
      qc.invalidateQueries({ queryKey: projectsKey });
      qc.invalidateQueries({ queryKey: summaryKey });
    },
  });
}

const RUNNING: ResearchJob["status"][] = ["PENDING", "RUNNING"];

/** Latest job for a project; polls every 3s while it's running (real stages, no fake percentages). */
export function useLatestJob(projectId: string) {
  return useQuery({
    queryKey: ["jobs", projectId],
    queryFn: () => api.listJobs(projectId),
    select: (page) => page.results[0] ?? null,
    refetchInterval: (q) => {
      const job = q.state.data?.results[0];
      return job && RUNNING.includes(job.status) ? 3000 : false;
    },
  });
}
