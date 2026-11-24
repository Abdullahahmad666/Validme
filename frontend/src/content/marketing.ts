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
  { name: "GitHub issues", detail: "Public issues where developers report problems with the tools they use.", status: "supported" },
  {
    name: "YouTube channels",
    detail: "Public channel and video statistics, to show where your audience already watches.",
    status: "limited",
  },
  {
    name: "Search demand",
    detail: "Monthly search volume and keyword difficulty from a licensed keyword-data provider.",
    status: "limited",
  },
];


// ---------------------------------------------------------------------------
// Problem
// ---------------------------------------------------------------------------
export const PROBLEMS = [
  {
    title: "Building without validation",
    body: "Months of nights and weekends go into a product before anyone has confirmed that people want it, or will pay for it.",
    fix: "Check demand first: a score built from real conversations, with how sure it is, before you write code. Then test it with a landing page or survey.",
  },
  {
    title: "Research scattered everywhere",
    body: "Forum threads, search results, reviews and competitor pages live in twenty tabs. Connecting them into a clear picture takes days.",
    fix: "One report: every quote kept with its link and dates, grouped into themes and ranked by how many different people raised them.",
  },
  {
    title: "No clear distribution strategy",
    body: "Even a good product stalls when you don't know who your first customers are or where they actually spend their time.",
    fix: "A first-10-customers plan: the places your audience already talks, taken from the evidence itself.",
  },
  {
    title: "The market moves after you research",
    body: "Competitors change prices and features, new ones launch, and a one-off look goes stale within weeks.",
    fix: "It keeps watching: competitor pages re-read on a schedule, your score re-checked weekly, and a digest email when something matters.",
  },
] as const;

// ---------------------------------------------------------------------------
// Why not just ask an AI chat? (facts about ValidMe's own features; fair about chat assistants)
// ---------------------------------------------------------------------------
export const DIFFERENTIATORS = [
  {
    id: "evidence",
    title: "Evidence you can check",
    chat: "An answer you trust, or verify yourself",
    us: "Every finding links to the quotes behind it, with dates and how sure it is.",
  },
  {
    id: "competitors",
    title: "Keeps watching competitors",
    chat: "Only when you think to ask again",
    us: "Re-reads competitor pages on a schedule (daily on paid plans) and flags price and feature changes.",
  },
  {
    id: "recheck",
    title: "Re-checks your idea",
    chat: "A snapshot of the moment you asked",
    us: "Re-checks your score every week as evidence ages and new signals arrive.",
  },
  {
    id: "digest",
    title: "Tells you what changed",
    chat: "Nothing until you open it",
    us: "A Monday digest email with the changes that matter, each linked to its evidence.",
  },
  {
    id: "lab",
    title: "Tests with real people",
    chat: "Can draft a survey; you run it elsewhere",
    us: "Landing pages, price tests and surveys, and real sign-ups count for more than research.",
  },
  {
    id: "customers",
    title: "Finds your first customers",
    chat: "General ideas for channels",
    us: "The places your audience already talks, taken from the evidence itself.",
  },
] as const;

