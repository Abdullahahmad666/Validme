// Mirrors backend/lab (Week 13). Blocks are plain text only; the public page is rendered by the server on its own origin.

export type HeroBlock = { type: "hero"; headline: string; subheadline?: string; cta_label?: string };
export type ProblemBlock = { type: "problem"; heading?: string; body: string };
export type BenefitsBlock = { type: "benefits"; heading?: string; items: { title: string; body?: string }[] };
export type PricingBlock = {
  type: "pricing";
  heading?: string;
  items: { name: string; price: string; period?: string; features?: string[] }[];
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
  signups: number;
};

export type LabStats = {
  views: number;
  signups: number;
  conversion: number | null;
  current_signups: number;
  daily: { day: string; views: number; signups: number }[];
  since: string;
};

export type LabSignup = { id: number; email: string | null; joined_at: string; expires_at: string; consent_version: string };
