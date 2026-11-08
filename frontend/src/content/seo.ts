/**
 * SEO / social / AI-search registry: the single source of truth for every public page.
 *
 * Adding a public page? Add an entry here, then in the page:
 *   export const metadata = pageMetadata("<key>");
 *   <PageJsonLd page="<key>" />
 * Social images (/og/<key>/og.png, /og/<key>/x.png), sitemap, breadcrumbs and llms.txt are
 * generated from this entry automatically. `src/content/seo.test.ts` fails if a page is missing.
 */
import type { MetadataRoute } from "next";
import { BRAND_NAME } from "@/lib/brand";

export type SchemaType = "WebPage" | "AboutPage" | "ContactPage" | "CollectionPage" | "ItemPage";

export type PageSeo = {
  path: string;
  /** <title> (brand suffix added unless absoluteTitle). Keep ≤ 60 chars including the suffix. */
  title: string;
  absoluteTitle?: boolean;
  /** Meta + social description. 70–160 chars, answer-first, no keyword stuffing. */
  description: string;
  /** Social card copy, rendered into the per-page OG / X images. */
  og: { eyebrow: string; headline: string; subline?: string };
  schemaType: SchemaType;
  /** Short name for breadcrumbs and llms.txt. */
  label: string;
  index: boolean;
  sitemap?: { priority: number; changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]> };
};

