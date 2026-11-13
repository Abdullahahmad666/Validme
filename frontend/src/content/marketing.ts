/**
 * Marketing copy and illustrative sample data, kept apart from presentation.
 * Rules (CLAUDE.md): no fabricated testimonials, metrics, prices or platform coverage.
 * Anything that looks like data here is SAMPLE data and every component that renders it
 * shows a visible "Sample data" label.
 */
import {
  PACK_PRICES,
  PAID_PRICES_SENTENCE,
  PLAN_PRICES,
  usd,
  WATCHES_PER_PROJECT,
  watchesLabel,
  yearlySavingMonths,
} from "@/content/pricing";
import { BRAND_NAME } from "@/lib/brand";

export const NAV_LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#use-cases", label: "Use cases" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
] as const;

export const CTA = {
  signup: "/signup",
  login: "/login",
  sampleReport: "/sample-report",
} as const;

// ---------------------------------------------------------------------------
// Sources — must match docs/data-sources.md and backend/research/providers/registry.py
// ---------------------------------------------------------------------------
// Only sources we search (or are rolling out) are named on the marketing site.
export type SourceStatus = "supported" | "limited";

export const SOURCES: { name: string; detail: string; status: SourceStatus }[] = [
  { name: "Web search", detail: "Search results via a licensed search API.", status: "supported" },
  { name: "Hacker News", detail: "Founder and developer discussions via the public API.", status: "supported" },
  { name: "Competitor websites", detail: "Public pricing and feature pages you list, with the date we read them.", status: "supported" },
  { name: "Links you add", detail: "Threads, reviews or articles you found yourself.", status: "supported" },
  { name: "Stack Exchange", detail: "Public Q&A, with attribution links kept.", status: "supported" },
  { name: "GitHub issues", detail: "Public issues on competitor or open-source repos. Planned.", status: "limited" },
];

// ---------------------------------------------------------------------------
// Problem
// ---------------------------------------------------------------------------
export const PROBLEMS = [
  {
    title: "Building without validation",
    body: "Months of nights and weekends go into a product before anyone has confirmed that people want it, or will pay for it.",
  },
  {
    title: "Research scattered everywhere",
    body: "Forum threads, search results, reviews and competitor pages live in twenty tabs. Connecting them into a clear picture takes days.",
  },
  {
    title: "No clear distribution strategy",
    body: "Even a good product stalls when you don't know who your first customers are or where they actually spend their time.",
  },
] as const;

// ---------------------------------------------------------------------------
// How it works
// ---------------------------------------------------------------------------
export const STEPS = [
  {
    n: "01",
    title: "Describe your idea",
    body: "Write the problem or product in your own words. No templates, no jargon. Confirm how we understood it before anything runs.",
  },
  {
    n: "02",
    title: "Discover the market",
    body: `${BRAND_NAME} searches the sources available to it and stores every useful finding as evidence, with its link and date.`,
  },
  {
    n: "03",
    title: "Validate the opportunity",
    body: "See demand signals, recurring pain points, competitors and gaps, each one traceable back to the evidence behind it.",
  },
  {
    n: "04",
    title: "Plan distribution",
    body: "Get customer segments, channels and a first-10-customers plan, with researched channels kept apart from hypotheses.",
  },
] as const;

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------
export const FEATURES = [
  {
    id: "evidence",
    eyebrow: "Evidence-backed validation",
    title: "Don't just get an AI opinion. Get the evidence behind it.",
    body: "Every finding links to the records that support it: the original source, when it was published, when we read it, and how confident the analysis is.",
    outcome: "Decide with receipts, not vibes.",
    points: ["Evidence records with source links", "Customer pain points", "Demand signals", "Confidence levels"],
  },
  {
    id: "competitors",
    eyebrow: "Competitor intelligence",
    title: "Your competitors have customers. Their customers have complaints.",
    body: "Find who you're up against, what they charge and claim, where customers say they fall short, and which gaps nobody covers well.",
    outcome: "Position against real weaknesses.",
    points: ["Competitor discovery", "Pricing with the date it was read", "Feature and positioning analysis", "Complaints and market gaps"],
  },
  {
    id: "audience",
    eyebrow: "Audience intelligence",
    title: "Know exactly who you're building for.",
    body: "Break a vague market into concrete segments: what they need, what motivates them to buy, where they are, and how reachable they are.",
    outcome: "Build for one customer, not everyone.",
    points: ["Customer segments", "Buyer motivations", "Geography", "Needs and accessibility"],
  },
  {
    id: "distribution",
    eyebrow: "Distribution strategy",
    title: "Finding demand is only half the game. Reaching it is the other half.",
    body: "See the communities, searches and channels where your audience already is, plus positioning angles and a concrete plan for your first ten customers.",
    outcome: "Know your first move after validation.",
    points: ["Relevant communities", "Search opportunities", "Acquisition channels", "First-customer action plan"],
  },
] as const;

