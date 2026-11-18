# End-to-end tests (Playwright)

They drive the real app in Chromium: the Next.js frontend and the Django API, with a seeded test user.

```bash
# 1. Backend (DEBUG on, any database): create the test user (verified email, 10 credits)
cd backend && DEBUG=True python manage.py seed_e2e_user && DEBUG=True python manage.py runserver
# 2. Frontend
cd frontend && npm run dev
# 3. Tests
cd frontend && npm run e2e
```

Settings: `E2E_BASE_URL` (default `http://localhost:3000`), `E2E_EMAIL` / `E2E_PASSWORD` (defaults match
`seed_e2e_user`). `seed_e2e_user` refuses to run with DEBUG off.

`wizard.spec.ts` covers the research wizard: log in → step 1 (name, description, objective; one Continue creates the
draft and moves on) → step 2 (the missing-audience error, then an audience) → step 3 (Quick depth, as free accounts
run) → step 4 (Launch stays disabled until the scope is agreed). The launch call itself is intercepted, because it would
run real research (network and credits): the test checks the request carries the project and an Idempotency-Key and
that the "Research launched" confirmation links to the progress page. Every earlier step hits the real API, so drafts
created by test runs stay in the test user's projects.
