/**
 * llms.txt (https://llmstxt.org) — a plain Markdown map of the site for AI assistants and answer
 * engines (GEO/AEO). Generated from the same content the pages render, so it can't drift.
 * Facts only: no claims beyond what the product does today.
 */
import { GLOSSARY_TERMS } from "@/content/glossary";
import { CREDIT_EXPLAINER, FAQS, FEATURES, PACKS, PLANS, SOURCES, STEPS } from "@/content/marketing";
import { PAGE_KEYS, PAGES } from "@/content/seo";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { absoluteUrl } from "@/lib/seo";

function header(): string[] {
  return [
    `# ${BRAND_NAME}`,
    "",
    `> ${BRAND_NAME} is an evidence-first market research tool for indie founders. Describe a startup idea and it collects source-linked evidence to show demand signals, customer pain points, competitors and market gaps, then suggests audiences, channels and a first-10-customers plan. ${BRAND_TAGLINE}`,
    "",
    "Key facts:",
    "- Every finding links to stored evidence with its source URL, publish date and retrieval date.",
    "- Original evidence, AI interpretation and user assumptions are kept separate and labelled.",
    "- Missing data is reported as \"unavailable\" rather than estimated.",
    `- Sources searched: ${SOURCES.filter((s) => s.status === "supported").map((s) => s.name).join(", ")}. Rolling out: ${SOURCES.filter((s) => s.status === "limited").map((s) => s.name).join(", ")}.`,
    `- Pricing: research uses credits (${CREDIT_EXPLAINER.map((c) => `${c.depth} = ${c.credits}`).join(", ")}). Free plan: ${PLANS[0].allowance}. ${PLANS.slice(1).map((p) => `${p.name}: ${p.price}${p.period} (${p.priceNote})`).join("; ")}. One-off credit packs: ${PACKS.map((p) => `${p.credits} credits for ${p.label}`).join(", ")}.`,
    "- No automated outreach: it shows where customers are; it never contacts anyone.",
    "",
  ];
}

function pagesSection(): string[] {
  const lines = ["## Pages", ""];
  for (const key of PAGE_KEYS) {
    const p = PAGES[key];
    if (!p.index) continue;
    lines.push(`- [${p.label}](${absoluteUrl(p.path)}): ${p.description}`);
  }
  return [...lines, ""];
}

export function buildLlmsTxt(): string {
  return [
    ...header(),
    ...pagesSection(),
    "## Optional",
    "",
    `- [Full reference](${absoluteUrl("/llms-full.txt")}): product details, FAQ and glossary in one file.`,
    "",
  ].join("\n");
}

export function buildLlmsFullTxt(): string {
  return [
    ...header(),
    "## How it works",
    "",
    ...STEPS.map((s) => `${Number(s.n)}. **${s.title}.** ${s.body}`),
    "",
    "## Capabilities",
    "",
    ...FEATURES.flatMap((f) => [`### ${f.eyebrow}`, "", f.body, "", ...f.points.map((pt) => `- ${pt}`), ""]),
    "## Plans",
    "",
    ...PLANS.map((p) => `- **${p.name}** (${p.price}${p.period}): ${p.blurb} ${p.allowance}. Includes: ${p.features.join(", ")}.`),
    "",
    "## Frequently asked questions",
    "",
    ...FAQS.flatMap((f) => [`### ${f.q}`, "", f.a, ""]),
    "## Glossary",
    "",
    ...GLOSSARY_TERMS.map((t) => `- **${t.term}:** ${t.def}`),
    "",
    ...pagesSection(),
  ].join("\n");
}
