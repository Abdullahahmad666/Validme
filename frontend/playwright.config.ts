import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a running app: `npm run dev` (frontend) and the Django API with a seeded test user
 * (`python manage.py seed_e2e_user`, DEBUG only). See e2e/README.md.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "off",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