// ---------------------------------------------------------------------------
// Use cases
// ---------------------------------------------------------------------------
export const USE_CASES = [
  {
    title: "Indie hackers",
    body: "Validate your next micro-SaaS before spending weeks building it.",
    detail: "Run a quick report on three ideas and put your weekends into the one with evidence.",
  },
  {
    title: "Startup founders",
    body: "Understand your market, competitors and opportunities before launch.",
    detail: "Walk into investor and customer conversations knowing the landscape and its gaps.",
  },
  {
    title: "Developers and builders",
    body: "Turn your technical skills into products with real market demand.",
    detail: "Start from a problem people are already describing, not from a stack you want to try.",
  },
] as const;

// ---------------------------------------------------------------------------
// Pricing — numbers come from src/content/pricing.ts (the catalog that matches Lemon Squeezy).
// Features listed here must match what the backend enforces (PLAN_LIMITS) and what every plan can use today.
// ---------------------------------------------------------------------------
const F = PLAN_PRICES.founder;
const P = PLAN_PRICES.pro;
const FREE = PLAN_PRICES.free;

export const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "",
    priceNote: "No card required",
    blurb: "See how evidence-backed validation works.",
    allowance: "1 Quick report after you verify your email",
    cta: "Start free",
    features: [
      "Quick research depth",
      "Evidence explorer preview",
      `Watch ${watchesLabel(FREE.watches)}, checked weekly`,
      `Up to ${FREE.aiSummariesPerDay} AI change summaries a day`,
      "Weekly digest email",
    ],
    recommended: false,
  },
  {
    id: "founder",
    name: F.name,
    price: usd(F.month!),
    period: "/month",
    priceNote: `or ${usd(F.year!)}/year (${yearlySavingMonths(F)} months free)`,
    blurb: "Validate seriously and keep an eye on the market.",
    allowance: `${F.monthlyCredits} research credits every month`,
    cta: "Start free, upgrade in the app",
    features: [
      "Quick, Standard and Deep research",
      "Full evidence explorer",
      `Watch ${watchesLabel(F.watches)}, checked daily`,
      `Up to ${F.aiSummariesPerDay} AI change summaries a day`,
      "Cancel any time",
    ],
    recommended: true,
  },
  {
    id: "pro",
    name: P.name,
    price: usd(P.month!),
    period: "/month",
    priceNote: `or ${usd(P.year!)}/year (${yearlySavingMonths(P)} months free)`,
    blurb: "For founders researching and tracking several ideas.",
    allowance: `${P.monthlyCredits} research credits every month`,
    cta: "Start free, upgrade in the app",
    features: [
      `Everything in ${F.name}`,
      `Watch ${watchesLabel(P.watches)}, checked daily`,
      `Up to ${P.aiSummariesPerDay} AI change summaries a day`,
      `${P.maxRunning} research jobs at once`,
      "Cancel any time",
    ],
    recommended: false,
  },
] as const;

/** One-off credit packs, for founders who'd rather not subscribe. */
export const PACKS = PACK_PRICES.map((p) => ({ ...p, label: usd(p.price) }));

export const CREDIT_EXPLAINER = [
  { depth: "Quick", credits: 1, body: "A fast read on demand and the obvious competitors." },
  { depth: "Standard", credits: 2, body: "The recommended depth: more queries, sources and evidence." },
  { depth: "Deep", credits: 4, body: "The widest search budget for ideas you're close to committing to." },
] as const;

export const PLAN_COMPARISON: { feature: string; free: string; founder: string; pro: string }[] = [
  {
    feature: "Research credits",
    free: "1 Quick report",
    founder: `${F.monthlyCredits} per month`,
    pro: `${P.monthlyCredits} per month`,
  },
  { feature: "Research depth", free: "Quick", founder: "Quick, Standard, Deep", pro: "Quick, Standard, Deep" },
  { feature: "Evidence explorer", free: "Preview", founder: "Full", pro: "Full" },
  {
    feature: "Competitor pages watched",
    free: String(FREE.watches),
    founder: String(F.watches),
    pro: `${P.watches} (up to ${WATCHES_PER_PROJECT} per project)`,
  },
  { feature: "Page checks", free: "Weekly", founder: "Daily or weekly", pro: "Daily or weekly" },
  {
    feature: "AI change summaries per day",
    free: String(FREE.aiSummariesPerDay),
    founder: String(F.aiSummariesPerDay),
    pro: String(P.aiSummariesPerDay),
  },
  { feature: "Weekly digest email", free: "Included", founder: "Included", pro: "Included" },
  { feature: "Research jobs at once", free: String(FREE.maxRunning), founder: String(F.maxRunning), pro: String(P.maxRunning) },
  { feature: "Report export", free: "Markdown / PDF", founder: "Markdown / PDF", pro: "Markdown / PDF" },
];

