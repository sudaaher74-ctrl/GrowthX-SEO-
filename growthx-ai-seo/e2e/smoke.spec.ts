/**
 * Render smoke test for every route.
 *
 * This is the check the repo was missing. The Fix Engine once shipped a crash
 * that `tsc`, ESLint and `next build` all passed cleanly — an unstable
 * `useSyncExternalStore` snapshot that only failed when React actually
 * rendered it, and it reached customers as a blank "This page couldn't load"
 * screen. Nothing in CI could have caught it, because nothing rendered a page.
 *
 * So: load each route in a real browser and fail on
 *   - an uncaught exception (a crash, whether or not a boundary caught it),
 *   - the route error boundary appearing,
 *   - a page that renders essentially nothing.
 *
 * The API is not running here, so every request fails. That is deliberate:
 * a page must survive its data being unavailable, which is also what a
 * customer sees during a backend outage.
 */

import { test, expect, type Page } from "@playwright/test";
import { PUBLIC_ROUTES, DASHBOARD_ROUTES, TABBED_ROUTES } from "./routes";

/** Text that means the page gave up rather than rendered. */
const FAILURE_TEXT = [
  "ran into a problem", // (dashboard)/error.tsx
  "Something went wrong", // app/error.tsx
  "hit an unexpected error", // app/global-error.tsx
  "couldn't load", // Next's own crash screen
  "couldn’t load", // ...with a curly apostrophe
];

/**
 * Noise from the environment rather than the page: the backend is absent, so
 * failed API calls are expected. A genuine render crash is never one of these.
 */
function isEnvironmentNoise(message: string): boolean {
  return /Failed to fetch|NetworkError|ERR_CONNECTION|Load failed|net::/i.test(message);
}

async function checkRoute(page: Page, route: string) {
  const crashes: string[] = [];
  const onPageError = (error: Error) => {
    if (!isEnvironmentNoise(error.message)) crashes.push(error.message.split("\n")[0]);
  };
  page.on("pageerror", onPageError);

  try {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    // Let effects, queries and their failure states settle.
    await page.waitForTimeout(2500);

    const body = (await page.locator("body").innerText()).trim();

    expect(crashes, `${route} threw during render`).toEqual([]);
    for (const marker of FAILURE_TEXT) {
      expect(body, `${route} rendered a failure screen`).not.toContain(marker);
    }
    expect(body.length, `${route} rendered an essentially empty page`).toBeGreaterThan(80);
  } finally {
    page.off("pageerror", onPageError);
  }
}

test.describe("public routes render", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`renders ${route}`, async ({ page }) => {
      await checkRoute(page, route);
    });
  }
});

test.describe("Google account recovery", () => {
  const recoveryUrl = "/login?recovery=google&token=fixture-token&email=owner%40example.com";

  test("links Google with the existing Reigel password and opens the workspace", async ({ page }) => {
    await page.route("**/auth/csrf", (route) => route.fulfill({ json: { csrfToken: "fixture-csrf" } }));
    await page.route("**/organizations", (route) => route.fulfill({ json: [{ id: "existing-workspace" }] }));
    await page.route("**/projects/org/existing-workspace", (route) => route.fulfill({ json: [{ id: "existing-project" }] }));
    await page.route("**/auth/google/link-with-password", (route) => route.fulfill({ json: { success: true } }));
    await page.goto(recoveryUrl);
    await expect(page).toHaveURL(/\/login\?recovery=google$/);
    await expect(page.getByRole("heading", { name: "Finish Google sign-in" })).toBeVisible();
    await page.getByLabel("Current Reigel password").fill("fixture-password");
    const request = page.waitForRequest("**/auth/google/link-with-password");
    await page.getByRole("button", { name: "Link Google and sign in" }).click();
    expect((await request).postDataJSON()).toEqual({
      recoveryToken: "fixture-token",
      password: "fixture-password",
    });
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("shows the recovery consequences and requires confirmation before submitting", async ({ page }) => {
    let requests = 0;
    await page.route("**/auth/csrf", (route) => route.fulfill({ json: { csrfToken: "fixture-csrf" } }));
    await page.route("**/auth/google/reclaim-account", (route) => {
      requests++;
      expect(route.request().postDataJSON()).toEqual({ recoveryToken: "fixture-token" });
      return route.fulfill({ status: 401, json: { message: "This recovery link has expired." } });
    });
    await page.goto(recoveryUrl);
    await page.getByRole("button", { name: "Recover with Google instead" }).click();
    await expect(page.getByText(/disables your old Reigel password/)).toBeVisible();
    expect(requests).toBe(0);
    await page.getByRole("button", { name: "Confirm Google recovery" }).click();
    await expect(page.getByRole("alert").getByText("This recovery link has expired.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Start again with Google" })).toBeVisible();
    expect(requests).toBe(1);
  });
});

test.describe("dashboard routes render", () => {
  test.beforeEach(async ({ page }) => {
    // The shell redirects to /login without a token; a fake one is enough to
    // mount the authenticated tree, since this test never asserts on API data.
    // An init script seeds it before the page's own scripts run, so each route
    // needs one navigation instead of a trip through /login first.
    await page.addInitScript(() => {
      window.localStorage.setItem("growthx.token", "smoke-test-token");
    });
  });

  for (const route of [...DASHBOARD_ROUTES, ...TABBED_ROUTES]) {
    test(`renders ${route}`, async ({ page }) => {
      await checkRoute(page, route);
    });
  }
});
