/**
 * The Google section joins Search Console, Google Analytics and the crawl.
 *
 * Like google-search.spec.ts, this serves the app a known answer and checks it
 * shows that answer — and, as importantly, that a figure nobody measured is
 * never drawn as a zero. The route smoke test runs with no API at all, so it
 * proves a page survives its data failing, not that it reads its data
 * correctly.
 *
 * Set GOOGLE_SHOTS_DIR to also save a screenshot of each screen.
 */
import { test, expect, type Page, type Route } from "@playwright/test";
import { API_BASE } from "./api-base";

const API = API_BASE;
const ORG = "org_test";
const PROJECT = "proj_test";
const G = `/api/projects/${PROJECT}/google`;
const SITE = "https://milquu.in";
const MILK = `${SITE}/products/milk/`;
const BLOG = `${SITE}/blog/why-a2`;

const day = (n: number) => new Date(Date.UTC(2026, 8, 1 + n)).toISOString().slice(0, 10);
const SEARCH_SERIES = Array.from({ length: 28 }, (_, i) => ({ date: day(i), clicks: 10 + (i % 5), impressions: 900 + i * 10, ctr: 0.011 + (i % 5) / 1000, position: 9 - (i % 3) / 10 }));
const ORGANIC_SERIES = Array.from({ length: 28 }, (_, i) => ({ date: day(i), sessions: 4 + (i % 4), users: 3 + (i % 3), keyEvents: null, revenue: null }));

function kpis(over: { search?: boolean; organic?: boolean } = {}) {
  const s = over.search !== false;
  const o = over.organic !== false;
  const k = (key: string, label: string, source: "GSC" | "GA4", format: string, value: number | null, previous: number | null, kind: "pct" | "pts" | "places" | null, delta: number | null, lower = false, spark: number[] | null = null, note: string | null = null) => ({
    key, label, source, format, value, previous, delta: kind && delta !== null ? { kind, value: delta } : null, lowerIsBetter: lower, sparkline: spark, note,
  });
  const noS = "Search Console has no data for this period.";
  const noG = "Google Analytics has no organic data for this period.";
  return [
    k("clicks", "Organic clicks", "GSC", "count", s ? 320 : null, s ? 480 : null, "pct", s ? -33.3 : null, false, s ? [1, 2, 3, 2] : null, s ? null : noS),
    k("impressions", "Impressions", "GSC", "count", s ? 26000 : null, s ? 10000 : null, "pct", s ? 160 : null, false, s ? [1, 2, 3, 4] : null, s ? null : noS),
    k("ctr", "Average CTR", "GSC", "percent", s ? 0.0123 : null, s ? 0.048 : null, "pts", s ? -3.7 : null, false, null, s ? null : noS),
    k("position", "Average position", "GSC", "position", s ? 9.4 : null, s ? 7.9 : null, "places", s ? 1.5 : null, true, null, s ? null : noS),
    k("organicUsers", "Organic users", "GA4", "count", o ? 81 : null, o ? 40 : null, "pct", o ? 102.5 : null, false, o ? [1, 2, 3] : null, o ? null : noG),
    k("organicSessions", "Organic sessions", "GA4", "count", o ? 112 : null, o ? 55 : null, "pct", o ? 103.6 : null, false, null, o ? null : noG),
    k("engagementRate", "Engagement rate", "GA4", "percent", o ? 0.61 : null, o ? 0.5 : null, "pts", o ? 11 : null, false, null, o ? null : noG),
    // Not set up: null with the reason, never a zero.
    k("keyEvents", "Key events", "GA4", "count", null, null, null, null, false, null, o ? "No key events are set up in this Google Analytics property." : noG),
  ];
}

function funnel(search = true) {
  const s = (key: string, label: string, source: string, value: number | null, rate: number | null, rateLabel: string | null, note: string | null) => ({ key, label, source, value, rate, rateLabel, note });
  return [
    s("impressions", "Impressions", "GSC", search ? 26000 : null, null, null, search ? null : "Search Console has no data for this period."),
    s("clicks", "Clicks", "GSC", search ? 320 : null, search ? 0.0123 : null, "click-through rate", search ? null : "Search Console has no data for this period."),
    s("sessions", "Organic sessions", "GA4", 112, search ? 0.35 : null, "sessions per click", null),
    s("engaged", "Engaged sessions", "GA4", 68, 0.61, "engagement rate", null),
    s("keyEvents", "Key events", "GA4", null, null, "key events per session", "No key events are set up in this Google Analytics property."),
    s("revenue", "Revenue", "GA4", null, null, null, "No revenue is recorded in this Google Analytics property."),
  ];
}

interface OverviewSetup {
  searchHasData?: boolean;
  gaConnected?: boolean;
  scConnected?: boolean;
}

