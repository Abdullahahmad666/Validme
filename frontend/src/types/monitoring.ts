// Mirrors backend/monitoring + notifications APIs. Third-party text (labels, diffs, errors) is rendered as plain text only.

export type Cadence = "daily" | "weekly";
export type WatchStatus = "pending" | "baseline" | "unchanged" | "changed" | "error" | "blocked" | "paused";

export type Watch = {
  id: number;
  url: string;
  label: string;
  cadence: Cadence;
  active: boolean;
  competitor: { id: number; name: string } | null;
  changes: number;
  last_status: WatchStatus;
  last_error: string;
  last_checked_at: string | null;
  next_run_at: string;
  created_at: string;
};

export type Significance = "high" | "medium" | "low";

export type Change = {
  id: number;
  watch: { id: number; label: string; url: string };
  kind: "pricing" | "content";
  significance: Significance;
  summary: string;
  ai_summary: string;
  ai_watch_for: string;
  details: {
    prices_added?: string[];
    prices_removed?: string[];
    blocks_added?: string[];
    blocks_removed?: string[];
    blocks_added_total?: number;
    blocks_removed_total?: number;
  };
  detected_at: string;
  before_at: string | null;
  after_url: string;
  seen: boolean;
  project?: { id: string; name: string };
};

/** A possible new competitor found in recent public launches (Show HN). Never watched until the founder accepts. */
export type CompetitorCandidate = {
  id: number;
  domain: string;
  name: string;
  url: string;
  source_url: string;
  source: "hackernews";
  found_at: string;
  status: "new" | "accepted" | "dismissed";
};

export type AppNotification = {
  id: number;
  kind: string;
  title: string;
  body: string;
  link: string;
  created_at: string;
  read: boolean;
};
