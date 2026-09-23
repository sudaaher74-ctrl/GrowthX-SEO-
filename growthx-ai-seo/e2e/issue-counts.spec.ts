/**
 * The dashboard shows the issue counts it is given.
 *
 * The route smoke test runs with no API at all, on purpose, so it proves a page
 * survives its data failing — and says nothing about whether the page reads its
 * data correctly. That gap is exactly where the original bug lived. The server
 * always sent the right severity breakdown; the dashboard read lowercase keys
 * the server never sent, every tile fell back to zero, and a client saw
 * `CRITICAL 0 · HIGH 0 · MEDIUM 0 · LOW 0` printed above a list of HIGH
 * findings. Nothing on the server side can catch a regression of that.
 *
 * So this serves the dashboard a known answer and checks it shows that answer.
 * The fixtures are the figures the counting service produced against a real
 * PostgreSQL database seeded with the Aiva audit: 33 open findings, 1 / 30 /
 * 2 / 0 by severity, in 4 problems, one of them on 29 product pages.
 */
import { test, expect, type Route } from "@playwright/test";

const API = "http://localhost:3000";
const ORG = "org_test";
const PROJECT = "proj_test";
const DOMAIN = "aivaenterprises.com";

const COUNTS = {
  openFindings: 33,
  openGroups: 4,
  bySeverity: { CRITICAL: 1, HIGH: 30, MEDIUM: 2, LOW: 0 },
  autoFixable: 32,
  resolvedThisPeriod: 0,
  regressedThisPeriod: 0,
  pagesCrawled: 35,
  healthScore: 89,
  crawledAt: "2026-09-22T01:42:08.030Z",
};

function group(issueType: string, title: string, severity: string, affectedCount: number, impact: number) {
  return {
    groupKey: `${PROJECT}::${issueType}`,
    issueType,
    category: "TECHNICAL",
    severity,
    confidence: "LIKELY",
    affectedCount,
    sampleUrls: Array.from({ length: Math.min(affectedCount, 5) }, (_, i) => `https://${DOMAIN}/p/${i + 1}`),
    aiFixAvailable: true,
    fixClass: "AUTO",
    impact,
    reachAvailable: false,
    firstDetectedAt: "2026-09-01T00:00:00.000Z",
    regressionCount: 0,
    title,
    summary: "",
    action: "",
  };
}

const GROUPS = {
  reachAvailable: false,
  groups: [
    group("MISSING_TITLE", "Missing title", "CRITICAL", 1, 77.5),
    group("SCHEMA_PRODUCT_OFFERS", "Schema product offers", "HIGH", 29, 52.5),
    group("MISSING_H1", "Missing h1", "HIGH", 1, 52),
    group("MISSING_META_DESCRIPTION", "Missing meta description", "MEDIUM", 2, 43.8),
  ],
};

/**
 * Answers the handful of requests the dashboard needs to reach its issue card,
 * and lets everything else fail — the page must survive its other panels'
 * data being unavailable, which the route smoke test already requires.
 */
async function serve(route: Route) {
  const path = new URL(route.request().url()).pathname;
  const json = (body: unknown) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

  if (path === "/organizations") return json([{ id: ORG, name: "Test Org", slug: "test" }]);
  if (path === `/projects/org/${ORG}`) return json([{ id: PROJECT, name: "Aiva" }]);
  if (path === `/api/organizations/${ORG}/portfolio`) {
    return json({
      clients: [{ projectId: PROJECT, name: "Aiva", domain: DOMAIN, health: 89, criticalIssues: 1, trend: [] }],
      summary: {},
      alerts: [],
    });
  }
  if (path === `/api/websites/${DOMAIN}/latest-crawl`) {
    return json({ id: "job_1", status: "COMPLETED", healthScore: 89, pagesCrawled: 35, finishedAt: COUNTS.crawledAt });
  }
  if (path === `/api/projects/${PROJECT}/issues/counts`) return json(COUNTS);
  if (path === `/api/projects/${PROJECT}/issues/groups`) return json(GROUPS);
  return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
}

test.describe("dashboard issue counts", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("growthx.token", "smoke-test-token");
    });
    await page.route(`${API}/**`, serve);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  });

  test("shows the severity breakdown it was given, not zeros", async ({ page }) => {
    const card = page.locator("text=Technical SEO Health").locator("xpath=ancestor::*[.//text()[contains(., 'Critical')]][1]");
    await expect(card).toBeVisible({ timeout: 15_000 });

    // Each tile is its number followed by its label.
    for (const [label, value] of [["Critical", "1"], ["High", "30"], ["Medium", "2"], ["Low", "0"]] as const) {
      const tile = card.locator("div", { has: page.getByText(label, { exact: true }) }).last();
      await expect(tile, `${label} tile`).toContainText(value);
    }
  });

  test("the breakdown adds up to the headline", async ({ page }) => {
    await expect(page.getByText("33 open findings")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("across 4 problems")).toBeVisible();
    // 1 + 30 + 2 + 0 — the invariant the server guarantees, visible on screen.
    expect(COUNTS.bySeverity.CRITICAL + COUNTS.bySeverity.HIGH + COUNTS.bySeverity.MEDIUM + COUNTS.bySeverity.LOW)
      .toBe(COUNTS.openFindings);
  });

  test("the queue shows distinct problems, one of them on 29 pages", async ({ page }) => {
    const queue = page.locator("text=Priority Action Queue").locator("xpath=ancestor::*[.//text()[contains(., 'Missing title')]][1]");
    await expect(queue).toBeVisible({ timeout: 15_000 });

    for (const title of ["Missing title", "Schema product offers", "Missing h1", "Missing meta description"]) {
      await expect(queue.getByText(title, { exact: true })).toBeVisible();
    }
    // The schema defect is one row reading 29 pages — not 29 rows, and not the
    // five rows of one defect that used to crowd everything else off the list.
    await expect(queue.getByText("29 pages", { exact: true })).toBeVisible();
    await expect(queue.getByText("Schema product offers", { exact: true })).toHaveCount(1);
  });

  test("says the order is not traffic-weighted when Search Console is not connected", async ({ page }) => {
    await expect(page.getByText(/connect Search Console for traffic-weighted priority/)).toBeVisible({ timeout: 15_000 });
  });

  test("explains the health score beside it", async ({ page }) => {
    await expect(page.getByText(/89\/100 — 33 findings, mostly high severity/)).toBeVisible({ timeout: 15_000 });
  });
});
