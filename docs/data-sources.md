# Data sources — what we may use (checked Nov 2026; Week 12 rows checked 17 Nov 2026)

Rule: **only integrate sources whose terms allow commercial use.** Never show a source as "searched" if it wasn't.

| Source | Status for MVP | Notes |
|---|---|---|
| Web search API (Brave Search or Exa) | ✅ Priority 1 | ~$5–7 per 1k queries. Bing Search API retired Aug 2025; Google Custom Search JSON API closed to new customers — do not build on either. |
| Competitor websites (pricing/features pages) | ✅ Priority 1 | Fetch only public pages the user or search surfaced; respect robots.txt; store excerpt + retrieved date. |
| Hacker News (Algolia HN Search API) | ✅ Priority 1 | Public API, founder-heavy audience. Also used weekly for new-competitor detection (Show HN, last 60 days): the project's research queries are sent as search terms, as in research. |
| Stack Exchange API | ✅ Priority 1 | Public API with key; content CC BY-SA — keep attribution links. |
| User-submitted URLs | ✅ Priority 1 | User pastes threads/reviews they found. Fetched once each via the SSRF-safe fetcher; robots.txt respected. |
| GitHub issues (REST search API) | ✅ Priority 2 (confirm before launch) | Basis (checked 17 Nov 2026): GitHub Terms D.8 — the Terms "do not restrict lawful access to or use of the contents of public repositories by third parties"; API Terms (H) forbid spam, resale and abuse, not commercial use; the Acceptable Use Policy forbids misusing personal information (we keep authors only as a hash). Collected through the API only (not scraping), short excerpts with a link to each issue. Public issues with at least one interaction, last 2 years, no pull requests; query text can't add search qualifiers. LIMITED without `GITHUB_TOKEN`; pauses a minute after a rate limit. Have a lawyer confirm the excerpt use before launch. |
| YouTube Data API v3 (API key, public data) | ✅ Distribution only | Developer Policies: Non-Authorized Data (incl. statistics) stored ≤ 30 days then deleted (III.E.4); no aggregation and no derived metrics or scores from API Data (III.E.2, III.E.4.h); YouTube shown as the source (III.F.2); our Terms state users agree to the YouTube ToS and link it, our Privacy Policy says we use YouTube API Services and links the Google Privacy Policy (III.A.1–2). Never stored as Evidence or in report snapshots. Quota: 10,000 units/day per project (search = 100). |
| DataForSEO (Google Ads search volume, Labs keyword difficulty) | ✅ Licensed, paid | Their terms allow using API output inside our product for our users. Paid per request: per-plan monthly keyword allowance, a global monthly budget, 30-day cache. Figures shown as returned; none → "unavailable". |
| Reddit | ⛔ Conditional | Commercial use requires explicit written approval / contract from Reddit. GummySearch shut down over this. Only via a licensed provider once we have one. |
| Review platforms (G2, Capterra, Trustpilot) | ⛔ Licensed only | Do not scrape. |
| X / Instagram / TikTok | ⛔ Later | Cost or access restrictions. |

## Availability states shown in UI
`AVAILABLE` · `LIMITED` · `REQUIRES_CONNECTION` · `UNAVAILABLE` — computed server-side per job, stored in the job's config snapshot.
