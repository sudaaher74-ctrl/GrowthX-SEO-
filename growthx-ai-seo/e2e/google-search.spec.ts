/**
 * The Google Search page runs on the customer's own Search Console and
 * Analytics, and says so plainly when it has neither.
 *
 * Like tokens.spec.ts, this serves the app a known answer and checks it shows
 * that answer. The route smoke test runs with no API at all, so it proves a page
 * survives its data failing and says nothing about whether it reads its data
 * correctly. The failure this guards against is the one that made the page
 * unusable: every useful tab demanded a paid third-party account the customer
 * cannot connect, and told them to "add credentials on Render".
 *
 * The fixtures are shaped like real responses: they were captured from the API
 * running against PostgreSQL with 70 days of Search Console and GA4 rows.
 */
import { test, expect, type Page, type Route } from "@playwright/test";

const API = "http://localhost:3000";
const ORG = "org_test";
const PROJECT = "proj_test";
const SI = `/api/projects/${PROJECT}/search-intelligence`;
const SITE = "https://milquu.in";

interface Status {
  searchConsoleConnected: boolean;
  analyticsConnected: boolean;
  googleResultsConnected: boolean;
}
const BOTH: Status = { searchConsoleConnected: true, analyticsConnected: true, googleResultsConnected: false };

const status = (over: Partial<Status> = {}) => ({
  ...BOTH,
  ...over,
  market: { country: "India", language: "en", source: "DEFAULT" },
});

const A2 = `${SITE}/products/a2-milk`;
const WHY = `${SITE}/blog/why-a2`;
const GHEE = `${SITE}/products/ghee`;

function search(query: string, position: number, previous: number | null, clicks: number, impressions: number, page: string, sessions: number | null, conversions: number | null) {
  return {
    query,
    position,
    previousPosition: previous,
    movement: previous === null ? null : Math.round((previous - position) * 10) / 10,
    clicks,
    impressions,
    ctr: clicks / impressions,
    page,
    visits: sessions === null ? null : { sessions, conversions },
  };
}

const ROWS = [
  search("a2 cow milk pune", 3.2, 4.6, 408, 1778, A2, 2031, 90),
  search("a2 milk delivery near me", 8.4, 5.1, 28, 869, A2, 2031, 90),
  search("benefits of a2 milk", 12.6, 12.9, 28, 627, WHY, 988, 0),
  search("organic ghee online", 6.8, 9.9, 28, 519, GHEE, 590, 28),
  search("cow milk subscription pune", 4.2, 4.3, 0, 1029, A2, 2031, 90),
  search("buffalo milk vs cow milk", 31.2, 30.7, 0, 266, WHY, 988, 0),
];

function rankings(over: Record<string, unknown> = {}) {
  return {
    connected: true,
    analyticsConnected: true,
    hasData: true,
    analyticsHasData: true,
    days: 28,
    range: { start: "2026-08-31T00:00:00.000Z", end: "2026-09-27T00:00:00.000Z" },
    comparisonRange: { start: "2026-08-03T00:00:00.000Z", end: "2026-08-30T00:00:00.000Z" },
    summary: { searches: 6, top3: 0, pageOne: 4, pageTwo: 1, beyond: 1, movedUp: 2, movedDown: 1 },
    rows: ROWS,
    ...over,
  };
}

/** Every visit column empty, as it is for a workspace whose Analytics is not connected. */
const withoutVisits = (rows: typeof ROWS) => rows.map((r) => ({ ...r, visits: null }));