function overview(o: OverviewSetup = {}) {
  const sc = o.scConnected !== false;
  const ga = o.gaConnected !== false;
  const hasSearch = sc && o.searchHasData !== false;
  return {
    days: 28,
    sources: {
      searchConsole: { connected: sc, state: !sc ? "NOT_CONNECTED" : hasSearch ? "READY" : "NEVER_SYNCED", message: null, lastSyncedAt: sc ? "2026-09-29T04:00:00Z" : null, hasData: hasSearch, propertyName: "milquu.in", accountEmail: "owner@milquu.in" },
      analytics: { connected: ga, state: ga ? "READY" : "NOT_CONNECTED", message: null, lastSyncedAt: ga ? "2026-09-29T08:00:00Z" : null, hasData: ga, propertyName: "milquufresh", accountEmail: "owner@milquu.in", needsRefresh: false },
      crawler: { lastCrawledAt: "2026-09-28T10:00:00Z" },
    },
    windows: {
      search: hasSearch ? { start: day(0), end: day(27), comparison: { start: day(-28), end: day(-1) } } : null,
      analytics: ga ? { start: day(0), end: day(27), comparison: { start: day(-28), end: day(-1) } } : null,
    },
    kpis: kpis({ search: hasSearch, organic: ga }),
    series: { search: hasSearch ? SEARCH_SERIES : [], organic: ga ? ORGANIC_SERIES : [] },
    funnel: funnel(hasSearch),
    headlines: hasSearch
      ? [
          {
            id: "visibility-outpaces-clicks",
            tone: "warn",
            text: "Search visibility rose 160.0%, but clicks fell 33.3%, because click-through rate fell from 4.8% to 1.2%. 7 pages are seen often and clicked rarely for where they rank.",
            evidence: [
              { label: "Clicks", value: "320 (−33.3%)", source: "GSC" },
              { label: "Impressions", value: "26,000 (+160.0%)", source: "GSC" },
            ],
            links: [{ label: "View affected pages", view: "pages", segment: "high-impressions-low-ctr" }],
            confidence: "HIGH",
            source: "GSC",
          },
          {
            id: "no-key-events",
            tone: "neutral",
            text: "No key events are set up in your Google Analytics property, so Google visits cannot yet be connected to business results.",
            evidence: [{ label: "Key events", value: "not set up", source: "GA4" }],
            links: [],
            confidence: "HIGH",
            source: "GA4",
          },
        ]
      : [],
  };
}

const ROW_MILK = {
  key: "/products/milk",
  url: MILK,
  gsc: { clicks: 210, impressions: 14000, ctr: 0.015, position: 6.2, previousClicks: 300, previousImpressions: 9000, clicksChangePct: -30 },
  ga: { users: 60, sessions: 80, engagementRate: 0.7, averageEngagementTimeSec: 95, keyEvents: null, revenue: null },
  technicalRisk: null,
  segments: ["top-traffic", "declining", "ranking-opportunity"],
  trend: Array.from({ length: 28 }, (_, i) => 5 + (i % 6)),
};
const ROW_BLOG = {
  key: "/blog/why-a2",
  url: BLOG,
  gsc: { clicks: 40, impressions: 2000, ctr: 0.02, position: 14.1, previousClicks: 30, previousImpressions: 1800, clicksChangePct: 33.3 },
  ga: null,
  technicalRisk: "Google: Crawled - currently not indexed",
  segments: ["top-traffic", "growing", "technical-risk"],
  trend: [],
};

function pages(rows = [ROW_MILK, ROW_BLOG], segmentCounts: Record<string, number> = {}) {
  return {
    days: 28,
    windows: { search: { start: day(0), end: day(27), comparison: { start: day(-28), end: day(-1) } }, analytics: { start: day(0), end: day(27) } },
    sources: { searchConsole: { hasData: true }, analytics: { state: "READY", message: null, hasOrganic: true, needsRefresh: false, conversionsMeasured: false } },
    criteria: { declining: "Clicks down at least 20% on the previous period, with at least 10 clicks then." },
    segmentCounts: { "top-traffic": 2, "top-impressions": 2, "top-converting": 0, declining: 1, growing: 1, "high-impressions-low-ctr": 0, "high-traffic-low-conversion": 0, "low-traffic-high-conversion": 0, "ranking-opportunity": 1, "technical-risk": 1, ...segmentCounts },
    total: rows.length,
    rows,
  };
}

