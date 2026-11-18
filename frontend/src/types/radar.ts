// Mirrors backend/radar. Signals come only from stored sources; relevance/impact/confidence are rule-based,
// ai_rationale / ai_action are AI (labelled in the UI). Third-party text is rendered as plain text.
import type { Level } from "@/types/report";

export type SignalKind = "complaint_theme" | "competitor_change" | "discussion_trend" | "new_competitor";
export type SignalType = "opportunity" | "risk" | "trend";
export type SignalStatus = "new" | "seen" | "dismissed" | "acted";
export type SignalFeedback = "" | "useful" | "not_useful";

export type SignalEvidence = {
  id: number;
  title: string;
  excerpt: string;
  source_url: string;
  provider: string;
  published_at: string | null;
};

export type Signal = {
  id: number;
  kind: SignalKind;
  type: SignalType;
  title: string;
  facts: Record<string, unknown>;
  relevance: number;
  impact: number;
  confidence: Level;
  rank: number;
  ai_rationale: string;
  ai_action: string;
  status: SignalStatus;
  feedback: SignalFeedback;
  discovered_at: string;
  evidence: SignalEvidence[];
  evidence_count: number;
  change: { id: number; summary: string; detected_at: string; page: string } | null;
  candidate: { id: number; name: string; domain: string; launch_post: string } | null;
};

export type ScoreSnapshot = {
  id: number;
  created_at: string;
  source: "report" | "revalidation";
  score: number | null;
  confidence: Level | "";
  recommendation: string;
  evidence_count: number;
  report_id: number | null;
  /** Rules the point was computed with; points from different rules aren't directly comparable. */
  scoring_version?: string;
};
