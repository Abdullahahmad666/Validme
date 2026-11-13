# Data sources — what we may use (checked Nov 2026)

Rule: **only integrate sources whose terms allow commercial use.** Never show a source as "searched" if it wasn't.

| Source | Status for MVP | Notes |
|---|---|---|
| Web search API (Brave Search or Exa) | ✅ Priority 1 | ~$5–7 per 1k queries. Bing Search API retired Aug 2025; Google Custom Search JSON API closed to new customers — do not build on either. |
| Competitor websites (pricing/features pages) | ✅ Priority 1 | Fetch only public pages the user or search surfaced; respect robots.txt; store excerpt + retrieved date. |
| Hacker News (Algolia HN Search API) | ✅ Priority 1 | Public API, founder-heavy audience. Also used weekly for new-competitor detection (Show HN, last 60 days): the project's research queries are sent as search terms, as in research. |
| Stack Exchange API | ✅ Priority 1 | Public API with key; content CC BY-SA — keep attribution links. |
| User-submitted URLs | ✅ Priority 1 | User pastes threads/reviews they found. Fetched once each via the SSRF-safe fetcher; robots.txt respected. |
| GitHub issues (public repos of competitors / OSS alternatives) | 🟡 Should have | Good for developer-tool ideas. |
| Reddit | ⛔ Conditional | Commercial use requires explicit written approval / contract from Reddit. GummySearch shut down over this. Only via a licensed provider once we have one. |
| Review platforms (G2, Capterra, Trustpilot) | ⛔ Licensed only | Do not scrape. |
| X / Instagram / TikTok | ⛔ Later | Cost or access restrictions. |

## Availability states shown in UI
`AVAILABLE` · `LIMITED` · `REQUIRES_CONNECTION` · `UNAVAILABLE` — computed server-side per job, stored in the job's config snapshot.
