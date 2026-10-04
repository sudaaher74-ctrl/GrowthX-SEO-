import { expect, test, type Page, type Route } from "@playwright/test";
import { API_BASE } from "./api-base";

const ORG = "org_test";
const PROJECT = "project_test";
const DOMAIN = "milquufresh.in";

async function authenticate(page: Page) {
  await page.addInitScript(({ org, project }) => {
    localStorage.setItem("growthx.token", "test-token");
    localStorage.setItem("growthx.org", org);
    localStorage.setItem("growthx.project", project);
  }, { org: ORG, project: PROJECT });
}

async function baseApi(route: Route) {
  const url = new URL(route.request().url());
  const path = url.pathname;
  const json = (body: unknown) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

  if (path === "/organizations") return json([{ id: ORG, name: "Test", slug: "test" }]);
  if (path === `/projects/org/${ORG}`) return json([{ id: PROJECT, name: "Milquu Fresh" }]);
  if (path === `/api/organizations/${ORG}/portfolio`) return json({
    clients: [{ projectId: PROJECT, name: "Milquu Fresh", domain: DOMAIN, trend: [] }],
    summary: {},
    alerts: [],
  });
  return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
}

test("all Website Audit tabs remain selectable after Full Report", async ({ page }) => {
  await authenticate(page);
  await page.route(`${API_BASE}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (path === `/api/websites/${DOMAIN}/latest-crawl`) return json({
      id: "crawl_1", status: "COMPLETED", healthScore: 83, pagesCrawled: 38,
      startedAt: "2026-10-01T00:00:00Z", finishedAt: "2026-10-01T00:01:00Z",
    });
    if (path === `/api/websites/${DOMAIN}/crawl-history`) return json([]);
    if (path === "/api/crawls/crawl_1/issues") return json({ data: [], meta: { total: 0, page: 1, limit: 100, totalPages: 0, totalFindings: 0, uniqueOpenIssues: 0, resolvedIssues: 0, countsBySeverity: {}, countsByCategory: {}, countsByConfidence: {} } });
    if (path === "/api/crawls/crawl_1/pages") return json({ data: [], meta: { total: 0, page: 1, totalPages: 0 } });
    if (path === `/api/projects/${PROJECT}/issues/counts`) return json({ openFindings: 100, openGroups: 14, bySeverity: { CRITICAL: 0, HIGH: 5, MEDIUM: 9, LOW: 0 }, pagesCrawled: 38, healthScore: 83 });
    if (path === `/api/projects/${PROJECT}/issues/groups`) return json({ groups: [], reachAvailable: false });
    if (path === `/api/projects/${PROJECT}/audit-report/latest`) return json(null);
    return baseApi(route);
  });

  await page.goto("/website?tab=report", { waitUntil: "domcontentloaded" });
  const tabs = ["Overview", "Technical health", "Speed", "Pages", "Content", "Problems to fix", "Full Report"];
  for (const name of tabs) {
    const tab = page.getByRole("tab", { name: new RegExp(name, "i") });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(new RegExp(`tab=${name === "Technical health" ? "technical-seo" : name === "Speed" ? "performance" : name === "Problems to fix" ? "issues" : name === "Full Report" ? "report" : name.toLowerCase()}`));
  }
});

test("Technical health keeps measured zeroes hidden while page data is loading", async ({ page }) => {
  await authenticate(page);
  await page.route(`${API_BASE}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (path === `/api/websites/${DOMAIN}/latest-crawl`) return json({ id: "crawl_1", status: "COMPLETED", healthScore: 83, pagesCrawled: 38 });
    if (path === "/api/crawls/crawl_1/issues" || path === "/api/crawls/crawl_1/pages") {
      await new Promise((resolve) => setTimeout(resolve, 1_200));
      return json(path.endsWith("/issues")
        ? { data: [], meta: { total: 0, page: 1, limit: 100, totalPages: 0, totalFindings: 0, uniqueOpenIssues: 0, resolvedIssues: 0, countsBySeverity: {}, countsByCategory: {}, countsByConfidence: {} } }
        : { data: [], meta: { total: 0, page: 1, totalPages: 0 } });
    }
    if (path === `/api/projects/${PROJECT}/issues/counts`) return json({ openFindings: 100, openGroups: 14, pagesCrawled: 38, healthScore: 83, bySeverity: {} });
    if (path === `/api/projects/${PROJECT}/issues/groups`) return json({ groups: [], reachAvailable: false });
    if (path === `/api/websites/${DOMAIN}/crawl-history`) return json([]);
    return baseApi(route);
  });

  await page.goto("/website?tab=technical-seo", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".animate-pulse").first()).toBeVisible();
  await expect(page.getByText("0 pages scored", { exact: true })).toHaveCount(0);
  await expect(page.getByText("0% Optimal", { exact: true })).toHaveCount(0);
});