// ---------------------------------------------------------------------------
// FAQ — answers must stay accurate to what the product does today.
// ---------------------------------------------------------------------------
export const FAQS = [
  {
    q: `What is ${BRAND_NAME}?`,
    a: `${BRAND_NAME} is a market research tool for founders. You describe an idea; it collects evidence from the sources available to it, then turns that evidence into demand signals, pain points, competitor gaps, audience segments and a plan for finding your first customers.`,
  },
  {
    q: `How does ${BRAND_NAME} validate an idea?`,
    a: "It generates focused search queries from your idea, collects results from supported sources, removes duplicates, classifies each record (for example pain point, buying intent or feature request) and groups them into themes. Scores and recommendations are computed from that evidence, and each finding links back to it.",
  },
  {
    q: `Which sources does ${BRAND_NAME} search?`,
    a: "Web search, Hacker News, Stack Exchange, competitor websites you list and links you add, with GitHub issues planned. We only use sources we're permitted to use, and every report lists exactly which sources it searched, so you always know the coverage behind a finding. If you've found a relevant discussion yourself, you can add its link as evidence.",
  },
  {
    q: "Are the research findings based on real data?",
    a: "Yes. Findings come from stored evidence records with their source link and dates. AI is used to interpret that evidence, and those interpretations are labelled separately. When data is missing, the report says \"unavailable\" instead of filling the gap.",
  },
  {
    q: `Can ${BRAND_NAME} identify competitors?`,
    a: "Yes. It discovers competitors through search and any URLs you provide, reads their public pricing and feature pages, records when they were read, and highlights complaints and gaps. Pricing that can't be verified is marked as unavailable.",
  },
  {
    q: "What are TAM, SAM and SOM?",
    a: "Total Addressable Market is everyone who could have the problem; Serviceable Available Market is the part you can realistically serve; Serviceable Obtainable Market is the share you could plausibly win early on. Estimates show their assumptions and sources and are never presented as guaranteed revenue.",
  },
  {
    q: `Can ${BRAND_NAME} help me find paying customers?`,
    a: `It shows where your audience gathers, which channels look promising (marked as researched or hypothesis) and a first-10-customers action plan. It doesn't contact anyone on your behalf: there's no automated outreach.`,
  },
  {
    q: "How much does market research cost?",
    a: `Reports use credits: Quick = 1, Standard = 2, Deep = 4. Your first Quick report is free after you verify your email. ${PAID_PRICES_SENTENCE}, with research credits included each month; one-off credit packs start at ${usd(PACK_PRICES[0].price)}.`,
  },
  {
    q: "Can I cancel my subscription?",
    a: "Yes, any time, from Manage subscription on the Plan & credits page. You keep your plan until the end of the period you've paid for, and research credits you already have don't expire.",
  },
  {
    q: "Is my idea private?",
    a: "Your projects are visible only to your account. To research an idea, search queries derived from it are sent to our search and AI providers. We don't publish or share your ideas.",
  },
] as const;

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------
export const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#product", label: "Features" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/pricing", label: "Pricing" },
      { href: "/sample-report", label: "Sample report" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/blog", label: "Blog" },
      { href: "/guides", label: "Startup guides" },
      { href: "/glossary", label: "Market research glossary" },
      { href: "/tools/unit-economics", label: "Unit economics calculator" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/feedback", label: "Feedback" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms of service" },
      { href: "/cookies", label: "Cookie policy" },
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// Product walkthrough animation / video slot (landing page "See it in action").
// Drop a file in /public (e.g. /videos/validme-demo.mp4 + a poster image) and set the
// paths here; the section switches from the storyboard placeholder to the player.
// ---------------------------------------------------------------------------
export const DEMO_VIDEO: { src: string | null; poster: string | null; captions: string | null } = {
  src: null,
  poster: null,
  captions: null, // WebVTT path, required for accessibility once a narrated video exists
};
