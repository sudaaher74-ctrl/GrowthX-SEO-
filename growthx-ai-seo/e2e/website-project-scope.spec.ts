import { expect, test } from "@playwright/test";
import { API_BASE } from "./api-base";

test("a domain-specific audit reads counts and reports from that domain's project", async ({ page }) => {
  const requested: string[] = [];
  await page.addInitScript(() => {
    localStorage.setItem("growthx.token", "test-token");
    localStorage.setItem("growthx.org", "org_test");
    localStorage.setItem("growthx.project", "project_a");
  });

  await page.route(`${API_BASE}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    requested.push(path);
    const respond = (body: unknown) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (path === "/organizations") return respond([{ id: "org_test", name: "Test", slug: "test" }]);
    if (path === "/projects/org/org_test") return respond([
      { id: "project_a", name: "A" },
      { id: "project_b", name: "B" },
    ]);
    if (path === "/api/organizations/org_test/portfolio") return respond({
      clients: [
        { projectId: "project_a", name: "A", domain: "a.example", trend: [] },
        { projectId: "project_b", name: "B", domain: "b.example", trend: [] },
      ],
      summary: {},
      alerts: [],
    });
    if (path === "/api/websites/b.example/latest-crawl") return respond(null);
    if (path === "/api/projects/project_b/issues/counts") return respond({ openGroups: 9, pagesCrawled: 0 });
    if (path === "/api/projects/project_b/issues/groups") return respond({ groups: [], reachAvailable: false });
    if (path === "/api/projects/project_b/audit-report/latest") return respond(null);
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });

  await page.goto("/website?domain=b.example&tab=report", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("tab", { name: /9 problems/ })).toBeVisible();
  await expect(page.getByText("Press \"Write my report\".", { exact: false })).toBeVisible();

  expect(requested).toContain("/api/projects/project_b/issues/counts");
  expect(requested).toContain("/api/projects/project_b/audit-report/latest");
  // Shared dashboard chrome may independently read the active project's counts.
  // The audit itself must show B's count and load B's saved report.
  expect(requested).not.toContain("/api/projects/project_a/audit-report/latest");
});
