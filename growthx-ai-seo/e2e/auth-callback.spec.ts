/**
 * Google Sign-in OAuth Callback E2E Tests.
 *
 * Verifies the three callback paths when returning from Google OAuth:
 * 1. Valid one-time code: exchanges code via POST /auth/exchange, sets session tokens,
 *    and navigates to /dashboard.
 * 2. Expired or invalid code: shows an informative expiry error and redirects to /login.
 * 3. Missing code: shows a missing-code error and redirects to /login.
 *
 * Also verifies the security invariant that any one-time code in query params is
 * scrubbed from window.location immediately so it never lingers in browser history.
 */
import { test, expect, type Route } from "@playwright/test";

test.describe("Google sign-in callback", () => {
  test("successful exchange stores tokens and redirects to dashboard", async ({ page }) => {
    let exchangeCalled = false;
    let exchangedCode: string | null = null;

    // Intercept any API host/port
    await page.route("**/auth/exchange", async (route: Route) => {
      exchangeCalled = true;
      const postData = route.request().postDataJSON();
      exchangedCode = postData?.code;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "jwt-test-access-token",
          refresh_token: "jwt-test-refresh-token",
        }),
      });
    });

    await page.route("**/organizations", async (route: Route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: "org_test_123", name: "Test Corp", slug: "test-corp" },
        ]),
      });
    });

    // Provide default fallback mock for dashboard queries
    await page.route("**/projects/**", async (route: Route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/auth/callback?code=valid-onetime-code-123", {
      waitUntil: "domcontentloaded",
    });

    // Should redirect to dashboard on successful exchange
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    expect(exchangeCalled).toBe(true);
    expect(exchangedCode).toBe("valid-onetime-code-123");

    // Tokens must be stored in localStorage
    const storedToken = await page.evaluate(() => window.localStorage.getItem("growthx.token"));
    const storedOrg = await page.evaluate(() => window.localStorage.getItem("growthx.org"));

    expect(storedToken).toBe("jwt-test-access-token");
    expect(storedOrg).toBe("org_test_123");
  });

  test("expired or refused code shows error message and redirects to login", async ({ page }) => {
    await page.route("**/auth/exchange", async (route: Route) => {
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          statusCode: 401,
          message: "Invalid or expired login code",
        }),
      });
    });

    await page.goto("/auth/callback?code=expired-code-xyz", {
      waitUntil: "domcontentloaded",
    });

    // Informative error message must be visible to the user
    await expect(
      page.getByText("That sign-in link has expired. Please sign in again."),
    ).toBeVisible({ timeout: 5000 });

    // The component redirects to /login after a 3s delay
    await expect(page).toHaveURL(/\/login/, { timeout: 6000 });
  });

  test("missing code parameter shows error and redirects to login", async ({ page }) => {
    await page.goto("/auth/callback", { waitUntil: "domcontentloaded" });

    // Error for missing sign-in code
    await expect(
      page.getByText("Authentication failed. Sign-in code not found."),
    ).toBeVisible({ timeout: 5000 });

    // Redirects to /login after 3s delay
    await expect(page).toHaveURL(/\/login/, { timeout: 6000 });
  });

  test("code parameter is scrubbed from browser history immediately", async ({ page }) => {
    await page.route("**/auth/exchange", async (route: Route) => {
      // Delay response slightly so callback page is rendered
      await new Promise((resolve) => setTimeout(resolve, 500));
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ access_token: "mock-token" }),
      });
    });

    await page.route("**/organizations", async (route: Route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/auth/callback?code=secret-token-code", {
      waitUntil: "domcontentloaded",
    });

    // The code must be scrubbed from window.location via replaceState
    await expect(page).not.toHaveURL(/secret-token-code/, { timeout: 5000 });
  });
});

test.describe("Route protection", () => {
  test("unauthenticated visitor to /dashboard is redirected to /login", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
    });

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("unauthenticated visitor to /website is redirected to /login", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
    });

    await page.goto("/website", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
