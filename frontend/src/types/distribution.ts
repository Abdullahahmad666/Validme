// Mirrors backend/distribution (Week 12). YouTube figures are YouTube's own, shown as returned with the date we read
// them (stored at most 30 days). Keyword figures come from a licensed provider; null = unavailable, never 0.
import type { Channel, PlanStep, ReportEvidence } from "@/types/report";

export type ProviderStatus = "OK" | "LIMITED" | "FAILED" | "REQUIRES_CONNECTION" | "SKIPPED";
export type LastCheck = { status: ProviderStatus; note: string; at: string } | null;

export type YouTubeChannelRow = {
  channel_id: string;
  title: string;
  url: string;
  subscriber_count: number | null;
  subscribers_hidden: boolean;
  video_count: number | null;
  latest_video: { title: string; url: string; published_at: string | null } | null;
  matched_queries: string[];
  fetched_at: string;
  expires_at: string;
};

export type KeywordRow = {
  keyword: string;
  search_volume: number | null;
  cpc: string | null;
  competition: string;
  difficulty: number | null;
  monthly: { year: number; month: number; volume: number | null }[];
  source: string;
  fetched_at: string;
  stale: boolean;
};

export type Distribution = {
  report: { id: number; created_at: string } | null;
  channels: Channel[];
  first_ten_plan: PlanStep[];
  evidence: Record<string, ReportEvidence>;
  youtube: { connected: boolean; last_check: LastCheck; searches: string[]; channels: YouTubeChannelRow[] };
  keywords: {
    connected: boolean;
    last_check: LastCheck;
    location: { code: number; language: string; label: string; default: boolean };
    allowance: { used: number; limit: number };
    rows: KeywordRow[];
  };
};

export type RefreshResult = Partial<Record<"youtube" | "keywords", { status: ProviderStatus; note: string }>>;
