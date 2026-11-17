// Mirrors backend/lab (Week 13). Blocks are plain text only; the public page is rendered by the server on its own origin.

export type HeroBlock = { type: "hero"; headline: string; subheadline?: string; cta_label?: string };
export type ProblemBlock = { type: "problem"; heading?: string; body: string };
export type BenefitsBlock = { type: "benefits"; heading?: string; items: { title: string; body?: string }[] };
export type PriceItem = { name: string; price: string; period?: string; features?: string[] };
export type PricingBlock = {
  type: "pricing";
  heading?: string;
  items: PriceItem[];
  /** Price test (Week 14): variants B and C; variant A is `items`. Each visitor sees one variant. */
  test_variants?: PriceItem[][];
};
export type FaqBlock = { type: "faq"; heading?: string; items: { q: string; a: string }[] };
export type WaitlistBlock = { type: "waitlist"; heading?: string; body?: string; button?: string };
export type Block = HeroBlock | ProblemBlock | BenefitsBlock | PricingBlock | FaqBlock | WaitlistBlock;
export type BlockType = Block["type"];

export type LabPage = {
  id: number;
  title: string;
  slug: string | null;
  blocks: Block[];
  status: "draft" | "published" | "unpublished";
  retention_days: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  url: string | null;
  base_url: string;
  /** Exact consent wording of the live waitlist form (brand filled in, `{days}` left for the retention period). */
  consent_template: string;
  signups: number;
};

/** How much a number based on n people can say (computed by the server; margin is ± as a fraction). */
export type SampleNote = { n: number; level: "none" | "too_small" | "small" | "ok"; margin: number | null; message: string };

export type VariantResult = {
  variant: "A" | "B" | "C";
  prices: { name: string; price: string; period: string }[];
  views: number;
  clicks: number;
  signups: number;
  click_rate: number | null;
  signup_rate: number | null;
  sample: SampleNote;
};

export type Comparison = {
  metric: "signups" | "clicks";
  a: string;
  b: string;
  verdict: "not_enough_data" | "no_clear_difference" | "a_higher" | "b_higher";
  z: number | null;
};

export type PriceTestResults = { active: boolean; variants: VariantResult[]; comparisons: Comparison[]; note: string };

export type LabStats = {
  views: number;
  signups: number;
  conversion: number | null;
  current_signups: number;
  daily: { day: string; views: number; signups: number }[];
  since: string;
  sample: SampleNote;
  price_test: PriceTestResults | null;
};

export type LabSignup = { id: number; email: string | null; joined_at: string; expires_at: string; consent_version: string };

// --- surveys (Week 14) ---

export type QuestionType = "single" | "multi" | "scale" | "text";
export type Question = {
  id: string;
  type: QuestionType;
  prompt: string;
  help?: string;
  options?: string[];
  low_label?: string;
  high_label?: string;
  required?: boolean;
  assumption_id?: number | null;
};

export type Survey = {
  id: number;
  title: string;
  intro: string;
  slug: string | null;
  questions: Question[];
  ask_email: boolean;
  status: "draft" | "published" | "closed" | "unpublished";
  retention_days: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  url: string | null;
  base_url: string;
  consent_preview: string;
  responses: number;
};

export type QuestionResult = {
  id: string;
  type: QuestionType;
  prompt: string;
  answered: number;
  sample: SampleNote;
  assumption_id?: number;
  options?: { label: string; count: number; share: number | null }[];
  note?: string;
  distribution?: { value: number; count: number }[];
  median?: number | null;
  low_label?: string;
  high_label?: string;
};

export type SurveyResults = {
  responses: number;
  views: number;
  response_rate: number | null;
  sample: SampleNote;
  questions: QuestionResult[];
  note: string;
};

export type SurveyResponseRow = {
  id: number;
  submitted_at: string;
  expires_at: string;
  email: string | null;
  answers: { id: string; prompt: string; answer: string | null }[];
};

export type DataNotice = { id: number; source: string; removed: number; created_at: string; seen: boolean };
