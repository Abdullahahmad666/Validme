"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import type { Evidence, EvidenceFilters, Paginated } from "@/types/api";

export function useEvidence(filters: EvidenceFilters) {
  return useQuery({
    queryKey: ["evidence", filters],
    queryFn: () => api.listEvidence(filters),
    enabled: !!filters.project,
    placeholderData: keepPreviousData,
  });
}

export function useEvidenceFacets(project?: string) {
  return useQuery({ queryKey: ["evidence", "facets", project], queryFn: () => api.evidenceFacets(project), enabled: !!project });
}

export function useThemes(project?: string) {
  return useQuery({ queryKey: ["evidence", "themes", project], queryFn: () => api.listThemes(project!), enabled: !!project });
}

/** Optimistic save toggle across every cached evidence page. */
export function useSaveEvidence() {
  const qc = useQueryClient();
  const patch = (id: number, saved: boolean) =>
    qc.setQueriesData<Paginated<Evidence>>({ queryKey: ["evidence"] }, (page) =>
      page && "results" in page
        ? { ...page, results: page.results.map((e) => (e.id === id ? { ...e, saved_by_user: saved } : e)) }
        : page,
    );
  return useMutation({
    mutationFn: ({ id, saved }: { id: number; saved: boolean }) => api.saveEvidence(id, saved),
    onMutate: ({ id, saved }) => patch(id, saved),
    onError: (_e, { id, saved }) => patch(id, !saved),
    onSettled: () => qc.invalidateQueries({ queryKey: ["evidence", "facets"] }),
  });
}
