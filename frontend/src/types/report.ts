// Mirrors backend/reports/services.py::build_report content + ReportView.
import type { CoverageStatus, EvidenceCategory, ProjectStatus } from "@/types/api";

export type Level = "low" | "medium" | "high";

export type ReportEvidence = {
  id: number;
  title: string;
  excerpt: string;
  source_url: string;
  provider: string;
  published_at: string | null;
  category: EvidenceCategory;
};

export type Dimension = {
  key: string;
  label: string;
  weight: number;
  score: number | null;
  available: boolean;
  confidence: Level;
  explanation: string;
  evidence_ids: number[];
};

export type Theme = {
  id: number;
  name: string;
  category: EvidenceCategory;
  severity: Level | "";
  confidence: Level | "";
  ai_summary: string;
  records: number;
  distinct_sources: number;
  distinct_authors: number | null;
  samples: ReportEvidence[];
  evidence_ids: number[];
};

export type ReportCompetitor = {
  id: number;
  name: string;
  kind: "listed" | "mentioned";
  website: string;
  positioning: string;
  audience: string;
  features: string[];
  pricing: {
    status: "verified" | "unavailable";
    plans: { name: string; price: string; period: string }[];
    source_url?: string;
    retrieved_at?: string;
  };
  complaint_ids: number[];
  identified_gap: string;
  evidence_ids: number[];
  ai_extracted: boolean;
};

export type Recommendation = "build" | "research_more" | "pivot";

export type Channel = {
  key: string;
  name: string;
  is_hypothesis: boolean;
  evidence_count: number;
  threads: number;
  latest: string | null;
  categories: Partial<Record<EvidenceCategory, number>>;
  relevance: Level | "";
  recommendation: string;
  evidence_ids: number[];
};

export type Segment = {
  name: string;
  source: "founder" | "ai";
  evidence_count: number;
  evidence_ids: number[];
  signals: Partial<Record<EvidenceCategory, number>>;
  needs: { text: string; evidence_ids: number[]; ai: boolean }[];
  channels: string[];
  accessibility: string;
};

export type PlanStep = { title: string; detail: string; evidence_ids: number[]; ai: boolean };

export type ReportVersion = {
  id: number;
  created_at: string;
  depth: string;
  score: number | null;
  confidence: Level | "";
  recommendation: Recommendation | "";
  evidence_count: number;
};

export type Report = {
  id: number;
  project: { id: string; name: string; status: ProjectStatus; industry: string; audiences: string[]; geographies: string[] };
  created_at: string;
  generated_at: string | null;
  depth: string;
  coverage: Record<string, CoverageStatus>;
  overview: {
    score: number | null;
    confidence: Level;
    recommendation: Recommendation;
    next_step: string;
    evidence_count: number;
    competitor_count: number;
    summary: string;
    key_findings: { text: string; detail: string; evidence_ids: number[]; ai: boolean }[];
  };
  demand: {
    by_category: Partial<Record<EvidenceCategory, number>>;
    by_source: Record<string, number>;
    date_range: [string, string] | null;
    buying_intent: ReportEvidence[];
    classified: boolean;
  };
  pain_points: Theme[];
  competitors: ReportCompetitor[];
  opportunity: {
    dimensions: Dimension[];
    scored_weight: number;
    assumptions: { text: string; source: "founder" | "ai" }[];
    risks: string[];
    market_size: { status: "unavailable" | "estimated"; reason?: string };
    what_would_change: string[];
  };
  // Absent on reports built before Week 5.
  audience?: { segments: Segment[] };
  distribution?: { channels: Channel[]; threads: ReportEvidence[]; first_ten_plan: PlanStep[] };
  evidence_index: Record<string, ReportEvidence>;
  notes: string[];
};

export type CompetitiveMatrix = {
  report_id: number;
  competitor_count: number;
  pricing: {
    competitor_id: number;
    name: string;
    status: "verified" | "unavailable";
    plans: { name: string; price: string; period?: string }[];
    lowest: { price: string; period: string } | null;
    mixed_periods: boolean;
    has_free: boolean;
    source_url: string;
    retrieved_at: string | null;
  }[];
  features: { feature: string; competitor_ids: number[] }[];
  features_ai_extracted: boolean;
  complaints: { competitor_id: number; name: string; complaints: number; gap: string; evidence_ids: number[] }[];
  gap_candidates: {
    theme: string;
    category: string;
    records: number;
    distinct_sources: number;
    confidence: Level | "";
    evidence_ids: number[];
  }[];
  method: string;
};

export type AssumptionStatus = "untested" | "supported" | "contradicted";

export type Assumption = {
  id: number;
  text: string;
  source: "founder" | "ai";
  status: AssumptionStatus;
  note: string;
  evidence: { id: number; title: string; source_url: string; provider: string; category: string }[];
  created_at: string;
  updated_at: string;
};

export type CompareRow = {
  id: string;
  name: string;
  status: string;
  report_id: number | null;
  generated_at: string | null;
  score: number | null;
  confidence: Level | null;
  recommendation: Recommendation | null;
  evidence_count: number;
  competitor_count: number;
  scored_weight: number | null;
  dimensions: { key: string; label: string; weight: number; score: number | null; available: boolean; confidence: Level }[];
};