const DIAGNOSIS = {
  id: "d1",
  createdAt: "2026-09-29T04:55:01.822Z",
  mode: "SEARCH_CONSOLE",
  keyword: "a2 milk delivery near me",
  pageUrl: A2,
  market: null,
  checkedAt: "2026-09-29T04:55:01.821Z",
  verdict: "PAGE_ONE",
  verdictText: "Averaging position 8.4, on page one but below the top three where most clicks go.",
  reasons: [
    {
      code: "POSITION_SLIPPING",
      severity: "MEDIUM",
      title: "Google showed this page higher for this search a month ago",
      detail: "Its average position got worse between the two periods. Search Console cannot say why.",
      evidence: [
        { label: "Average position, the 28 days before", value: "5.2", source: "Google Search Console" },
        { label: "Average position, last 28 days", value: "8.4", source: "Google Search Console" },
      ],
    },
    {
      code: "KEYWORD_NOT_IN_TITLE",
      severity: "LOW",
      title: "Your page title does not say what people search for",
      detail: 'The title is the first thing Google and searchers read, and yours does not use every word of "a2 milk delivery near me".',
      evidence: [
        { label: "Your title", value: "A2 Cow Milk 1L | Milquu", source: "Your page, read live" },
        { label: "Words of the search missing from it", value: "delivery", source: "Your page, read live" },
      ],
    },
  ],
  confidence: {
    level: "MEDIUM",
    basis: ["your Search Console numbers for this search, last 28 days", "your page, read just now"],
    missing: ["Google's live results are not part of this check, so it cannot say what the pages that outrank yours do differently"],
  },
  results: { position: 8.4, otherPageOfYours: null, intent: null, dominantFormat: null, features: [], questions: [], top: [] },
  comparison: {
    yours: {
      url: A2,
      domain: "",
      position: null,
      read: true,
      error: null,
      title: "A2 Cow Milk 1L | Milquu",
      heading: "A2 Cow Milk",
      wordCount: 101,
      subheadings: 0,
      structuredData: [],
      format: "PRODUCT",
      formatLabel: "product pages",
      keywordInTitle: false,
      keywordInHeading: false,
      keywordInAddress: false,
      keywordInOpening: false,
    },
    competitors: [],
    typical: null,
  },
  searchConsole: {
    clicks: 27,
    impressions: 835,
    ctr: 0.0323,
    position: 8.4,
    pages: [{ url: A2, clicks: 27, impressions: 835, ctr: 0.0323, position: 8.4 }],
    previous: { clicks: 46, impressions: 982, position: 5.2 },
  },
  visits: { days: 28, sessions: 2031, engagementRate: 0.71, conversions: 90 },
  indexStatus: null,
};

interface Setup {
  status?: Partial<Status>;
  rankings?: unknown;
  /** What POST /diagnose answers. */
  diagnose?: { status: number; body: unknown };
}

interface Seen {
  diagnose: Array<Record<string, unknown>>;
  sync: number;
  rankingsDays: string[];
}

/** Serves the requests this page makes; everything else fails, as it would in an outage. */
async function open(page: Page, setup: Setup = {}): Promise<Seen> {
  const seen: Seen = { diagnose: [], sync: 0, rankingsDays: [] };
  await page.addInitScript(() => window.localStorage.setItem("growthx.token", "smoke-test-token"));
  await page.route(`${API}/**`, async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const json = (body: unknown, code = 200) => route.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(body) });

    if (path === "/organizations") return json([{ id: ORG, name: "Test Org", slug: "test" }]);
    if (path === `/projects/org/${ORG}`) return json([{ id: PROJECT, name: "Milquu" }]);
    if (path === `/api/organizations/${ORG}/portfolio`) return json({ clients: [], summary: {}, alerts: [] });
    if (path === `${SI}/status`) return json(status(setup.status));
    if (path === `${SI}/search-rankings`) {
      seen.rankingsDays.push(url.searchParams.get("days") ?? "");
      return json(setup.rankings ?? rankings());
    }
    if (path === `${SI}/rankings`) {
      return json({ connected: true, market: status().market, limit: 25, keywords: [], overtakenBy: [], youOvertook: [] });
    }
    if (path === `${SI}/diagnoses`) return json([]);
    if (path === `${SI}/diagnose` && request.method() === "POST") {
      seen.diagnose.push(request.postDataJSON());
      const answer = setup.diagnose ?? { status: 201, body: DIAGNOSIS };
      return json(answer.body, answer.status);
    }
    if (path === `/api/projects/${PROJECT}/search-console/sync` && request.method() === "POST") {
      seen.sync += 1;
      return json({ status: "COMPLETED" });
    }
    return json({}, 404);
  });
  await page.goto("/search-intelligence", { waitUntil: "domcontentloaded" });
  return seen;
}

const tabNames = (page: Page) => page.getByRole("tab").allInnerTexts();

