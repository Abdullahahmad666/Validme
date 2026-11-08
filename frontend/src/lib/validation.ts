import { z } from "zod";
import type { Objective } from "@/types/api";

// Must match docs/design/screens.md (Step 1) and backend/projects/serializers.py.
export const OBJECTIVES: { value: Objective; label: string }[] = [
  { value: "validate_demand", label: "Validate demand" },
  { value: "pain_points", label: "Pain points" },
  { value: "competitor_analysis", label: "Competitors" },
  { value: "find_market_gaps", label: "Market gaps" },
  { value: "target_audiences", label: "Audiences" },
  { value: "customer_acquisition", label: "Acquisition channels" },
  { value: "pricing", label: "Pricing" },
];

const objectiveValues = OBJECTIVES.map((o) => o.value) as [Objective, ...Objective[]];

export const ideaSchema = z.object({
  name: z.string().trim().min(3, "Use at least 3 characters.").max(80, "Keep it under 80 characters."),
  description: z
    .string()
    .trim()
    .min(30, "Describe your idea in at least 30 characters.")
    .max(2000, "Keep it under 2,000 characters."),
  objectives: z.array(z.enum(objectiveValues)).min(1, "Pick at least one objective."),
  existing_product_url: z
    .union([z.literal(""), z.url({ protocol: /^https?$/, error: "Use a full http:// or https:// URL." })])
    .optional(),
  additional_context: z.string().max(1000, "Keep it under 1,000 characters.").optional(),
});
export type IdeaForm = z.infer<typeof ideaSchema>;

export const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});
export type LoginForm = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters."),
});
export type SignupForm = z.infer<typeof signupSchema>;
