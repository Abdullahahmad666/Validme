# ValidMe — Product Requirements (v1)

> Working name: **ValidMe**. Change it in one place: `BRAND_NAME` in `frontend/src/lib/brand.ts` and `VALIDME_BRAND` in `backend/config/settings.py`.

## 1. One-line pitch
Turn a startup hunch into an evidence-backed decision **and** a plan to reach the first 10 paying customers — from the web app or directly inside Claude.

## 2. Who it's for
Indie hackers and solo SaaS founders at the idea or early-MVP stage.

## 3. The problem (what founders do today, manually)
| Step | Manual effort today | ValidMe |
|---|---|---|
| Turn idea into research questions & search queries | 30–60 min, usually skipped | Generated, editable, grouped by intent |
| Search forums / HN / Stack Exchange / web for complaints | 3–6 h of tab-hopping | Parallel provider fan-out |
| Copy quotes, dedupe, tag pain vs feature request vs buying intent | 2–4 h in a spreadsheet | Classified, clustered, every item linked to its source |
| Find competitors, read pricing pages | 1–3 h | Competitor table with dated source links |
| Decide where customers hang out + what to say | Often guessed | Channel list backed by evidence + first-10 plan |
| **Total** | **~1–2 working days per idea** | **~10 minutes of compute + 20–30 min reviewing** |

These are planning estimates, not measured numbers. Measure real times in the private beta (see §10).

What ValidMe does **not** replace: talking to customers. The report ends with who to interview and what to ask — the founder still has to do it.

## 4. Positioning vs. competitors (Nov 2026)
Source-linked validation is now table stakes (Preuve AI, BigIdeasDB, Discury, IdeaProof, ValidatorAI, IdeaBrowser). ValidMe competes on:
1. **Claude-native** — an MCP server so founders validate from Claude / Claude Code where they already build.
2. **Distribution-first** — "where are my first 10 customers and what do I say to them", not just a go/kill score.
3. **Honest coverage** — show exactly which sources were searched, what failed, and confidence separate from score.
4. **Monitoring (v2)** — alerts on new complaints / competitor changes, which is what justifies a subscription.

## 5. Core user journey (MVP)
1. **Describe idea** (free text, objectives).
2. **Define market** (AI suggests audience, industry, geography, B2B/B2C — all editable, marked "AI suggested").
3. **Configure research** (sources with availability state, generated queries by intent, competitors, depth).
4. **Review & launch** (scope, excluded sources, credit estimate, explicit confirm, idempotent submit).
5. **Research progress** (real backend stages; partial success allowed; retry on failure).
6. **Opportunity report** with tabs: Overview · Demand · Evidence · Pain points · Competitors · Market gaps · Audience · Distribution.
7. **Save & revisit** (history, export PDF/Markdown).

## 6. MVP scope
**Must have:** email + Google auth · projects CRUD · idea analyzer · query generation · provider abstraction · web search provider · competitor page reader · HN + Stack Exchange providers · user-submitted URLs · evidence normalize/dedupe/classify/cluster · competitor profiles · opportunity score + confidence · distribution plan · report history · credits & plan limits · MCP server.

**Should have:** idea comparison · saved evidence · evidence filters · PDF export · custom research questions · share link.

**Later:** monitoring & alerts · licensed Reddit / review data · X/TikTok/Instagram · interview script generator · experiment tracking · team workspaces.

**Never in MVP:** automated outreach, scraping platforms whose terms forbid it, fabricated metrics, a single "idea score" without visible reasoning.

## 7. Evidence rules (non-negotiable)
- Every finding links to ≥1 evidence record (URL, excerpt, published date, retrieved date, provider).
- Evidence records, AI conclusions, and user assumptions are stored separately; AI text is never stored as a source fact.
- Dedupe by URL + near-duplicate text; never count 100 search results as 100 customers.
- If data is missing, say "unavailable" — never invent a number (TAM/SAM/SOM included).
- Opportunity score and evidence confidence are always shown together; the formula is visible.

## 8. Opportunity score (starting weights, calibrate later)
| Dimension | Weight |
|---|---|
| Demand evidence | 25% |
| Pain intensity | 20% |
| Willingness-to-pay evidence | 20% |
| Competitive gap | 15% |
| Audience accessibility | 10% |
| Product feasibility | 10% |

High score + low confidence ⇒ recommendation is "research more", not "build".

## 9. Pricing (to test)
- **Free:** 1 Quick report (limited evidence preview).
- **Credit packs:** 3 reports $19 · 10 reports $49 (no subscription needed).
- **Pro $29/mo (v2):** 10 reports/mo + monitoring + MCP access + comparisons.
Rationale: competitors that sell one-off reports suggest founders validate in bursts; subscriptions must be earned with monitoring.

## 10. Success metrics
- North star: **validated opportunities acted on** (user marks "interviewed / launched landing page / got a customer").
- Report completion rate ≥ 95%, cost per report < $2, second-report rate, evidence click-through, free→paid conversion.
- Beta: measure "time you would have spent manually" via a one-question survey after each report.

## 11. Acceptance criteria (launch gate)
Idea editable before research · async jobs · every evidence item has a source · duplicates filtered · findings link to evidence · competitor claims dated · missing providers disclosed · reports persist · usage limits enforced server-side · users cannot read others' projects · per-job cost tracked · 20-idea quality test set reviewed by a human.
