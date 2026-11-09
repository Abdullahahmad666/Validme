// Mirrors backend serializers. Keep in sync with backend/*/serializers.py.
export type Availability = "AVAILABLE" | "LIMITED" | "REQUIRES_CONNECTION" | "UNAVAILABLE";

export type StageName =
  | "idea_analysis"
  | "web_research"
  | "community_research"
  | "evidence_analysis"
  | "competitor_analysis"
  | "report";

export type ResearchSource = {
  key: string;
  label: string;
  contributes: string;
  availability: Availability;
  stage: StageName | null;
  uses_queries: boolean;
};

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

export type BusinessStage = "idea" | "mvp" | "launched" | "existing";
export type Depth = "quick" | "standard" | "deep";
export type CompetitorAspect = "features" | "pricing" | "audience" | "positioning" | "complaints" | "gaps";
export type AISuggestedField = "industry" | "customer_type" | "audiences" | "geographies";

/** AI restatement of the idea. Stored apart from the founder's own words; never overwrites them. */
export type Interpretation = {
  problem: string;
  solution: string;
  target_customers: string[];
  category: string;
  industry: string;
  customer_type: CustomerType;
  suggested_audiences: string[];
  suggested_geographies: string[];
  assumptions: string[];
  clarifying_questions: string[];
};

export type Project = {
  id: string;
  name: string;
  status: ProjectStatus;
  // Step 1 — idea
  description: string;
  objectives: Objective[];
  existing_product_url: string;
  additional_context: string;
  ai_interpretation: Interpretation | Record<string, never>;
  interpretation_confirmed: boolean;
  // Step 2 — market
  industry: string;
  customer_type: CustomerType | "";
  audiences: string[];
  geographies: string[];
  business_stage: BusinessStage | "";
  current_alternatives: string;
  price_hypothesis: string;
  ai_suggested_fields: AISuggestedField[];
  // Step 3 — research configuration
  sources: string[];
  depth: Depth;
  competitor_discovery: boolean;
  competitor_urls: string[];
  evidence_urls: string[];
  competitor_aspects: CompetitorAspect[];
  exclude_terms: string[];
  created_at: string;
  updated_at: string;
};

type ReadOnlyProjectFields = "id" | "status" | "ai_interpretation" | "created_at" | "updated_at";
export type ProjectPatch = Partial<Omit<Project, ReadOnlyProjectFields>>;
export type ProjectInput = Pick<Project, "name" | "description" | "objectives"> & ProjectPatch;

export const hasInterpretation = (p: Pick<Project, "ai_interpretation">): p is { ai_interpretation: Interpretation } =>
  "problem" in p.ai_interpretation;

export type QueryIntent = "problem_discovery" | "buying_intent" | "competitor_gaps" | "customer_acquisition";

export type ResearchQuery = {
  id: number;
  text: string;
  intent: QueryIntent;
  enabled: boolean;
  ai_generated: boolean;
  user_modified: boolean;
};

export type Estimate = {
  depth: Depth;
  credits: number;
  balance: number;
  balance_after: number;
  sufficient: boolean;
  budget: { queries: number; results_per_query: number; max_usd: number };
};

export type JobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "PARTIALLY_COMPLETED" | "FAILED" | "CANCELLED";
export type StageStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "SKIPPED";
export type CoverageStatus = "COMPLETED" | "FAILED" | "UNAVAILABLE" | "SKIPPED";

export type JobStage = {
  name: StageName;
  status: StageStatus;
  detail: string;
  started_at: string | null;
  finished_at: string | null;
};

export type ResearchJob = {
  id: string;
  project_id: string;
  status: JobStatus;
  depth: Depth;
  coverage: Record<string, CoverageStatus>;
  credits_charged: number;
  stages: JobStage[];
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
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
