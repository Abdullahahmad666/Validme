# ValidMe design system

Feel: a serious research workspace (analytics dashboard + research tool), **not** a chatbot and not a generic admin panel. Evidence is the visual focus; accent color is used sparingly.

## Tokens (mirrored in `frontend/src/app/globals.css`)
| Token | Light | Use |
|---|---|---|
| `--background` | `#F8FAFC` | page |
| `--card` | `#FFFFFF` | surfaces |
| `--foreground` | `#172033` | primary text |
| `--muted-foreground` | `#64748B` | secondary text |
| `--border` | `#E2E8F0` | hairlines |
| `--primary` | `#315EAA` | primary actions, active nav |
| `--success` | `#15803D` | positive signals, "Available" |
| `--warning` | `#D97706` | caution, "Limited", medium confidence |
| `--destructive` | `#DC2626` | risks, failures |
| `--ai` | `#7C3AED` | "AI suggested" badge only |

- Font: **Inter** (400/500/600). Numbers: tabular figures.
- Radius: 10px controls, 14px cards. Spacing: 4px grid.
- Status is never color-only: always icon + text (e.g. ✓ Available).

## Layout
| Breakpoint | Width | Layout |
|---|---|---|
| Mobile | <640 | single column, top bar + bottom nav (Home, Projects, Research, Evidence, Account) |
| Large mobile | 640–767 | single column, compact grids |
| Tablet | 768–1023 | sidebar → 64px rail or drawer, KPI 2 cols |
| Laptop | 1024–1279 | compact sidebar |
| Desktop | ≥1280 | 250px sidebar, KPI 4 cols, content max-width 1400px, 32px padding |

## Navigation (sidebar)
- **Workspace:** Overview · My projects · New research
- **Intelligence:** Evidence explorer · Opportunities · Competitors · Audience & distribution
- **Account:** Subscription & usage · Settings

Report sections live **inside** a project report (tabs), not as sidebar items.

## Components (`frontend/src/components/`)
`AppSidebar`, `AppHeader`, `PageHeader`, `MetricCard`, `ProjectCard`, `ResearchStatus`, `SourceBadge`, `EvidenceCard`, `EvidenceFilters`, `PainPointCard`, `CompetitorTable`, `OpportunityScore`, `ConfidenceIndicator`, `AudienceCard`, `ChannelCard`, `ReportTabs`, `UsageMeter`, `UpgradePrompt`, `EmptyState`, `ErrorState`, `SourceCitation`, `AISuggestedBadge`.

## Libraries
Next.js App Router · TypeScript · Tailwind · shadcn/ui · Lucide · Recharts · React Hook Form + Zod · TanStack Query · TanStack Table · Sonner · Playwright + Vitest.

## Required states for every data screen
empty · loading (skeleton, real stages) · partial · error + retry · no results (explain coverage, suggest queries) · low confidence (highlight missing evidence) · plan limit · offline.

## Accessibility
WCAG 2.2 AA: keyboard nav, visible focus, labelled fields, textual errors with fixes, chart text summaries, 44px touch targets.

## Glass app shell
The signed-in app (`.app-glass` on the dashboard layout) shows frosted cards over a soft blue/lilac/mint gradient. Cards are at least 78% white with a 16px blur. Secondary text is `#556479` inside the app, which is 5.7:1 on the most tinted pane. Sticky and fixed bars are 94% white, so nothing reads through behind their buttons. `prefers-reduced-transparency` and print get solid cards. The marketing site keeps its own look. Don't make a column `sticky` if later cards scroll over it, because the glass would show it through.

## Charts (`frontend/src/components/charts/`, Recharts)
| Component | Use |
|---|---|
| `BarList` | Horizontal bars for "how many per category / source / theme". Labels are left-aligned in a column sized to fit, or above each bar on cards narrower than 480px. Value labels sit at the end. Includes a tooltip, a screen-reader summary and "Show as a table". |
| `DailyChart` | Counts over time by `day`, `week` or `month`. Bars for the main series and a 2px line for others on **one axis (same unit only)**. Optional `stack`. Missing days are zero-filled, because nothing was counted. Legend above, a tooltip listing every series, a summary and a table. |
| `GroupedBars` | 0–100 values side by side for 2–4 things (compare, predicted vs actual). A missing value is a gap, never a zero bar. |
| `ScoreRing`, `ScoreBreakdown` | The headline score as a ring. Each scored part, with "research alone" next to it when an experiment counted. Parts that weren't scored are listed in words. |
| `ShareBars` | Shares of answers, with the server's 95% range as a whisker. |
| `SegmentBar` | Parts of one whole (assumption statuses). The legend uses icon + label + count. |
| `priceLadder` (`prices.ts`) | Verified monthly prices in one currency only. Everything else is counted, never converted. |

Colour tokens (`globals.css`), all validated with the dataviz palette checks on white, `#f8fafc` and the glass panes:
- Series in fixed order: `--series-1` `#315eaa`, `--series-2` `#d95926`, `--series-3` `#199e70`, `--series-4` `#c98500`. Slot 4 is under 3:1, so a chart using it keeps a table.
- Ordinal (low → high, one hue): `--ordinal-1..3` `#6da7ec` / `#2a78d6` / `#184f95`.
- `--chart-grid`, `--chart-axis`.
- Status colours are never used as series.

Every number comes from the API, including rates, ranges and weekly or monthly counts; charts don't compute statistics. Each chart has a text alternative: a summary sentence plus a table, or a table already on the page. The SVG itself is `aria-hidden`.

## Hard rules
- Never fabricate data to fill a chart. Mock data in dev must be labelled "Sample data".
- Charts: horizontal bars for pain distribution, stacked bars for evidence by source, trend lines only with real time series. No pie charts.
- Don't make the opportunity score a global KPI across unrelated projects.
