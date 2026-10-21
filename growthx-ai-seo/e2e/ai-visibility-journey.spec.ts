import { test, expect, type Page } from "@playwright/test";
import { API_BASE } from "./api-base";
import type {
  VisibilityBrief,
  VisibilityJourneyResponse,
} from "../src/lib/visibility-workflow";

const endpoint = "/api/projects/project_test/ai-visibility/journey";
function fixture(): VisibilityJourneyResponse {
  const locations = ["Panvel", "Kharghar", "Kamothe"];
  return {
    providers: [
      { provider: "GEMINI", configured: true, model: "fixture-gemini" },
      { provider: "OPENAI", configured: true, model: "fixture-openai" },
    ],
    answers: [],
    journey: {
      id: "run_test",
      projectId: "project_test",
      status: "READY",
      phase: "PREPARE",
      progress: 25,
      scanId: null,
      createdAt: "2026-10-14T10:00:00Z",
      updatedAt: "2026-10-14T10:01:00Z",
      errors: [],
      analysis: null,
      context: {
        gatheredAt: "2026-10-14T10:00:00Z",
        businessName: "Milquufresh",
        domain: "milquufresh.in",
        keyEvents: null,
        cities: [
          { city: "Panvel", country: "India", sessions: 80 },
          { city: "Delhi", country: "India", sessions: 110 },
        ],
        limitations: [
          "Top cities are a sample; service eligibility needs review.",
        ],
        facts: [
          {
            id: "page-home",
            source: "website",
            text: "Cow milk delivery in Panvel, Kharghar and Kamothe.",
            url: "https://milquufresh.in",
          },
        ],
        sources: [
          {
            id: "website",
            label: "Website Audit",
            available: true,
            detail: "36 audited pages",
            updatedAt: "2026-10-13T10:00:00Z",
            href: "/website",
          },
          {
            id: "gsc",
            label: "Search Console",
            available: false,
            detail: "Connect and sync Search Console.",
            updatedAt: null,
            href: "/google",
          },
          {
            id: "ga4",
            label: "Google Analytics 4",
            available: true,
            detail: "Last 28 days of visitor data",
            updatedAt: "2026-10-14T08:00:00Z",
            href: "/google/analytics",
          },
          {
            id: "competitors",
            label: "Competitor Intelligence",
            available: true,
            detail: "2 competitors with completed evidence",
            updatedAt: "2026-10-13T10:00:00Z",
            href: "/competitor-intelligence",
          },
        ],
      },
      brief: {
        businessName: "Milquufresh",
        summary: "Daily cow milk delivery for households in Navi Mumbai.",
        offerings: ["cow milk"],
        locations,
        evidenceIds: ["page-home"],
        reviewed: false,
        analysts: [
          {
            provider: "GEMINI",
            model: "fixture-gemini",
            summary: "Local dairy delivery.",
          },
        ],
        questions: Array.from({ length: 20 }, (_, i) => ({
          text: `Which cow milk delivery option ${i + 1} serves ${locations[i % 3]}?`,
          offering: "cow milk",
          location: locations[i % 3],
          intent: "Purchase",
          rationale: "Buyer demand for local milk delivery.",
          evidenceIds: ["page-home"],
        })),
      },
    },
  };
}

async function setup(
  page: Page,
  data: VisibilityJourneyResponse,
  onCheck?: (body: unknown) => void,
) {
  await page.addInitScript(() => {
    localStorage.setItem("growthx_theme", "light");
    localStorage.setItem("growthx.session", "1");
    localStorage.setItem("growthx.org", "org_test");
    localStorage.setItem("growthx.project", "project_test");
  });
  await page.route(`${API_BASE}/**`, async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (req.method() === "OPTIONS") return json({});
    if (path === "/auth/me")
      return json({
        id: "user_test",
        email: "test@example.test",
        firstName: "Test",
        role: "OWNER",
      });
    if (path === "/auth/csrf") return json({ csrf_token: "test-csrf" });
    if (path === "/organizations")
      return json([{ id: "org_test", name: "Test workspace", slug: "test" }]);
    if (path === "/projects/org/org_test")
      return json([{ id: "project_test", name: "Milquufresh" }]);
    if (path === "/api/organizations/org_test/portfolio")
      return json({ clients: [], summary: {}, alerts: [] });
    if (path === endpoint && req.method() === "GET") return json(data);
    if (path === `${endpoint}/run_test/check`) {
      onCheck?.(req.postDataJSON());
      data.journey!.status = "CHECKING";
      data.journey!.phase = "CHECK";
      data.journey!.progress = 30;
      return json({ id: "run_test", status: "QUEUED" });
    }
    return json({}, 404);
  });
}