test("the Google entry route uses the authoritative unconnected overview", async ({ page }) => {
  await authenticate(page);
  await page.route(`${API_BASE}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === `/api/projects/${PROJECT}/google/overview`) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        days: 28,
        sources: {
          searchConsole: { connected: false, state: "NOT_CONNECTED", message: null, lastSyncedAt: null, hasData: false, propertyName: null, accountEmail: null },
          analytics: { connected: false, state: "NOT_CONNECTED", message: null, lastSyncedAt: null, hasData: false, propertyName: null, accountEmail: null, needsRefresh: false },
          crawler: { lastCrawledAt: null },
        },
        windows: { search: null, analytics: null }, kpis: [], series: { search: [], organic: [] }, funnel: [], headlines: [],
      }) });
    }
    return baseApi(route);
  });

  await page.goto("/google", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/google\/overview$/);
  await expect(page.getByText("Neither Search Console nor Google Analytics is connected", { exact: false })).toBeVisible();
  await expect(page.getByText("81.5%", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Direct", { exact: true })).toHaveCount(0);
});

test("competitor analysis tabs show an add-competitor state when the list is empty", async ({ page }) => {
  await authenticate(page);
  await page.route(`${API_BASE}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === `/api/projects/${PROJECT}/competitors`) {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
    return baseApi(route);
  });

  for (const tab of ["gaps", "radar", "report"]) {
    await page.goto(`/competitor-intelligence?tab=${tab}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Add a competitor to compare" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add competitor" })).toBeVisible();
    await expect(page.getByText(/Why your 0 rivals rank/)).toHaveCount(0);
  }
});

test("voice recognition starts only after the user taps the voice control", async ({ page }) => {
  await authenticate(page);
  await page.addInitScript(() => {
    (window as unknown as { __speechStarts: number }).__speechStarts = 0;
    class FakeSpeechRecognition {
      continuous = false;
      interimResults = false;
      lang = "";
      onresult = null;
      onerror = null;
      onend = null;
      start() { (window as unknown as { __speechStarts: number }).__speechStarts += 1; }
      stop() {}
    }
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: FakeSpeechRecognition });
    Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, value: FakeSpeechRecognition });
  });
  await page.route(`${API_BASE}/**`, baseApi);

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __speechStarts: number }).__speechStarts)).toBe(0);

  await page.getByRole("button", { name: "Open Nexa Voice Assistant" }).click();
  await page.getByRole("button", { name: "Start voice input" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __speechStarts: number }).__speechStarts)).toBe(1);
});

test("every report card has a working destination", async ({ page }) => {
  await authenticate(page);
  await page.route(`${API_BASE}/**`, baseApi);
  const destinations = [
    ["Complete improvement plan", "/reports/plan"],
    ["Website Audit", "/website?tab=report"],
    ["Google", "/reports/google"],
    ["Competitor Intelligence", "/competitor-intelligence?tab=report"],
    ["AI Visibility", "/reports/ai-visibility"],
    ["Google Business Profile", "/reports/business-profile"],
  ] as const;

  await page.goto("/reports", { waitUntil: "domcontentloaded" });
  for (const [name, href] of destinations) {
    const card = page.locator(`a[href="${href}"]`).filter({ hasText: name });
    await expect(card).toHaveAttribute("href", href);
  }
});
