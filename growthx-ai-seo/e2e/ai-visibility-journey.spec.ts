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

test("presents an evidence-led action plan without treating model claims as measurements", async ({page}) => {
  const data = fixture();
  data.journey!.status = "COMPLETE";
  data.journey!.scanId = "scan_test";
  const rawPageText = "HEADERNavigationProductsFooterJoinedRawText";
  data.journey!.context!.facts = [{id:"page-product", source:"website", url:"https://example.test/products/milk", text:JSON.stringify({title:"Fresh milk delivery", description:"Daily delivery information.", text:rawPageText, type:"PRODUCT", issues:[{issueType:"ORPHAN_PAGE", severity:"MEDIUM", description:"Page has zero incoming internal links from crawlable HTML pages."}]})}];
  data.answers = [
    {id:"answer-plan", provider:"GEMINI", model:"fixture-gemini", promptText:"Which milk delivery is best?", rawResponse:"Other Dairy is an option.", errorMessage:null, createdAt:"2026-10-14T10:05:00Z", analysis:{brandMentioned:false,recommended:false}, mentions:[],citations:[]},
    {id:"failed-plan", provider:"OPENAI", model:"fixture-openai", promptText:"Which milk delivery is best?",rawResponse:null,errorMessage:"Provider unavailable", createdAt:"2026-10-14T10:05:00Z",analysis:{brandMentioned:true,recommended:true},mentions:[],citations:[]},
  ];
  data.journey!.analysis = [{provider:"GEMINI", model:"fixture-gemini", summary:"AI recommends this business.",localDemand:"Strong buying demand is proven.",gaps:[],actions:[{title:"Connect product pages",priority:"high",timeframe:"short-term",steps:["Add **relevant internal links**.","Review navigation."],measureBy:"Reduction in orphan pages.",evidenceIds:["page-product","page-product","missing-source"]},{title:"Review service coverage",priority:"medium",timeframe:"Week 2",steps:[],measureBy:"",evidenceIds:[]}]}];
  await setup(page,data);
  await page.goto("/ai-visibility?tab=plan");
  await expect(page.getByText("0 recommendations across 1 measured answer. Your business was mentioned 0 times.")).toBeVisible();
  await expect(page.getByText("No supporting sources were linked to this item.",{exact:true})).toBeVisible();
  await expect(page.getByText("AI recommends this business.",{exact:true})).toBeHidden();
  await expect(page.getByText("Strong buying demand is proven.",{exact:true})).toBeHidden();
  await expect(page.getByText("Lead measurement is unavailable in this run.")).toBeVisible();
  await expect(page.getByRole("link",{name:"Fresh milk delivery",exact:true})).toHaveCount(1);
  await expect(page.locator("strong",{hasText:"relevant internal links"})).toBeVisible();
  await expect(page.getByText("No specific website page was linked to this action.",{exact:false})).toBeVisible();
  await expect(page.getByText("No implementation steps were included in this saved action.")).toBeVisible();
  await page.getByText("Supporting evidence (2)",{exact:true}).click();
  const actionEvidence = page.getByText("Supporting evidence (2)",{exact:true}).locator("..");
  await expect(actionEvidence.getByText("No incoming internal links",{exact:true})).toBeVisible();
  await expect(actionEvidence.getByText("Medium severity",{exact:true})).toBeVisible();
  await expect(actionEvidence.getByText("This referenced source is unavailable in the saved analysis.")).toBeVisible();
  await expect(actionEvidence.getByText(rawPageText,{exact:true})).toBeHidden();
  await actionEvidence.getByText("Technical details · original source",{exact:true}).click();
  await expect(actionEvidence.getByText(rawPageText,{exact:true})).toBeVisible();
  await actionEvidence.getByText("Technical details · original source",{exact:true}).click();
  await page.getByText("Original assistant commentary · unverified interpretation",{exact:true}).click();
  await expect(page.getByText("AI recommends this business.",{exact:true})).toBeVisible();
  await expect(page.getByText("The measured results above take precedence",{exact:false})).toBeVisible();
  await page.getByText("Original assistant commentary · unverified interpretation",{exact:true}).click();
  if (process.env.ACTION_SCREENSHOT_DIR) await page.screenshot({path:`${process.env.ACTION_SCREENSHOT_DIR}/action-desktop.png`,fullPage:true});
  for (const theme of ["light","dark"]) {
    await page.getByTitle(theme === "dark" ? "Switch to Night mode" : "Switch to Day mode",{exact:true}).click();
    await page.setViewportSize({width:390,height:844});
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole("link",{name:"Review the improvement plan in Fix Engine →"})).toHaveAttribute("href","/fix-engine");
    if (process.env.ACTION_SCREENSHOT_DIR) await page.screenshot({path:`${process.env.ACTION_SCREENSHOT_DIR}/action-${theme}.png`,fullPage:true});
  }
  data.answers = [];
  await page.reload();
  await expect(page.getByText("No successfully classified answers are available yet.",{exact:true})).toBeVisible();
});

test("formats assistant answers safely on desktop and mobile", async ({ page, context }) => {
  const data = fixture();
  const text = "# Supplier overview\n\nChoose **verified suppliers**.\n\n## Search methods\n\n1. Trade platforms\n   - IndiaMART\n   - Alibaba\n\n[APEDA](https://apeda.gov.in)\n\n| Supplier | Location |\n| --- | --- |\n| Example supplier | Navi Mumbai |\n\n[Unsafe](javascript:alert(1))\n\n<script>alert(1)</script>";
  data.journey!.status = "COMPLETE";
  data.answers = [{ id: "formatted", provider: "GEMINI", model: "fixture-gemini", promptText: "Which suppliers should I consider?", rawResponse: text, errorMessage: null, createdAt: "2026-10-14T10:05:00Z", analysis: { brandMentioned: false, recommended: false }, mentions: [{brandName: "IndiaMART", isCustomer: false}], citations: [{url: "https://apeda.gov.in", domain: "apeda.gov.in"}] }];
  await setup(page, data);
  await page.goto("/ai-visibility?tab=results");
  await page.getByText("Read complete answer", {exact:true}).click();
  await expect(page.getByRole("heading", {name:"Supplier overview"})).toBeVisible();
  await expect(page.locator("strong", {hasText:"verified suppliers"})).toBeVisible();
  await expect(page.locator("ol > li > ul > li")).toHaveCount(2);
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("link", {name:"APEDA", exact:true})).toHaveAttribute("href", "https://apeda.gov.in");
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
  await expect(page.getByText("# Supplier overview", {exact:true})).toHaveCount(0);
  if (process.env.ANSWER_SCREENSHOT_DIR) await page.screenshot({path:`${process.env.ANSWER_SCREENSHOT_DIR}/answer-desktop.png`, fullPage:true});
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", {name:"Copy answer", exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Answer copied"})).toBeVisible();
  // The Windows clipboard normalizes LF to CRLF; wording must remain identical.
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n")).toBe(text);
  for (const theme of ["light", "dark"]) {
    await page.getByTitle(theme === "dark" ? "Switch to Night mode" : "Switch to Day mode", {exact:true}).click();
    await page.setViewportSize({width:390, height:844});
    if (process.env.ANSWER_SCREENSHOT_DIR) await page.screenshot({path:`${process.env.ANSWER_SCREENSHOT_DIR}/answer-${theme}.png`, fullPage:true});
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole("heading", {name:"Supplier overview"})).toBeVisible();
    if (process.env.ANSWER_SCREENSHOT_DIR) await page.screenshot({path:`${process.env.ANSWER_SCREENSHOT_DIR}/answer-${theme}.png`, fullPage:true});
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
