/**
 * The Tokens screens show the API's numbers, in words a business owner can read.
 *
 * Like issue-counts.spec.ts, this serves the app a known answer and checks it
 * shows that answer. The route smoke test runs with no API at all, so it proves
 * a page survives its data failing and says nothing about whether it reads its
 * data correctly. That gap is where these bugs live: a fixed default read as
 * "4.9M of 0", two decimals rounding a used balance up to an untouched "5M",
 * an internal task code ("Reasoning") printed as if it meant something.
 *
 * The fixtures are shaped like real responses: they were captured from the API
 * running against PostgreSQL, with a stand-in model provider reporting usage.
 */
import { test, expect, type Page, type Route } from "@playwright/test";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const ORG = "org_test";
const PROJECT = "proj_test";

type Mode = "enforce" | "shadow";

interface Fixture {
  mode?: Mode;
  available: number;
  bonus?: number;
  remaining: number;
  granted?: number;
  monthly?: number;
  usage?: { action: string; tokens: number; shortfall: number; count: number }[];
}

function overview(f: Fixture) {
  const granted = f.granted ?? 5_000_000;
  const usage = f.usage ?? [];
  return {
    enabled: true,
    mode: f.mode ?? "enforce",
    organizationId: ORG,
    available: f.available,
    bonus: f.bonus ?? 0,
    allowance: {
      remaining: f.remaining,
      granted,
      monthly: f.monthly ?? granted,
      periodStart: "2026-09-01T00:00:00.000Z",
      periodEnd: "2026-10-01T00:00:00.000Z",
    },
    usage: { since: "2026-09-01T00:00:00.000Z", totalTokens: usage.reduce((sum, u) => sum + u.tokens, 0), lines: usage },
    rates: {
      ai: { inputWeight: 1, outputWeight: 4 },
      actions: [{ action: "GEO_GRID_POINT", tokensPerUnit: 5000, unit: "grid point" }],
    },
  };
}

const row = (id: string, over: Record<string, unknown>) => ({
  id,
  kind: "SPEND",
  action: "AI_USAGE",
  tokens: -1201,
  shortfall: 0,
  balanceAfter: 4_998_799,
  projectId: PROJECT,
  createdAt: "2026-09-29T03:29:00.000Z",
  detail: null,
  ...over,
});

const LEDGER_PAGE_1 = {
  items: [
    row("t3", {
      tokens: -9_540,
      balanceAfter: 4_989_259,
      detail: { task: "SEO_ANALYSIS", provider: "ANTHROPIC", model: "claude-opus-5", inputTokens: 8_120, outputTokens: 1_340 },
    }),
    row("t2", {
      action: "GEO_GRID_POINT",
      tokens: -45_000,
      balanceAfter: 4_998_799,
      detail: { keyword: "dentist near me", gridSize: 3, points: 9 },
    }),
    // What a call filed under the default routing profile looks like: the task
    // code says nothing a customer could use.
    row("t1", { balanceAfter: 5_000_000 - 1201, detail: { task: "REASONING", model: "mock-model-1", inputTokens: 201, outputTokens: 250 } }),
  ],
  nextCursor: "t0",
};
const LEDGER_PAGE_2 = {
  items: [
    row("t0", { kind: "ALLOWANCE", action: "MONTHLY_ALLOWANCE", tokens: 5_000_000, balanceAfter: 5_000_000 }),
  ],
  nextCursor: null,
};

/** Serves the handful of requests these screens need; everything else fails, as it would in an outage. */
function serve(getTokens: () => unknown, extra?: (path: string, route: Route) => Promise<boolean> | boolean) {
  return async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (extra && (await extra(path, route))) return;
    if (path === "/organizations") return json([{ id: ORG, name: "Test Org", slug: "test" }]);
    if (path === `/projects/org/${ORG}`) return json([{ id: PROJECT, name: "Aiva" }]);
    if (path === `/api/organizations/${ORG}/portfolio`) return json({ clients: [], summary: {}, alerts: [] });
    if (path === `/api/organizations/${ORG}/tokens`) return json(getTokens());
    if (path === `/api/organizations/${ORG}/tokens/transactions`) {
      return json(url.searchParams.get("cursor") === "t0" ? LEDGER_PAGE_2 : LEDGER_PAGE_1);
    }
    return json({}, 404);
  };
}

