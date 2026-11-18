import { expect, test } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL ?? "e2e@example.com";
const PASSWORD = process.env.E2E_PASSWORD ?? "e2e-pass-12345";

test("research wizard: idea → market → configure → review → launch", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));

  await page.goto("/research/new");
  await page.waitForLoadState("networkidle"); // hydrated: controlled inputs and chips respond
  await page.getByLabel("Project name").fill(`E2E stock app ${Date.now()}`);
  await page.getByLabel("Idea description").fill("A phone app that helps independent restaurants count stock in minutes and cut food waste.");
  const objective = page.getByRole("button", { name: "Validate demand" });
  if ((await objective.getAttribute("aria-pressed")) !== "true") await objective.click(); // may be preselected
  await expect(objective).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/step=2/);
  // Step 2: an audience segment is required; Continue without one shows the problem and stays.
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Add at least one audience segment.")).toBeVisible();
  await page.getByPlaceholder("Add a segment").fill("Independent restaurant owners");
  await page.getByRole("button", { name: "Add" }).first().click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/step=3/);

  // Step 3: keep the default sources (Hacker News etc.); free accounts run Quick research.
  await expect(page.getByText("Hacker News")).toBeVisible();
  await page.getByRole("radiogroup", { name: "Research depth" }).getByRole("radio", { name: /Quick/ }).click();
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.waitForURL(/step=4/);

  // Step 4: launching needs agreement and an estimate the account can afford.
  const launch = page.getByRole("button", { name: "Launch research" });
  await expect(launch).toBeDisabled();
  await page.getByRole("checkbox").check();
  await expect(launch).toBeEnabled({ timeout: 15_000 });

  // Launching runs real research (network, credits): intercept just this call and check what the app sends.
  const projectId = new URL(page.url()).searchParams.get("project");
  let idempotencyKey: string | null = null;
  await page.route("**/api/research/jobs", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    idempotencyKey = route.request().headers()["idempotency-key"] ?? null;
    expect(route.request().postDataJSON()).toMatchObject({ project: projectId });
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ id: "e2e-job", project: projectId, status: "PENDING", depth: "standard", credits_charged: 1, stages: [], coverage: {} }),
    });
  });
  await launch.click();
  await expect(page.getByRole("heading", { name: "Research launched" })).toBeVisible();
  await expect(page.getByText("1 credit used.")).toBeVisible();
  expect(idempotencyKey).toBeTruthy();
  await expect(page.getByRole("link", { name: "View research progress" })).toHaveAttribute("href", `/projects/${projectId}/progress`);
});
