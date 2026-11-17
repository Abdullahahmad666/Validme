import type { Block, BlockType, Comparison, PriceItem, Question, QuestionType } from "@/types/lab";

export const BLOCK_LABELS: Record<BlockType, string> = {
  hero: "Hero",
  problem: "Problem",
  benefits: "Benefits",
  pricing: "Price points",
  faq: "FAQ",
  waitlist: "Waitlist form",
};

/** A new, valid block of each type, ready to edit. */
export function emptyBlock(type: BlockType): Block {
  switch (type) {
    case "hero":
      return { type, headline: "Your headline", subheadline: "", cta_label: "Join the waitlist" };
    case "problem":
      return { type, heading: "The problem", body: "Describe the problem in your customer's words." };
    case "benefits":
      return { type, heading: "What it would do", items: [{ title: "First benefit", body: "" }] };
    case "pricing":
      return { type, heading: "Pricing we're considering", items: [{ name: "Starter", price: "$0", period: "/month", features: [] }] };
    case "faq":
      return { type, heading: "Questions", items: [{ q: "When will it be available?", a: "We haven't decided yet." }] };
    case "waitlist":
      return { type, heading: "Join the waitlist", body: "Be the first to hear when it's ready.", button: "Join the waitlist" };
  }
}

/** A starting page from the idea: its name as the headline, plus the waitlist form. The founder writes the rest. */
export function starterBlocks(name: string): Block[] {
  return [{ ...(emptyBlock("hero") as Extract<Block, { type: "hero" }>), headline: name.slice(0, 90) }, emptyBlock("waitlist")];
}

/** Mirrors the backend's link check, so the editor can warn before saving. */
const LINKY =
  /\b(?:https?:\/\/|ftp:\/\/|www\.)|\b[a-z0-9-]+\.(?:com|net|org|io|app|co|ai|dev|xyz|link|ly|me|info|biz|ru|cn|tk)\b|[\w.+-]+@[\w-]+\.[\w.]+/i;

export function hasLink(text: string): boolean {
  return LINKY.test(text);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 48)
    .replace(/-+$/g, "");
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export const RETENTION_OPTIONS = [30, 90, 180, 365] as const;

// --- price tests and surveys (Week 14) ---

export const MAX_VARIANTS = 3;
export const VARIANT_NAMES = ["A", "B", "C"] as const;

/** Variant A is the block's own prices; B and C live in test_variants. */
export function variantsOf(block: Extract<Block, { type: "pricing" }>): PriceItem[][] {
  return [block.items, ...(block.test_variants ?? [])].slice(0, MAX_VARIANTS);
}

/** Write variants back: A into items, the rest into test_variants (dropped entirely when there are none). */
export function withVariants(block: Extract<Block, { type: "pricing" }>, variants: PriceItem[][]): Extract<Block, { type: "pricing" }> {
  const [a, ...rest] = variants;
  const next = { ...block, items: a ?? block.items };
  if (rest.length) return { ...next, test_variants: rest };
  delete next.test_variants;
  return next;
}

/** A new variant starts as a copy of A, so the founder only changes the prices they want to test. */
export function copyVariant(items: PriceItem[]): PriceItem[] {
  return items.map((it) => ({ ...it, features: [...(it.features ?? [])] }));
}

export const QUESTION_LABELS: Record<QuestionType, string> = {
  single: "One choice",
  multi: "Several choices",
  scale: "Scale 1–5",
  text: "Short text",
};

/** The lowest free id (q1..q99): ids keep answers attached to their question. */
export function nextQuestionId(questions: Question[]): string {
  const used = new Set(questions.map((q) => q.id));
  for (let n = 1; n < 100; n++) if (!used.has(`q${n}`)) return `q${n}`;
  return "q99";
}

export function emptyQuestion(type: QuestionType, id: string): Question {
  switch (type) {
    case "single":
    case "multi":
      return { id, type, prompt: "", options: ["", ""], required: false };
    case "scale":
      return { id, type, prompt: "", low_label: "Not at all", high_label: "Very much", required: false };
    case "text":
      return { id, type, prompt: "", required: false };
  }
}

/** Turn a question into another type, keeping its id, wording and linked assumption. */
export function changeType(q: Question, type: QuestionType): Question {
  const next: Question = { ...emptyQuestion(type, q.id), prompt: q.prompt, required: q.required ?? false, assumption_id: q.assumption_id ?? null };
  if ((type === "single" || type === "multi") && q.options?.length) next.options = q.options;
  return next;
}

/** Mirrors the server: once a survey has answers, ids, types and options are fixed (wording isn't). */
export function structureOf(questions: Question[]): string {
  return JSON.stringify(questions.map((q) => [q.id, q.type, (q.options ?? []).map((o) => o.toLowerCase())]));
}

export function pct(share: number | null | undefined, digits = 0): string {
  return share === null || share === undefined ? "—" : `${(share * 100).toFixed(digits)}%`;
}

/** Plain words for a variant comparison. Never claims a winner the numbers don't support. */
export function comparisonText(c: Comparison): string {
  const what = c.metric === "signups" ? "sign-up rate" : "“choose” rate";
  switch (c.verdict) {
    case "not_enough_data":
      return `${c.a} vs ${c.b} (${what}): not enough views yet to tell them apart.`;
    case "no_clear_difference":
      return `${c.a} vs ${c.b} (${what}): no clear difference so far.`;
    case "a_higher":
      return `${c.a} vs ${c.b} (${what}): ${c.a} is clearly higher among the people you reached.`;
    case "b_higher":
      return `${c.a} vs ${c.b} (${what}): ${c.b} is clearly higher among the people you reached.`;
  }
}
