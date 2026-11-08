---
name: new-screen
description: Build or change a ValidMe frontend screen or component (dashboard, research wizard, progress, report tabs, evidence explorer, billing). Use whenever UI work is requested in frontend/.
---

# Build a ValidMe screen

1. Read the screen's section in `docs/design/screens.md` and the rules in `docs/design/design-system.md`. If the screen isn't specified there, write a short spec into `screens.md` first and confirm with the user.
2. Route goes under `frontend/src/app/(dashboard)/<route>/page.tsx` (auth pages under `(auth)`).
3. Reuse components from `frontend/src/components/` (layout, shared, research, evidence, reports…). Add new shared ones there, never inline duplicates. Use shadcn/ui primitives (`npx shadcn@latest add <component>`) instead of hand-rolled ones.
4. Data: fetch through a typed function in `frontend/src/services/` + TanStack Query hook in `src/hooks/`. Types live in `src/types/`. No business/research logic in components.
5. Forms: React Hook Form + Zod; validation rules must match the table in `screens.md` and the backend serializer.
6. Implement every state: empty, loading skeleton, partial, error + retry, no results, low confidence, plan limit.
7. Responsive per breakpoints in the design system; status = icon + text; AI-generated values show `AISuggestedBadge`.
8. Never invent data. Dev fixtures go in `src/mocks/` and render a visible "Sample data" label.
9. Public (marketing/auth) page? Follow the SEO rule in `CLAUDE.md`: registry entry in `src/content/seo.ts`, `pageMetadata("<key>")`, `<PageJsonLd page="<key>" />`. Signed-in app pages stay `noindex` via the dashboard layout.
10. Verify: `npm run lint && npm run typecheck`, then run the app and check desktop (1440px) and mobile (375px). Ask the `ui-reviewer` subagent to review.