async function open(page: Page, path: string, tokens: () => unknown, extra?: Parameters<typeof serve>[1]) {
  await page.addInitScript(() => window.localStorage.setItem("growthx.token", "smoke-test-token"));
  await page.route(`${API}/**`, serve(tokens, extra));
  await page.goto(path, { waitUntil: "domcontentloaded" });
}

// The sidebar's chip on every page but the Dashboard, whose top bar carries it instead.
const sidebarChip = (page: Page) => page.locator('aside a[href="/tokens"], header a[href="/tokens"]');

test.describe("Tokens page", () => {
  test("shows the balance in full precision, and says what it is out of", async ({ page }) => {
    await open(page, "/tokens", () =>
      overview({ available: 6_995_208, bonus: 2_000_000, remaining: 4_995_208, usage: [{ action: "AI_USAGE", tokens: 4_792, shortfall: 0, count: 4 }] }),
    );

    await expect(page.getByText("Available now")).toBeVisible({ timeout: 15_000 });
    // Not "7M" and "5M": 4,792 tokens have been used and the figures must not hide it.
    await expect(page.getByText("6.995M", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("6,995,208 tokens. Monthly tokens are used first.")).toBeVisible();
    await expect(page.getByText("4.995M", { exact: true })).toBeVisible();
    await expect(page.getByText(/of 5M · refills 1 October/)).toBeVisible();
    await expect(page.getByText("2M", { exact: true })).toBeVisible();
  });

  test("reads an allowance changed mid-month as this month's grant and next month's figure", async ({ page }) => {
    // Was "4.995M of 0": the balance from the old figure over the new one.
    await open(page, "/tokens", () => overview({ available: 4_995_208, remaining: 4_995_208, granted: 5_000_000, monthly: 1_000_000 }));

    await expect(page.getByText("of 5M · refills 1 October · then 1M a month")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("progressbar", { name: "Monthly tokens left" }).first()).toBeVisible();
  });

  test("breaks usage down by feature", async ({ page }) => {
    await open(page, "/tokens", () =>
      overview({
        available: 100,
        remaining: 100,
        usage: [
          { action: "GEO_GRID_POINT", tokens: 45_000, shortfall: 0, count: 1 },
          { action: "AI_USAGE", tokens: 12_345, shortfall: 0, count: 6 },
        ],
      }),
    );

    await expect(page.getByText("57,345 tokens in total")).toBeVisible({ timeout: 15_000 });
    const usage = page.locator("table").first();
    await expect(usage.locator("tr", { hasText: "Local ranking scan" })).toContainText("45,000");
    await expect(usage.locator("tr", { hasText: "AI analysis and writing" })).toContainText("12,345");
  });

  test("prices what costs tokens from the API, not from a copy in the page", async ({ page }) => {
    await open(page, "/tokens", () => overview({ available: 100, remaining: 100 }));

    await expect(page.getByText(/Every piece it reads costs 1 of your tokens, and every piece it writes costs 4/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/5,000 tokens per grid point\. A 3×3 scan checks 9 points \(45,000 tokens\)/)).toBeVisible();
  });

  test("lists the ledger in plain words and pages through it", async ({ page }) => {
    await open(page, "/tokens", () => overview({ available: 100, remaining: 100 }));

    const history = page.locator("table").last();
    await expect(history.getByText("AI: SEO analysis")).toBeVisible({ timeout: 15_000 });
    await expect(history.getByText("8,120 read · 1,340 written · claude-opus-5")).toBeVisible();
    await expect(history.getByText("Local ranking scan")).toBeVisible();
    await expect(history.getByText("3×3 grid for “dentist near me”")).toBeVisible();

    // A call filed under the default routing profile is just "AI analysis and
    // writing"; "Reasoning" is an internal name and never reaches the customer.
    await expect(history.getByText("AI analysis and writing")).toBeVisible();
    await expect(history.getByText(/Reasoning/i)).toHaveCount(0);

    await expect(history.getByText("Monthly tokens")).toHaveCount(0);
    await page.getByRole("button", { name: "Show more" }).click();
    await expect(history.getByText("Monthly tokens")).toBeVisible();
    await expect(page.getByRole("button", { name: "Show more" })).toHaveCount(0);
  });

  test("marks the part of a call the wallet could not cover", async ({ page }) => {
    await open(page, "/tokens", () =>
      overview({ available: 0, remaining: 0, usage: [{ action: "AI_USAGE", tokens: 1_290, shortfall: 1_112, count: 2 }] }),
    );
    await expect(page.getByText("1.1K not covered")).toBeVisible({ timeout: 15_000 });
  });

  test("in shadow mode says nothing is limited, and counts what use would have cost", async ({ page }) => {
    await open(page, "/tokens", () =>
      overview({ mode: "shadow", available: 0, remaining: 0, granted: 0, usage: [{ action: "AI_USAGE", tokens: 0, shortfall: 3_603, count: 3 }] }),
    );

    await expect(page.getByText(/nothing is limited yet/)).toBeVisible({ timeout: 15_000 });
    // 3 calls on an empty wallet took nothing but cost 3,603: that is the number to watch.
    await expect(page.getByText("3,603 tokens in total")).toBeVisible();
    await expect(page.getByText(/not covered/)).toHaveCount(0);
    await expect(page.getByText("Usage is counted, not limited")).toBeVisible();
  });

  test("says tokens are off when the deployment has them off", async ({ page }) => {
    await open(page, "/tokens", () => ({ enabled: false, mode: "off" }));

    await expect(page.getByText("Tokens are switched off")).toBeVisible({ timeout: 15_000 });
    await expect(sidebarChip(page)).toHaveCount(0);
  });

  test("the old billing address lands on Tokens", async ({ page }) => {
    await open(page, "/billing", () => overview({ available: 100, remaining: 100 }));
    await expect(page).toHaveURL(/\/tokens$/);
  });
});

test.describe("everywhere else in the dashboard", () => {
  test("a healthy workspace sees its balance in the sidebar and no banner", async ({ page }) => {
    await open(page, "/dashboard", () => overview({ available: 4_995_208, remaining: 4_995_208 }));

    await expect(sidebarChip(page)).toContainText("4.995M", { timeout: 15_000 });
    await expect(sidebarChip(page)).toContainText("Refills 1 October");
    await expect(page.getByRole("status").filter({ hasText: "tokens" })).toHaveCount(0);
  });

  test("a workspace running low is told, with the number left", async ({ page }) => {
    await open(page, "/dashboard", () => overview({ available: 89, remaining: 89, granted: 1_290 }));

    const banner = page.getByRole("status").filter({ hasText: "running low on tokens" });
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toContainText("89 left. They refill on 1 October.");
    await expect(sidebarChip(page)).toContainText("Running low");
  });

  test("a workspace that is out is told what will not run, and until when", async ({ page }) => {
    await open(page, "/dashboard", () => overview({ available: 0, remaining: 0 }));

    const banner = page.getByRole("status").filter({ hasText: "used all of this month" });
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toContainText("will not run until your tokens refill on 1 October");
    await expect(sidebarChip(page)).toContainText("Used up");
  });

  test("the banner stays off the Tokens page, which already says it", async ({ page }) => {
    await open(page, "/tokens", () => overview({ available: 0, remaining: 0 }));

    await expect(page.getByText("Available now")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("status").filter({ hasText: "used all of this month" })).toHaveCount(0);
  });

  test("shadow mode never warns, however empty the balance", async ({ page }) => {
    await open(page, "/dashboard", () => overview({ mode: "shadow", available: 0, remaining: 0, granted: 0 }));

    await expect(sidebarChip(page)).toContainText("Usage is counted, not limited", { timeout: 15_000 });
    await expect(page.getByRole("status").filter({ hasText: "tokens" })).toHaveCount(0);
  });
});