test.describe("Google Search, connected to Search Console and Analytics", () => {
  test("opens on the customer's own rankings, with no mention of a paid source", async ({ page }) => {
    await open(page);

    await expect(page.getByText("Where Google shows you")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Search Console connected")).toBeVisible();
    await expect(page.getByText("Google Analytics 4 connected")).toBeVisible();
    expect(await tabNames(page)).toEqual(["Rankings", "Why not ranking", "Index status", "Change results", "Risk check"]);

    // What an operator would have to fix is not the customer's to read.
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/dataforseo|render|credentials/i);
    // Market only matters to live results, which this platform does not have.
    await expect(page.getByText("Google results for")).toHaveCount(0);
    await expect(page.getByText("Live Google results on")).toHaveCount(0);
  });

  test("shows each search with its average position, where it moved, and the visits its page gets", async ({ page }) => {
    await open(page);
    await expect(page.getByText("Where Google shows you")).toBeVisible({ timeout: 15_000 });

    // The four summary figures, from the API's own counts.
    await expect(page.getByText("Searches you appear for")).toBeVisible();
    await expect(page.getByText("0 in the top 3")).toBeVisible();
    await expect(page.getByText("against the 28 days before").first()).toBeVisible();

    const slipped = page.getByRole("row", { name: /a2 milk delivery near me/ });
    await expect(slipped).toContainText("8.4");
    await expect(slipped).toContainText("869");
    await expect(slipped).toContainText("3.2%");
    await expect(slipped).toContainText("/products/a2-milk");
    await expect(slipped).toContainText("2,031");
    // Down 3.3 places since the period before, with the earlier figure a hover away.
    await expect(slipped.getByTitle("Was 5.1 in the period before")).toContainText("3.3");

    // Up, and a wobble too small to call a move.
    await expect(page.getByRole("row", { name: /organic ghee online/ }).getByTitle("Was 9.9 in the period before")).toContainText("3.1");
    await expect(page.getByRole("row", { name: /benefits of a2 milk/ }).getByTitle(/Was/)).toHaveCount(0);

    await expect(page.getByRole("columnheader", { name: "Page visits" })).toBeVisible();
    await expect(page.getByText("from any source")).toBeVisible();
  });

  test("filters by where the searches stand", async ({ page }) => {
    await open(page);
    await expect(page.getByText("Where Google shows you")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "4–10" }).click();
    await expect(page.getByRole("row", { name: /a2 cow milk pune/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /organic ghee online/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /benefits of a2 milk/ })).toHaveCount(0);
    await expect(page.getByRole("row", { name: /buffalo milk/ })).toHaveCount(0);

    await page.getByRole("button", { name: "21+" }).click();
    await expect(page.getByRole("row", { name: /buffalo milk vs cow milk/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /a2 cow milk pune/ })).toHaveCount(0);

    await page.getByRole("button", { name: "Top 3" }).click();
    await expect(page.getByText("No searches in this range")).toBeVisible();
  });

  test("lists a long table in pages rather than all at once", async ({ page }) => {
    const many = Array.from({ length: 60 }, (_, i) => search(`long tail search ${i + 1}`, 14, null, 60 - i, 40, A2, null, null));
    await open(page, { rankings: rankings({ rows: many, summary: { searches: 60, top3: 0, pageOne: 0, pageTwo: 60, beyond: 0, movedUp: 0, movedDown: 0 } }) });
    await expect(page.getByText("Where Google shows you")).toBeVisible({ timeout: 15_000 });

    await expect(page.getByRole("row", { name: /long tail search/ })).toHaveCount(25);
    await page.getByRole("button", { name: "Show 25 more" }).click();
    await expect(page.getByRole("row", { name: /long tail search/ })).toHaveCount(50);
    await page.getByRole("button", { name: "Show 10 more" }).click();
    await expect(page.getByRole("row", { name: /long tail search/ })).toHaveCount(60);
    await expect(page.getByRole("button", { name: /Show \d+ more/ })).toHaveCount(0);
  });

  test("follows the 7d / 28d / 90d control in the top bar", async ({ page }) => {
    const seen = await open(page);
    await expect(page.getByText("Where Google shows you")).toBeVisible({ timeout: 15_000 });
    expect(seen.rankingsDays).toEqual(["28"]);

    await page.getByRole("button", { name: "90d" }).click();
    await expect.poll(() => seen.rankingsDays).toContain("90");
  });

  test("carries a search from the table into the diagnosis, and runs it", async ({ page }) => {
    const seen = await open(page);
    await expect(page.getByText("Where Google shows you")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("row", { name: /a2 milk delivery near me/ }).getByRole("button", { name: "Diagnose" }).click();

    // Diagnosed as the tab opens, for the page Google showed, with the form filled in to match.
    await expect(page.getByText("Averaging position 8.4, on page one")).toBeVisible({ timeout: 15_000 });
    expect(seen.diagnose).toEqual([{ keyword: "a2 milk delivery near me", pageUrl: A2 }]);
    await expect(page.getByPlaceholder("a2 cow milk delivery pune")).toHaveValue("a2 milk delivery near me");

    await expect(page.getByText("avg #8.4")).toBeVisible();
    await expect(page.getByText("medium confidence")).toBeVisible();
    await expect(page.getByText("Search Console, last 28 days").first()).toBeVisible();
    // Honest about what it did not look at.
    await expect(page.getByText(/did not look at Google's results/)).toBeVisible();

    await expect(page.getByText("Why it is not ranking higher (2)")).toBeVisible();
    await expect(page.getByText("Google showed this page higher for this search a month ago")).toBeVisible();
    await expect(page.getByText("Words of the search missing from it:")).toBeVisible();

    // The 28 days before, and what Analytics saw on the page.
    await expect(page.getByText(/The 28 days before: 982 times shown, 46 clicks, average position 5\.2/)).toBeVisible();
    await expect(page.getByText("Visitors to this page")).toBeVisible();
    await expect(page.getByText("2,031", { exact: true })).toBeVisible();
    await expect(page.getByText("71%")).toBeVisible();

    // Nothing that needs to have seen the results page.
    await expect(page.getByText("Your page next to the pages that rank")).toHaveCount(0);
    await expect(page.getByText("Google's top results")).toHaveCount(0);
    await expect(page.getByText("What Google wants for this search")).toHaveCount(0);
    await expect(page.getByText("Read live just now")).toBeVisible();
  });

  test("diagnoses a typed search without running anything until asked", async ({ page }) => {
    const seen = await open(page);
    await page.getByRole("tab", { name: "Why not ranking" }).click();
    await expect(page.getByText("Reads how Google has been showing your page")).toBeVisible({ timeout: 15_000 });
    expect(seen.diagnose).toEqual([]);

    await page.getByPlaceholder("a2 cow milk delivery pune").fill("a2 milk delivery near me");
    await page.getByRole("button", { name: "Diagnose", exact: true }).click();
    await expect(page.getByText("Why it is not ranking higher (2)")).toBeVisible();
    expect(seen.diagnose).toEqual([{ keyword: "a2 milk delivery near me" }]);
  });

  test("shows the reason in the customer's words when a diagnosis cannot run", async ({ page }) => {
    await open(page, {
      diagnose: {
        status: 400,
        body: { message: 'Google has not shown any of your pages for "zebra" in the last 28 days, so there is no page to diagnose.', statusCode: 400 },
      },
    });
    await page.getByRole("tab", { name: "Why not ranking" }).click();
    await page.getByPlaceholder("a2 cow milk delivery pune").fill("zebra");
    await page.getByRole("button", { name: "Diagnose", exact: true }).click();
    await expect(page.getByText(/Google has not shown any of your pages for "zebra"/)).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Google Search, without Analytics", () => {
  test("leaves out visits and says what connecting would add", async ({ page }) => {
    await open(page, {
      status: { analyticsConnected: false },
      rankings: rankings({ analyticsConnected: false, analyticsHasData: false, rows: withoutVisits(ROWS) }),
    });
    await expect(page.getByText("Where Google shows you")).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText("Google Analytics 4 not connected")).toBeVisible();
    await expect(page.getByText("Search Console connected")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Page visits" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Connect Google Analytics 4" })).toHaveAttribute("href", "/integrations");
    // Everything Search Console knows is still there.
    await expect(page.getByRole("row", { name: /a2 milk delivery near me/ })).toContainText("869");
  });

  test("shows the same prompt where the diagnosis would show visits", async ({ page }) => {
    await open(page, { status: { analyticsConnected: false }, diagnose: { status: 201, body: { ...DIAGNOSIS, visits: null } } });
    await page.getByRole("tab", { name: "Why not ranking" }).click();
    await page.getByPlaceholder("a2 cow milk delivery pune").fill("a2 milk delivery near me");
    await page.getByRole("button", { name: "Diagnose", exact: true }).click();

    await expect(page.getByText("Visitors to this page")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("See how many people visit this page and whether they take action.")).toBeVisible();
  });

  test("says when Analytics is connected but recorded nothing for the page", async ({ page }) => {
    await open(page, { diagnose: { status: 201, body: { ...DIAGNOSIS, visits: null } } });
    await page.getByRole("tab", { name: "Why not ranking" }).click();
    await page.getByPlaceholder("a2 cow milk delivery pune").fill("a2 milk delivery near me");
    await page.getByRole("button", { name: "Diagnose", exact: true }).click();

    await expect(page.getByText("Google Analytics 4 recorded no visits that started on this page in the last 28 days.")).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Google Search, connected but not yet fetched", () => {
  test("offers to fetch the data, and shows the table once it is there", async ({ page }) => {
    let fetched = false;
    const empty = rankings({ hasData: false, analyticsHasData: false, range: null, comparisonRange: null, summary: null, rows: [] });
    const seen = await open(page, { rankings: empty });
    // The first fetch fills the table: the next request for it answers with data.
    await page.route(`${API}${SI}/search-rankings*`, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fetched ? rankings() : empty) }),
    );
    await page.route(`${API}/api/projects/${PROJECT}/search-console/sync`, (route) => {
      fetched = true;
      seen.sync += 1;
      return route.fulfill({ status: 201, contentType: "application/json", body: "{}" });
    });
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(page.getByText("No search data has been fetched yet")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Fetch now" }).click();
    await expect(page.getByText("Where Google shows you")).toBeVisible();
    expect(seen.sync).toBe(1);
  });

  test("says why when the fetch fails", async ({ page }) => {
    const empty = rankings({ hasData: false, analyticsHasData: false, range: null, comparisonRange: null, summary: null, rows: [] });
    await open(page, { rankings: empty });
    await page.route(`${API}/api/projects/${PROJECT}/search-console/sync`, (route) =>
      route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Google is not reachable from here. Try again shortly." }) }),
    );
    await page.reload({ waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Fetch now" }).click();
    await expect(page.getByText("Google is not reachable from here. Try again shortly.")).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Google Search, nothing connected", () => {
  const NOTHING = { searchConsoleConnected: false, analyticsConnected: false };

  test("asks for the connections the page runs on, in the customer's words", async ({ page }) => {
    await open(page, { status: NOTHING });

    await expect(page.getByRole("heading", { name: "Connect Google Search Console" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Search Console not connected")).toBeVisible();
    await expect(page.getByText("Google Analytics 4 not connected")).toBeVisible();
    await expect(page.getByRole("link", { name: "Connect Google" })).toHaveAttribute("href", "/integrations");

    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/dataforseo|render|credentials/i);

    // The same prompt, not a different apology, wherever the page needs Google's data.
    await page.getByRole("tab", { name: "Why not ranking" }).click();
    await expect(page.getByRole("heading", { name: "Connect Google Search Console" })).toBeVisible();
    await page.getByRole("tab", { name: "Index status" }).click();
    await expect(page.getByRole("heading", { name: "Connect Google Search Console" })).toBeVisible();
    await page.getByRole("tab", { name: "Change results" }).click();
    await expect(page.getByRole("heading", { name: "Connect Google Search Console" })).toBeVisible();
  });

  test("does not ask for Analytics once it is connected, and asks only for what is missing", async ({ page }) => {
    await open(page, { status: { searchConsoleConnected: false, analyticsConnected: true } });
    await expect(page.getByRole("heading", { name: "Connect Google Search Console" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Connect Search Console and choose your website.")).toBeVisible();
    await expect(page.getByText(/and Google Analytics 4, and choose your website in each/)).toHaveCount(0);
  });

  test("still lets the risk check run, which needs only the site crawl", async ({ page }) => {
    await open(page, { status: NOTHING });
    await page.getByRole("tab", { name: "Risk check" }).click();
    await expect(page.getByText("Check before you change a page")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Connect Google Search Console" })).toHaveCount(0);
  });
});

test.describe("Google Search, where the platform also has live Google results", () => {
  test("adds the competitor tab, the market and live tracking beside the customer's own rankings", async ({ page }) => {
    await open(page, { status: { googleResultsConnected: true } });

    await expect(page.getByText("Where Google shows you")).toBeVisible({ timeout: 15_000 });
    expect(await tabNames(page)).toEqual(["Rankings", "Why not ranking", "Competitor keywords", "Index status", "Change results", "Risk check"]);
    await expect(page.getByText("Live Google results on")).toBeVisible();
    await expect(page.getByText("Google results for")).toBeVisible();
    await expect(page.getByText("Live tracking and competitors")).toBeVisible();
    // Still the customer's own rankings first.
    await expect(page.getByRole("row", { name: /a2 cow milk pune/ })).toBeVisible();
  });

  test("does not run a paid live check on its own when a search is picked from the table", async ({ page }) => {
    const seen = await open(page, { status: { googleResultsConnected: true } });
    await expect(page.getByText("Where Google shows you")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("row", { name: /a2 milk delivery near me/ }).getByRole("button", { name: "Diagnose" }).click();
    await expect(page.getByPlaceholder("a2 cow milk delivery pune")).toHaveValue("a2 milk delivery near me");
    await page.waitForTimeout(500);
    // Filled in and waiting: a live check is paid for, so it needs the click.
    expect(seen.diagnose).toEqual([]);
  });
});
