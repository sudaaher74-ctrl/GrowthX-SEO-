import { expect, test } from "@playwright/test";
import { API_BASE } from "./api-base";

test("a temporary workspace directory failure preserves the selected project", async ({ page }) => {
  const requested: string[] = [];
  await page.addInitScript(() => {
    localStorage.setItem("growthx.token", "test-token");
    localStorage.setItem("growthx.org", "org_test");
    localStorage.setItem("growthx.project", "project_a");
  });

  await page.route(`${API_BASE}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    requested.push(path);
    if (path === "/organizations" || path === "/projects/org/org_test") {
      return route.fulfill({ status: 503, contentType: "application/json", body: '{"message":"Unavailable"}' });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect.poll(() => requested.includes("/api/projects/project_a/issues/counts")).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("growthx.org"))).toBe("org_test");
  expect(await page.evaluate(() => localStorage.getItem("growthx.project"))).toBe("project_a");
});
