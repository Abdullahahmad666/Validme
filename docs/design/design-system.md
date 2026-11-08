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

## Hard rules
- Never fabricate data to fill a chart. Mock data in dev must be labelled "Sample data".
- Charts: horizontal bars for pain distribution, stacked bars for evidence by source, trend lines only with real time series. No pie charts.
- Don't make the opportunity score a global KPI across unrelated projects.