const DETAIL = {
  days: 28,
  key: "/products/milk",
  url: MILK,
  found: true,
  gsc: ROW_MILK.gsc,
  ga: { users: 60, sessions: 80, engagedSessions: 56, views: 130, engagementRate: 0.7, averageEngagementTimeSec: 95, keyEvents: null, revenue: null },
  queries: [{ query: "cow milk delivery navi mumbai", clicks: 90, impressions: 4200, ctr: 0.021, position: 7.2 }],
  history: Array.from({ length: 28 }, (_, i) => ({ date: day(i), clicks: 6 + (i % 4), impressions: 480, ctr: 0.015, position: 6 + (i % 3) / 5 })),
  funnel: funnel(),
  index: { verdict: "PASS", coverageState: "Submitted and indexed", lastCrawlTime: "2026-09-27T00:00:00Z", googleCanonical: MILK, inspectedAt: "2026-09-28T00:00:00Z", error: null, meaning: "In Google and listed in your sitemap.", action: null },
  crawl: { url: MILK, crawledAt: "2026-09-28T10:00:00Z", statusCode: 200, responseTimeMs: 420, title: "Fresh cow milk", metaDescription: null, canonicalUrl: null, h1Count: 1, wordCount: 640, indexability: "INDEXABLE", jsRequired: false, schemas: [{ type: "PRODUCT", valid: true }], performance: { performanceScore: 82, lcpMs: 2100, clsScore: 0.02, inpMs: 120 }, internalLinksIn: 6, internalLinksOut: 14, openIssues: [{ severity: "MEDIUM", issueType: "MISSING_META_DESCRIPTION", description: "The page has no meta description." }] },
  diagnosis: [
    {
      id: "clicks-down",
      tone: "bad",
      text: "Clicks from Google fell from 300 to 210 against the previous period.",
      evidence: [{ label: "Clicks now", value: "210", source: "GSC" }, { label: "Clicks before", value: "300", source: "GSC" }],
      action: "Check which searches lost position below, and whether the page changed recently.",
      source: "GSC",
      confidence: "HIGH",
    },
  ],
  windows: { analytics: { start: day(0), end: day(27) } },
};

async function open(page: Page, path: string, setup: { overview?: OverviewSetup; pages?: unknown; failOverview?: boolean } = {}) {
  await page.addInitScript(() => window.localStorage.setItem("growthx.token", "smoke-test-token"));
  await page.route(`${API}/**`, async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const p = url.pathname;
    const json = (body: unknown, code = 200) => route.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(body) });

    if (p === "/organizations") return json([{ id: ORG, name: "Test Org", slug: "test" }]);
    if (p === `/projects/org/${ORG}`) return json([{ id: PROJECT, name: "Milquu" }]);
    if (p === `/api/organizations/${ORG}/portfolio`) return json({ clients: [], summary: {}, alerts: [] });
    if (p === `${G}/overview`) return setup.failOverview ? json({ message: "Boom" }, 500) : json(overview(setup.overview));
    if (p === `${G}/pages`) return json(setup.pages ?? pages());
    if (p === `${G}/page`) return json(DETAIL);
    return json({}, 404);
  });
  await page.goto(path, { waitUntil: "domcontentloaded" });
}

