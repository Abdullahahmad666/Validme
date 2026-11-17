import type { Block, BlockType } from "@/types/lab";

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
