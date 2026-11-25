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

  test("keeps the recovery challenge across reload and links Google with the Reigel password", async ({ page }) => {
    await page.route("**/auth/csrf", (route) => route.fulfill({ json: { csrfToken: "fixture-csrf" } }));
    await page.route("**/organizations", (route) => route.fulfill({ json: [{ id: "existing-workspace" }] }));
    await page.route("**/projects/org/existing-workspace", (route) => route.fulfill({ json: [{ id: "existing-project" }] }));
    await page.route("**/auth/google/link-with-password", (route) => route.fulfill({ json: { success: true } }));
    await page.goto(recoveryUrl);
    await expect(page).toHaveURL(/\/login\?recovery=google$/);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Finish Google sign-in" })).toBeVisible();
    await expect(page.getByText("owner@example.com", { exact: true })).toBeVisible();
    await page.getByLabel("Current Reigel password").fill("fixture-password");
    const request = page.waitForRequest("**/auth/google/link-with-password");
    await page.getByRole("button", { name: "Link Google and sign in" }).click();
    expect((await request).postDataJSON()).toEqual({
      recoveryToken: "fixture-token",
      password: "fixture-password",
    });
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/login?recovery=google");
    await expect(page.getByText(/This recovery link is incomplete or expired/)).toBeVisible();
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
    await expect(page.getByRole("alert").filter({ hasText: "This recovery link has expired." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Start again with Google" })).toBeVisible();
    expect(requests).toBe(1);
  });

  test("continues with Google after reload without a Reigel password", async ({ page }) => {
    await page.route("**/auth/csrf", (route) => route.fulfill({ json: { csrfToken: "fixture-csrf" } }));
    await page.route("**/organizations", (route) => route.fulfill({ json: [{ id: "existing-workspace" }] }));
    await page.route("**/projects/org/existing-workspace", (route) => route.fulfill({ json: [{ id: "existing-project" }] }));
    await page.route("**/auth/google/reclaim-account", (route) => route.fulfill({ json: { success: true } }));
    await page.goto(recoveryUrl);
    await expect(page).toHaveURL(/\/login\?recovery=google$/);
    await page.reload();
    await page.getByRole("button", { name: "Recover with Google instead" }).click();
    const request = page.waitForRequest("**/auth/google/reclaim-account");
    await page.getByRole("button", { name: "Confirm Google recovery" }).click();
    expect((await request).postDataJSON()).toEqual({ recoveryToken: "fixture-token" });
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

test("Local SEO shows a connected listing when the audit route is unavailable", async ({ page }) => {
  const projectId = "maps-project";
  const apiPath = `**/api/projects/${projectId}/local-seo`;
  const listing = {
    id: "maps-location",
    projectId,
    businessName: "Example Interiors",
    address: "Pali, Faridabad",
    placeId: "fixture-place-id",
    rating: 4.5,
    reviewCount: 12,
    citationsCount: 0,
    updatedAt: "2026-11-25T10:00:00Z",
  };
  let saved = false;
  await page.addInitScript(({ projectId }) => {
    localStorage.setItem("growthx.session", "1");
    localStorage.setItem("growthx.org", "maps-workspace");
    localStorage.setItem("growthx.project", projectId);
    localStorage.setItem("growthx_subscription_claim_maps-workspace", JSON.stringify({
      tierId: "growth",
      tierName: "Growth",
      status: "active",
      billingCycle: "monthly",
      currency: "INR",
    }));
  }, { projectId });
  await page.route("**/auth/csrf", (route) => route.fulfill({ json: { csrfToken: "fixture-csrf" } }));
  await page.route("**/auth/me", (route) => route.fulfill({ json: { id: "maps-user", role: "OWNER" } }));
  await page.route("**/organizations", (route) => route.fulfill({ json: [{ id: "maps-workspace", name: "Maps workspace" }] }));
  await page.route("**/projects/org/maps-workspace", (route) => route.fulfill({ json: [{ id: projectId, name: "Maps project" }] }));
  await page.route(`${apiPath}/profile`, (route) => route.fulfill({ status: 404, json: {} }));
  await page.route(`${apiPath}/citations`, (route) => route.fulfill({ status: 404, json: {} }));
  await page.route(apiPath, (route) => route.fulfill({ body: JSON.stringify(saved ? listing : null), contentType: "application/json" }));
  await page.route(`${apiPath}/search`, (route) => route.fulfill({
    json: [{ name: listing.businessName, address: listing.address, placeId: listing.placeId, rating: 4.5, userRatingsTotal: 12 }],
  }));
  await page.route(`${apiPath}/connect`, (route) => {
    saved = true;
    return route.fulfill({ json: listing });
  });

  await page.goto("/local-seo");
  await page.getByRole("button", { name: "Connect Google Maps" }).click();
  await page.getByPlaceholder("Enter business name and city...").fill(listing.businessName);
  await page.getByRole("button", { name: "Search Google Maps" }).click();
  await page.getByRole("button", { name: "Connect Listing" }).click();
  await expect(page.getByText("Google Maps listing connected", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Google Maps listing connected", { exact: true })).toBeVisible();
  await expect(page.getByText(listing.businessName, { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open listing in Google Maps" })).toHaveAttribute("href", /query_place_id=fixture-place-id/);
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
