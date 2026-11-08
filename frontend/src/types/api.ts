// Mirrors backend serializers. Keep in sync with backend/*/serializers.py.
export type Availability = "AVAILABLE" | "LIMITED" | "REQUIRES_CONNECTION" | "UNAVAILABLE";

export type ResearchSource = { key: string; label: string; contributes: string; availability: Availability };

export type ProjectStatus = "DRAFT" | "RESEARCHING" | "COMPLETED" | "ARCHIVED";

export type CustomerType = "B2B" | "B2C" | "B2B2C";

export type Objective =
  | "validate_demand"
  | "pain_points"
  | "competitor_analysis"
  | "find_market_gaps"
  | "target_audiences"
  | "customer_acquisition"
  | "pricing";

export type Project = {
  id: string;
  name: string;
  status: ProjectStatus;
  description: string;
  objectives: Objective[];
  existing_product_url: string;
  additional_context: string;
  audiences: string[];
  geographies: string[];
  customer_type?: CustomerType | "";
  created_at: string;
  updated_at: string;
};

export type ProjectInput = {
  name: string;
  description: string;
  objectives: Objective[];
  existing_product_url?: string;
  additional_context?: string;
  audiences?: string[];
  geographies?: string[];
  customer_type?: CustomerType;
};

export type DashboardSummary = { projects: number; reports: number; evidence: number; active_jobs: number };

export type Me = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  credits: number;
  date_joined: string;
};

export type ApiKey = {
  id: number;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked: boolean;
};

export type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };

export type ApiErrorBody = { error: { code: string; message: string; details?: Record<string, unknown> } };