/** Illustrative month with ValidMe (labelled "Sample data" on the page). */
export const KEEPS_WORKING = [
  { id: "report", when: "Day 1", title: "Report ready", detail: "72/100 · medium confidence · 31 sourced records" },
  { id: "price", when: "Week 1", title: "Competitor A changed its pricing", detail: "$129 → $149 a month, read from its pricing page" },
  { id: "signal", when: "Week 2", title: "New signal on your Radar", detail: "4 new threads about manual stock counts" },
  { id: "survey", when: "Week 3", title: "Your survey answered", detail: "24 answers support “owners would pay $29 a month”" },
  { id: "digest", when: "Monday", title: "Weekly digest in your inbox", detail: "The 3 changes that matter, each linked to its source" },
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
      `Up to ${FREE.aiSummariesPerDay} AI summaries a day`,
      "Opportunity Radar",
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
      `Everything in ${FREE.name}`,
      "Quick, Standard and Deep research",
      "Full evidence explorer",
      `Watch ${watchesLabel(F.watches)}, checked daily`,
      `Up to ${F.aiSummariesPerDay} AI summaries a day`,
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
      `Up to ${P.aiSummariesPerDay} AI summaries a day`,
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
    feature: "AI summaries per day (competitor changes and Radar)",
    free: String(FREE.aiSummariesPerDay),
    founder: String(F.aiSummariesPerDay),
    pro: String(P.aiSummariesPerDay),
  },
  { feature: "Opportunity Radar", free: "Included", founder: "Included", pro: "Included" },
  {
    feature: "Keyword search-demand look-ups per month",
    free: String(FREE.keywordLookups),
    founder: String(F.keywordLookups),
    pro: String(P.keywordLookups),
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
    a: "Web search, Hacker News, Stack Exchange, GitHub issues, competitor websites you list and links you add. For finding customers it can also look up YouTube channels and keyword search volumes (from DataForSEO) when you ask. We only use sources we're permitted to use, and every report lists exactly which sources it searched, so you always know the coverage behind a finding. If you've found a relevant discussion yourself, you can add its link as evidence.",
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
// Product walkthrough video slot (landing page "See it in action").
// With `src` set the section shows the player; with `src: null` it falls back to the code-drawn walkthrough.
// The video has no speech (music only), so it carries no captions track; `shows` is its text alternative,
// listing exactly what appears on screen. It uses an example project with illustrative data, labelled in the
// video and under the player.
// ---------------------------------------------------------------------------
export type DemoCredit = { track: string; author: string; sourceUrl: string; license: string; licenseUrl: string };

export type DemoVideo = {
  src: string | null;
  poster: string | null;
  captions: string | null; // WebVTT path, required once a narrated version exists
  title: string;
  /** Short, factual description for structured data: leads with the example-data disclaimer. */
  summary: string;
  /** ISO 8601 duration and publish date-time, for the VideoObject structured data. */
  duration: string;
  uploadDate: string;
  note: string;
  credit: DemoCredit;
  /** Text alternative: everything on screen, in order, on-screen words quoted exactly. */
  shows: readonly string[];
};

export const DEMO_VIDEO: DemoVideo = {
  src: "/demo/validme-demo.mp4",
  poster: "/demo/validme-demo-poster.jpg",
  captions: null,
  title: `${BRAND_NAME} product walkthrough`,
  summary: `A 45-second walkthrough of ${BRAND_NAME} using an example project with illustrative data: describe an idea, gather evidence, read the score and how sure it is, check a finding's source, rank the pain points and see where customers already talk.`,
  duration: "PT45S",
  uploadDate: "2026-11-20T12:00:00+00:00",
  note: "Example project with illustrative data, not a real customer’s research. Music only, no narration: everything on screen is described below.",
  credit: {
    track: "Happy Beats / Business Moves Vol. 1",
    author: "Sascha Ende",
    sourceUrl: "https://ende.app/en",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  },
  shows: [
    "Title: “Before you build it, find out if people actually want it.” A card labelled “Your idea” types in “A phone app that lets small cafés count stock in minutes”.",
    "Three guesses appear and are struck out: “My friends love it”, “Feels like a big market”, “I’d use it myself”. Then: “Guesses aren’t evidence.”",
    "The idea becomes the description in the new-research form (“Let’s understand your idea.”); the project name “Stock counting for small cafés” is typed in and the cursor clicks “Understand my idea”.",
    "On a blue screen: “Reading what people already wrote”, a count rising to “36 evidence records found”, and seven example source sites (cafeowners.example, hospitality-forum.example, smallbiz-qa.example, baristas.example, foodservice-talk.example, indie-retail.example, kitchen-ops.example). From here on, a label reads “Example project · illustrative data”.",
    "The report for “Stock counting for small cafés”. Caption: “A score, and how sure it is”. The opportunity score ring fills to “81 out of 100”, marked “Low confidence”, with “Based on 75% of the scoring model; the rest needs evidence this research can’t provide.” and the verdict “Research more before deciding”.",
    "Caption: “Every finding links to its source”. The key finding “Weekly stock counts take hours” (AI theme, 8 sources, medium confidence) quotes “Every Sunday I spend about three hours counting milk, beans and cups on a clipboard.”; the cursor clicks its source link.",
    "The evidence explorer opens on that quote’s row, with the link https://cafeowners.example/t/1000. A notice above the table reads “Free preview: you can browse the 10 most relevant of 36 records. Your report still links every source it cites. A plan or any credit pack unlocks all of them”.",
    "Caption: “See what hurts most”. A chart, “Themes by number of separate sources” (AI themes): Weekly stock counts take hours 8; Over-ordering and waste 6; Would pay for a simple counting app 6; Spreadsheets break when staff change 5; Count by scanning on a phone 4; Existing tools are built for chains 4; Questions about how often to count 3.",
    "Caption: “Find where your first 10 customers already talk”. Six cards land, one per example forum, each saying how many threads discuss the problem; the camera moves into cafeowners.example. Caption: “Read the threads. Answer in public.”",
    `“Stop building on assumptions. Start building on evidence.” Then the ${BRAND_NAME} logo, a “Validate my idea” button and the line “Example data shown · Music: Sascha Ende, ende.app (CC BY 4.0)”.`,
  ],
};