test("reviews local questions before checking and preserves missing-source truth", async ({
  page,
}) => {
  const data = fixture();
  const sent: { brief?: VisibilityBrief } = {};
  await setup(page, data, (body) => {
    sent.brief = (body as { brief: VisibilityBrief }).brief;
  });
  await page.goto("/ai-visibility/journey");
  await expect(
    page.getByRole("heading", {
      name: "Review before you run",
    }),
  ).toBeVisible();
  await page.getByText("Analysis details", {exact:false}).click();
  await expect(
    page.getByText("Lead measurement is unknown", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Review location", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Connect and sync Search Console.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", {name:"Show all 20 questions"}).click();
  await expect(
    page.getByRole("textbox", { name: /^Buyer question / }),
  ).toHaveCount(20);
  await page
    .getByRole("textbox", { name: "Buyer question 1", exact: true })
    .fill("Which cow milk delivery is best for families in Panvel?");
  await page
    .getByRole("button", { name: "Confirm & check 20 questions" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Asking Gemini and OpenAI",
  );
  expect(sent.brief?.questions[0].text).toContain("families in Panvel");
  expect(sent.brief?.questions).toHaveLength(20);
  await page.reload();
  await expect(page.getByRole("status")).toContainText(
    "Asking Gemini and OpenAI",
  );
  await expect(
    page.getByRole("button", { name: "Start a new analysis" }),
  ).toBeDisabled();
});

test("shows measured results, failed checks, competitor evidence and action plan", async ({
  page,
}) => {
  const data = fixture();
  data.journey!.status = "PARTIAL";
  data.journey!.progress = 100;
  data.journey!.scanId = "scan_test";
  data.journey!.errors = ["One provider answer failed."];
  data.answers = [
    {
      id: "answer1",
      provider: "GEMINI",
      model: "fixture-gemini",
      promptText: "Best cow milk delivery in Panvel?",
      rawResponse: "Local Dairy offers delivery in Panvel.",
      errorMessage: null,
      createdAt: "2026-10-14T10:05:00Z",
      analysis: { brandMentioned: false, recommended: false },
      mentions: [{ brandName: "Local Dairy", isCustomer: false }],
      citations: [],
    },
    {
      id: "answer2",
      provider: "OPENAI",
      model: "fixture-openai",
      promptText: "Best cow milk delivery in Panvel?",
      rawResponse: null,
      errorMessage: "OpenAI could not answer.",
      createdAt: "2026-10-14T10:05:00Z",
      analysis: null,
      mentions: [],
      citations: [],
    },
  ];
  data.journey!.analysis = [
    {
      provider: "GEMINI",
      model: "fixture-gemini",
      summary: "Make service eligibility clear.",
      localDemand: "Delhi traffic needs review; no lead data is available.",
      gaps: [
        {
          competitor: "Local Dairy",
          observation: "Named in a buyer answer.",
          hypothesis:
            "Investigate its local landing pages before drawing a conclusion.",
          evidenceIds: ["answer1"],
        },
      ],
      actions: [
        {
          title: "Create a Panvel delivery page",
          priority: "high",
          timeframe: "Week 1",
          steps: ["Publish coverage and ordering details."],
          measureBy: "Qualified delivery enquiries",
          evidenceIds: ["page-home"],
        },
      ],
    },
  ];
  await setup(page, data);
  await page.goto("/ai-visibility/journey?tab=answers");
  await expect(page.getByText("Not mentioned", { exact: true })).toBeVisible();
  await expect(page.getByText("Check failed", { exact: true })).toBeVisible();
  await expect(page.getByText("0 / 1", { exact: true })).toHaveCount(2);
  await page.getByRole("combobox", {name:"Filter answers by assistant"}).selectOption("OPENAI");
  await expect(page.getByText("Not mentioned", { exact: true })).toHaveCount(0);
  await page.getByText("Compare competitors mentioned in the answers",{exact:true}).click();
  await expect(
    page.getByText("Possible explanation:", { exact: false }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "3. Take action" }).click();
  await expect(
    page.getByRole("heading", { name: "Create a Panvel delivery page" }),
  ).toBeVisible();
  await expect(
    page.getByText("Qualified delivery enquiries", { exact: false }),
  ).toBeVisible();
  if (process.env.VISIBILITY_SCREENSHOT) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: process.env.VISIBILITY_SCREENSHOT,
      fullPage: true,
    });
  }
});

test("keeps the review usable on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, fixture());
  await page.goto("/ai-visibility/journey?tab=questions");
  await page.getByRole("button",{name:"Show all 20 questions"}).click();
  await expect(
    page.getByRole("textbox", { name: "Buyer question 10", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
