"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";

/** Validation Lab surveys and notices (Week 14). Query keys are shared with the mutations that invalidate them. */
export const labKeys = {
  surveys: (projectId: string) => ["lab-surveys", projectId] as const,
  survey: (projectId: string, id: number) => ["lab-survey", projectId, id] as const,
  results: (projectId: string, id: number) => ["lab-survey-results", projectId, id] as const,
  responses: (projectId: string, id: number) => ["lab-survey-responses", projectId, id] as const,
  notices: (projectId: string) => ["lab-notices", projectId] as const,
  predictedVsActual: (projectId: string) => ["predicted-vs-actual", projectId] as const,
  assumptions: (projectId: string) => ["assumptions", projectId] as const,
};

export function useLabSurveys(projectId: string) {
  return useQuery({ queryKey: labKeys.surveys(projectId), queryFn: () => api.labSurveys(projectId) });
}

export function useLabSurvey(projectId: string, id: number) {
  return useQuery({ queryKey: labKeys.survey(projectId, id), queryFn: () => api.labSurvey(projectId, id), enabled: Number.isFinite(id) });
}

export function useSurveyResults(projectId: string, id: number) {
  return useQuery({ queryKey: labKeys.results(projectId, id), queryFn: () => api.labSurveyResults(projectId, id) });
}

export function useSurveyStats(projectId: string, id: number) {
  return useQuery({ queryKey: ["lab-survey-stats", projectId, id], queryFn: () => api.labSurveyStats(projectId, id) });
}

export function useSurveyResponses(projectId: string, id: number) {
  return useQuery({ queryKey: labKeys.responses(projectId, id), queryFn: () => api.labSurveyResponses(projectId, id) });
}

export function useLabNotices(projectId: string) {
  return useQuery({ queryKey: labKeys.notices(projectId), queryFn: () => api.labNotices(projectId) });
}

/** Same key as the report's assumption tracker, so both stay in sync. */
export function useAssumptions(projectId: string) {
  return useQuery({ queryKey: ["assumptions", projectId], queryFn: () => api.listAssumptions(projectId) });
}