export const PAGES = {
  home: {
    path: "/",
    title: `${BRAND_NAME} — AI-Powered Startup Idea Validation & Market Research`,
    absoluteTitle: true,
    description: `Validate startup ideas with real market evidence. Find customer pain points, analyze competitors, spot market gaps and plan your first customers with ${BRAND_NAME}.`,
    og: {
      eyebrow: "AI-powered market intelligence for founders",
      headline: "Stop building on assumptions. Start building on evidence.",
      subline: "Source-linked demand, competitor gaps and a first-10-customers plan.",
    },
    schemaType: "WebPage",
    label: "Home",
    index: true,
    sitemap: { priority: 1, changeFrequency: "weekly" },
  },
  pricing: {
    path: "/pricing",
    title: "Pricing",
    description: "Start free with one Quick report. Compare Free, Pro and Advanced plans for evidence-backed startup idea validation and market research.",
    og: { eyebrow: "Pricing", headline: "Choose how deeply you want to research.", subline: "Start free with one Quick report. No card required." },
    schemaType: "WebPage",
    label: "Pricing",
    index: true,
    sitemap: { priority: 0.8, changeFrequency: "monthly" },
  },
  sampleReport: {
    path: "/sample-report",
    title: "Sample opportunity report",
    description: "See an illustrative startup validation report: demand signals, pain points, competitors, market gaps, TAM/SAM/SOM and a first-10-customers plan.",
    og: { eyebrow: "Sample report", headline: "What an evidence-backed validation report looks like.", subline: "Demand, pain points, competitors, market size and a first-customer plan." },
    schemaType: "ItemPage",
    label: "Sample report",
    index: true,
    sitemap: { priority: 0.8, changeFrequency: "monthly" },
  },
  glossary: {
    path: "/glossary",
    title: "Market research glossary",
    description: "Plain-English definitions of market research terms for founders: TAM, SAM, SOM, demand signals, pain points, buying intent, market gaps and more.",
    og: { eyebrow: "Glossary", headline: "Market research terms, explained for founders.", subline: "TAM, SAM, SOM, demand signals, pain points, buying intent and more." },
    schemaType: "CollectionPage",
    label: "Glossary",
    index: true,
    sitemap: { priority: 0.6, changeFrequency: "monthly" },
  },
  about: {
    path: "/about",
    title: "About",
    description: `${BRAND_NAME} helps indie founders validate startup ideas with source-linked market evidence and plan their first customers. Here's why we built it.`,
    og: { eyebrow: `About ${BRAND_NAME}`, headline: "We built the research step founders keep skipping.", subline: "Evidence before opinion. Honest numbers. Your ideas stay yours." },
    schemaType: "AboutPage",
    label: "About",
    index: true,
    sitemap: { priority: 0.5, changeFrequency: "yearly" },
  },
  contact: {
    path: "/contact",
    title: "Contact",
    description: `How to reach the ${BRAND_NAME} team with questions about research, your account or privacy requests.`,
    og: { eyebrow: "Contact", headline: `Get in touch with the ${BRAND_NAME} team.` },
    schemaType: "ContactPage",
    label: "Contact",
    index: true,
    sitemap: { priority: 0.4, changeFrequency: "yearly" },
  },
  privacy: {
    path: "/privacy",
    title: "Privacy policy",
    description: `How ${BRAND_NAME} collects, uses and protects your data: what we store, who we share it with, and the choices you have.`,
    og: { eyebrow: "Legal", headline: "Privacy policy", subline: "What we collect, why, and who it's shared with." },
    schemaType: "WebPage",
    label: "Privacy policy",
    index: true,
    sitemap: { priority: 0.2, changeFrequency: "yearly" },
  },
  terms: {
    path: "/terms",
    title: "Terms of service",
    description: `The terms for using ${BRAND_NAME}: accounts, acceptable use, research outputs, credits and your content, written to be read.`,
    og: { eyebrow: "Legal", headline: "Terms of service", subline: `The rules for using ${BRAND_NAME}.` },
    schemaType: "WebPage",
    label: "Terms of service",
    index: true,
    sitemap: { priority: 0.2, changeFrequency: "yearly" },
  },
  cookies: {
    path: "/cookies",
    title: "Cookie policy",
    description: `The cookies ${BRAND_NAME} uses and why: only essential sign-in and security cookies, with no advertising or tracking cookies.`,
    og: { eyebrow: "Legal", headline: "Cookie policy", subline: "Only essential cookies. No advertising or tracking." },
    schemaType: "WebPage",
    label: "Cookie policy",
    index: true,
    sitemap: { priority: 0.2, changeFrequency: "yearly" },
  },
  blog: {
    path: "/blog",
    title: "Blog",
    description: "Notes on validating startup ideas, reading demand signals and finding your first customers. The first posts are being written.",
    og: { eyebrow: "Blog", headline: "Notes on building with evidence.", subline: "Coming soon." },
    schemaType: "CollectionPage",
    label: "Blog",
    index: false,
  },
  guides: {
    path: "/guides",
    title: "Startup guides",
    description: "Step-by-step guides for customer interviews, reading demand signals and sizing a market. In progress and coming soon.",
    og: { eyebrow: "Guides", headline: "Startup validation guides.", subline: "Coming soon." },
    schemaType: "CollectionPage",
    label: "Startup guides",
    index: false,
  },
  feedback: {
    path: "/feedback",
    title: "Feedback",
    description: `Tell the ${BRAND_NAME} team what to improve. An in-app feedback form is on the way; until then, see the contact page.`,
    og: { eyebrow: "Feedback", headline: `Help shape ${BRAND_NAME}.`, subline: "Coming soon." },
    schemaType: "WebPage",
    label: "Feedback",
    index: false,
  },
  signup: {
    path: "/signup",
    title: "Create your account",
    description: `Create a free ${BRAND_NAME} account and validate your first startup idea with source-linked market evidence. No card required.`,
    og: { eyebrow: "Get started free", headline: "Validate your next idea with evidence, not guesses.", subline: "Your first Quick report is free." },
    schemaType: "WebPage",
    label: "Sign up",
    index: true,
    sitemap: { priority: 0.5, changeFrequency: "yearly" },
  },
  login: {
    path: "/login",
    title: "Log in",
    description: `Log in to ${BRAND_NAME} to continue your market research, review evidence and pick up your first-customer plan.`,
    og: { eyebrow: "Log in", headline: "Welcome back. Your evidence is waiting." },
    schemaType: "WebPage",
    label: "Log in",
    index: false,
  },
} as const satisfies Record<string, PageSeo>;

export type PageKey = keyof typeof PAGES;
export const PAGE_KEYS = Object.keys(PAGES) as PageKey[];

/** Social image variants. og = Facebook/LinkedIn/Slack/Discord/WhatsApp/iMessage; x = X/Twitter large card. */
export const OG_VARIANTS = {
  og: { width: 1200, height: 630 },
  x: { width: 1200, height: 600 },
} as const;
export type OgVariant = keyof typeof OG_VARIANTS;

export const ogImagePath = (key: PageKey, variant: OgVariant) => `/og/${key}/${variant}.png`;
