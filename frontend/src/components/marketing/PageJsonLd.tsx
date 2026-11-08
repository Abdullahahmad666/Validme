import { JsonLd } from "@/components/marketing/JsonLd";
import { ogImagePath, PAGES, type PageKey } from "@/content/seo";
import { BRAND_NAME, SITE_URL, SOCIAL_LINKS } from "@/lib/brand";
import { absoluteUrl } from "@/lib/seo";

export const ORG_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

/** Organization + WebSite entities (rendered on the home page; referenced by @id elsewhere). */
export function siteEntities() {
  return [
    {
      "@type": "Organization",
      "@id": ORG_ID,
      name: BRAND_NAME,
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/icons/icon-512.png`, width: 512, height: 512 },
      ...(SOCIAL_LINKS.length ? { sameAs: SOCIAL_LINKS.map((s) => s.href) } : {}),
    },
    {
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      name: BRAND_NAME,
      url: SITE_URL,
      inLanguage: "en",
      publisher: { "@id": ORG_ID },
    },
  ];
}

/**
 * Page-level structured data for AEO/GEO: typed WebPage with breadcrumbs, primary image and
 * links to the site entities. Pass `extra` for page-specific entities (FAQPage, HowTo, …).
 */
export function PageJsonLd({ page, extra = [] }: { page: PageKey; extra?: Record<string, unknown>[] }) {
  const p = PAGES[page];
  const url = absoluteUrl(p.path);
  const crumbs =
    page === "home"
      ? [{ name: BRAND_NAME, url: SITE_URL }]
      : [
          { name: BRAND_NAME, url: SITE_URL },
          { name: p.label, url },
        ];
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@graph": [
          ...(page === "home" ? siteEntities() : []),
          {
            "@type": p.schemaType,
            "@id": `${url}#webpage`,
            url,
            name: p.title,
            description: p.description,
            inLanguage: "en",
            isPartOf: { "@id": WEBSITE_ID },
            publisher: { "@id": ORG_ID },
            primaryImageOfPage: { "@type": "ImageObject", url: absoluteUrl(ogImagePath(page, "og")), width: 1200, height: 630 },
            breadcrumb: { "@id": `${url}#breadcrumb` },
          },
          {
            "@type": "BreadcrumbList",
            "@id": `${url}#breadcrumb`,
            itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.url })),
          },
          ...extra,
        ],
      }}
    />
  );
}

/** FAQPage entity for AEO: questions and answers exactly as shown on the page. */
export function faqPageEntity(faqs: readonly { q: string; a: string }[]) {
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}