async function shot(page: Page, name: string) {
  const dir = process.env.GOOGLE_SHOTS_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

test.describe("Google section, Overview", () => {
  test("shows the plain-language headline, eight KPIs with their sources, and the funnel", async ({ page }) => {
    await open(page, "/google/overview");

    // The page title comes from the view's label in components/google/nav.ts.
    await expect(page.getByRole("heading", { name: "Combined overview", level: 1 })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Search visibility rose 160.0%")).toBeVisible();
    await expect(page.getByText("because click-through rate fell from 4.8% to 1.2%")).toBeVisible();

    for (const label of ["Organic clicks", "Impressions", "Average CTR", "Average position", "Organic users", "Organic sessions", "Engagement rate", "Key events"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
    // Position improves as it falls, so a rise of 1.5 places is shown as a worsening, not a gain.
    await expect(page.getByText("+1.5 places")).toBeVisible();
    await expect(page.getByText("From Google search to business result")).toBeVisible();
    await shot(page, "overview");
  });

  test("never draws an unmeasured figure as zero", async ({ page }) => {
    await open(page, "/google/overview");
    await expect(page.getByText("Search visibility rose 160.0%")).toBeVisible({ timeout: 15_000 });

    // Key events are not set up: the card says so, and shows a dash rather than 0.
    const card = page.locator("div", { has: page.getByText("Key events", { exact: true }) }).filter({ hasText: "No key events are set up" }).first();
    await expect(card).toBeVisible();
    await expect(card.getByText("—").first()).toBeVisible();
    // The funnel names why revenue is empty.
    await expect(page.getByText("No revenue is recorded in this Google Analytics property.")).toBeVisible();
  });

  test("the Google entry route opens the authoritative overview and keeps hidden views out of navigation", async ({ page }) => {
    await open(page, "/google");
    await expect(page).toHaveURL(/\/google\/overview$/);
    await expect(page.getByRole("heading", { name: "Combined overview", level: 1 })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("navigation", { name: "Google sections" })).toBeVisible();

    await open(page, "/google/keywords");
    const nav = page.getByRole("navigation", { name: "Google sections" });
    // Keywords, Pages and Google Index are `hidden` in components/google/nav.ts: they
    // stay out of the section nav, and appear in it only while you are on that page.
    // From /google/keywords that leaves the Search Console link, Search Performance
    // and Keywords itself. Pages and Google Index must not be offered here.
    await expect(nav.getByRole("link")).toHaveText(["Search Console", "Search Performance", "Keywords"], { timeout: 15_000 });
  });

  test("shows Search Console as connected but empty, with blanks instead of zeros", async ({ page }) => {
    await open(page, "/google/overview", { overview: { searchHasData: false } });
    await expect(page.getByText("Search Console is connected but nothing has been fetched from it yet")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Search Console has no data for this period.").first()).toBeVisible();
    await shot(page, "overview-no-search-data");
  });

  test("asks for Analytics when only Search Console is connected", async ({ page }) => {
    await open(page, "/google/overview", { overview: { gaConnected: false } });
    await expect(page.getByText("Connect Google Analytics to unlock user behavior and conversion intelligence.")).toBeVisible({ timeout: 15_000 });
  });

  test("asks for Search Console when only Analytics is connected", async ({ page }) => {
    await open(page, "/google/overview", { overview: { scConnected: false } });
    await expect(page.getByText("Connect Search Console to unlock Google Search visibility intelligence.")).toBeVisible({ timeout: 15_000 });
  });

  test("says so, and offers Integrations, when neither is connected", async ({ page }) => {
    await open(page, "/google/overview", { overview: { scConnected: false, gaConnected: false } });
    await expect(page.getByText("Connect Google to see how your website performs")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: "Open Integrations" })).toBeVisible();
  });

  test("shows the error and a Retry button when the API fails", async ({ page }) => {
    await open(page, "/google/overview", { failOverview: true });
    await expect(page.getByText("Could not load Google performance")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /Retry/ })).toBeVisible();
  });
});

test.describe("Google section, other views", () => {
  test("an unknown view is a 404, not an empty page", async ({ page }) => {
    await open(page, "/google/nonsense");
    await expect(page.getByText(/could not be found|404/i).first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Google section, Pages", () => {
  test("lists organic pages with search and visit figures side by side, and dashes where a source has none", async ({ page }) => {
    await open(page, "/google/pages");
    await expect(page.getByText("All organic pages").first()).toBeVisible({ timeout: 15_000 });

    const milk = page.getByRole("row", { name: /\/products\/milk/ });
    await expect(milk).toContainText("210");
    await expect(milk).toContainText("14,000");
    await expect(milk).toContainText("1.5%");
    await expect(milk).toContainText("70.0%");

    // The blog post has no Analytics row: its visit columns are dashes, not zeros.
    const blog = page.getByRole("row", { name: /\/blog\/why-a2/ });
    await expect(blog).toContainText("risk");
    expect((await blog.getByRole("cell").allInnerTexts()).filter((t) => t === "—").length).toBeGreaterThanOrEqual(3);
    await shot(page, "pages");
  });

  test("filters by segment through the URL and shows the rule behind it", async ({ page }) => {
    await open(page, "/google/pages?segment=declining", { pages: pages([ROW_MILK]) });
    await expect(page.getByText("Clicks down at least 20% on the previous period")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /Declining/ })).toHaveAttribute("aria-pressed", "true");
  });

  test("opens a page's profile with its diagnosis, evidence and sources", async ({ page }) => {
    await open(page, "/google/pages");
    await page.getByRole("row", { name: /\/products\/milk/ }).click();

    await expect(page.getByText("Why is this page performing this way?")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Clicks from Google fell from 300 to 210")).toBeVisible();
    await expect(page.getByText("What to do:")).toBeVisible();
    await expect(page.getByText("cow milk delivery navi mumbai")).toBeVisible();
    await expect(page.getByText("The page has no meta description.")).toBeVisible();
    await expect(page.getByText("Submitted and indexed")).toBeVisible();
    // Key events are not set up, so the funnel says why instead of showing zero.
    await expect(page.getByText("No key events are set up in this Google Analytics property.").first()).toBeVisible();
    await shot(page, "page-detail");

    await page.getByRole("button", { name: "All pages" }).click();
    await expect(page.getByText("All organic pages").first()).toBeVisible();
  });

  test("says why there are no pages when a segment is empty", async ({ page }) => {
    await open(page, "/google/pages?segment=top-converting", { pages: pages([]) });
    await expect(page.getByText("No pages match this segment")).toBeVisible({ timeout: 15_000 });
  });
});
