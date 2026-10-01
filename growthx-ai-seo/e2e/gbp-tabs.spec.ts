/**
 * The Google Business Profile tabs show what GrowthX has stored.
 *
 * Like tokens.spec.ts, this serves the app a known answer and checks it shows
 * that answer. The route smoke test runs with no API at all, so it proves a tab
 * survives its data failing and says nothing about whether it displays data it
 * was given. That gap hid a real bug: GbpTabGate tested `if (notice)` on a JSX
 * element, which is always truthy, so a connected profile rendered its
 * "no notice needed" null and never its tab — stored reviews, posts and photos
 * were invisible.
 *
 * Two situations are covered because they fail differently:
 *   - SYNCED: nothing is wrong, and the tab must simply show its rows.
 *   - ERROR while Google approval is pending: Google cannot be read, but what
 *     was stored earlier is still true and must stay visible under a banner.
 */
import { test, expect, type Page, type Route } from "@playwright/test";
import { API_BASE } from "./api-base";

const API = API_BASE;
const ORG = "org_test";
const PROJECT = "proj_test";
const BP = `/api/projects/${PROJECT}/business-profile`;

const connection = (over: Record<string, unknown> = {}) => ({
  state: "SYNCED",
  status: "CONNECTED",
  statusMessage: null,
  selectedResourceId: "locations/123",
  selectedResourceName: "Milquu Fresh",
  lastSyncedAt: "2026-09-29T09:30:00.000Z",
  requiresGoogleApproval: true,
  configured: true,
  ...over,
});

const source = (name: string, over: Record<string, unknown> = {}) => ({
  name,
  state: "OK",
  message: null,
  httpStatus: null,
  lastSuccessAt: "2026-09-29T09:30:00.000Z",
  lastCount: null,
  ...over,
});

const REFUSED = (name: string) =>
  source(name, { state: "UNAVAILABLE", httpStatus: 403, message: "Google refused this source.", lastSuccessAt: null });

const REVIEWS = [
  {
    id: "r1",
    googleReviewId: "g1",
    authorName: "Asha Verma",
    authorPhotoUrl: null,
    rating: 5,
    text: "The A2 milk reaches us warm every morning.",
    createTime: "2026-09-20T08:00:00.000Z",
    updateTime: null,
    googleReply: null,
    googleReplyUpdatedAt: null,
    aiDraftedReply: null,
    replyStatus: "PENDING",
  },
];

const POST = {
  id: "p1",
  postName: "locations/123/localPosts/1",
  summary: "Fresh cow milk delivered before 7am across Navi Mumbai.",
  state: "LIVE",
  topicType: "STANDARD",
  searchUrl: null,
  callToAction: null,
  event: null,
  mediaUrls: [],
  createTime: "2026-09-18T08:00:00.000Z",
  updateTime: null,
};

const MAPS_403 =
  "Google Places API error (403): The caller does not have permission. Google did not say why. " +
  "In the Cloud project that owns GOOGLE_PLACES_API_KEY, check that Places API (New) is enabled.";

interface Setup {
  connection?: ReturnType<typeof connection>;
  reviews?: unknown[];
  posts?: unknown[];
  photosSource?: ReturnType<typeof source>;
  places?: Record<string, unknown>;
}

async function open(page: Page, tab: string, setup: Setup = {}) {
  const conn = setup.connection ?? connection();
  const places = setup.places ? { places: setup.places } : {};

  await page.addInitScript(() => window.localStorage.setItem("growthx.token", "smoke-test-token"));
  await page.route(`${API}/**`, async (route: Route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (path === "/organizations") return json([{ id: ORG, name: "Test Org", slug: "test" }]);
    if (path === `/projects/org/${ORG}`) return json([{ id: PROJECT, name: "Milquu" }]);
    if (path === `/api/organizations/${ORG}/portfolio`) return json({ clients: [], summary: {}, alerts: [] });
    if (path === `${BP}/overview`) {
      return json({ connection: conn, source: source("profile"), profile: null, completeness: null, ...places });
    }
    if (path === `${BP}/reviews`) {
      const reviews = setup.reviews ?? [];
      return json({
        connection: conn,
        source: reviews.length ? source("reviews") : REFUSED("reviews"),
        dataSource: "business_profile",
        reviews,
        summary: { total: reviews.length, rated: reviews.length, averageRating: reviews.length ? 5 : null },
        ...places,
      });
    }
    if (path === `${BP}/posts`) {
      const posts = setup.posts ?? [];
      return json({
        connection: conn,
        source: posts.length ? source("posts") : REFUSED("posts"),
        dataSource: "business_profile",
        posts,
        ...places,
      });
    }
    if (path === `${BP}/photos`) {
      return json({
        connection: conn,
        source: setup.photosSource ?? REFUSED("media"),
        dataSource: "business_profile",
        photos: [],
        ...places,
      });
    }
    return json({}, 404);
  });
  await page.goto(`/google-business-profile?tab=${tab}`, { waitUntil: "domcontentloaded" });
}

/** Set GBP_SHOTS_DIR to also save a screenshot of the screen under test. */
async function shot(page: Page, name: string) {
  const dir = process.env.GBP_SHOTS_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

test.describe("Business Profile tabs, connection healthy", () => {
  test("Reviews shows the stored reviews", async ({ page }) => {
    await open(page, "reviews", { reviews: REVIEWS });

    await expect(page.getByText("The A2 milk reaches us warm every morning.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Asha Verma")).toBeVisible();
  });

  test("Posts shows the stored posts", async ({ page }) => {
    await open(page, "posts", { posts: [POST] });

    await expect(page.getByText("Fresh cow milk delivered before 7am across Navi Mumbai.")).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Business Profile tabs, waiting on Google's approval", () => {
  const WAITING = connection({
    state: "ERROR",
    status: "ERROR",
    statusMessage: "Google has not approved this Cloud project.",
  });

  test("keeps stored reviews visible under a banner, instead of hiding them", async ({ page }) => {
    await open(page, "reviews", { connection: WAITING, reviews: REVIEWS });

    await expect(page.getByText("The A2 milk reaches us warm every morning.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Business Profile access is waiting on Google's approval.")).toBeVisible();
    await shot(page, "reviews-waiting");
  });

  test("keeps stored posts visible under a banner", async ({ page }) => {
    await open(page, "posts", { connection: WAITING, posts: [POST] });

    await expect(page.getByText("Fresh cow milk delivered before 7am across Navi Mumbai.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Business Profile access is waiting on Google's approval.")).toBeVisible();
  });

  test("with nothing stored, says what is missing and why, and still offers a retry", async ({ page }) => {
    await open(page, "photos", {
      connection: WAITING,
      places: { state: "FAILED", placeId: "ChIJ-milk", fetchedAt: null, error: MAPS_403, suggestedQuery: null },
    });

    await expect(page.getByText("Business Profile access is waiting on Google's approval.")).toBeVisible({ timeout: 15_000 });
    // The tab's own explanation, not an empty gallery.
    await expect(page.getByText("Photos are unavailable")).toBeVisible();
    // The Maps failure and what to check, which is what the operator can act on.
    await expect(page.getByText(/Places API \(New\) is enabled/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Try syncing again" }).first()).toBeVisible();
    await shot(page, "photos-waiting");
  });
});
