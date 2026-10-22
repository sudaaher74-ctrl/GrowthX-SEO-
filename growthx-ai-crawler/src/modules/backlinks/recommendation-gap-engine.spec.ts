import {
  buildRecommendationGaps,
  calculateReadiness,
  buildActionPlan,
  generatePitchDraft,
  computeExpectedOutcome,
  CustomerBusinessContext,
} from "./recommendation-gap-engine";
import { ArticleAnalysis } from "./recommendation-article";

const MOCK_ARTICLE: ArticleAnalysis = {
  version: "article-1",
  title: "10 Best Fresh Milk Delivery Services in Mumbai",
  wordCount: 1400,
  publishedAt: "2026-03-01T00:00:00.000Z",
  listicle: true,
  featured: [
    {
      name: "Country Delight",
      host: "countrydelight.in",
      url: "https://countrydelight.in",
      kind: "COMPETITOR",
      role: "LISTED",
      linked: true,
      rel: ["nofollow"],
      position: 1,
      passage: "Prices start at ₹60/L with wide city coverage in Mumbai.",
      evidenceClass: "OBSERVED",
    },
  ],
  ownMentioned: false,
  ownLinked: false,
  criteria: [
    { label: "Delivery coverage across Mumbai pincodes", evidenceClass: "CONFIRMED", passage: "How we chose: delivery coverage" },
    { label: "Transparent Pricing", evidenceClass: "CONFIRMED", passage: "Pricing transparency is crucial" },
    { label: "Product Quality", evidenceClass: "OBSERVED", passage: "Sourcing and quality matter" },
  ],
  sponsorship: { state: "NOT_OBSERVED", passage: null },
  limits: [],
};

const MOCK_CUSTOMER: CustomerBusinessContext = {
  domain: "milquufresh.in",
  businessName: "MilquuFresh",
  industry: "Dairy & Food",
  city: "Mumbai",
  country: "India",
  offerings: ["Fresh Cow Milk", "A2 Organic Milk", "Curd & Paneer"],
  totalPages: 12,
  pagesByType: { about: 1, contact: 1, blog: 4 },
  healthScore: 84,
};

describe("recommendation-gap-engine", () => {
  it("generates evidence-based gaps matching article criteria", () => {
    const gaps = buildRecommendationGaps(MOCK_ARTICLE, MOCK_CUSTOMER);
    expect(gaps.length).toBeGreaterThanOrEqual(4);

    const coverageGap = gaps.find((g) => g.factor === "Delivery Coverage");
    expect(coverageGap).toBeDefined();
    expect(coverageGap?.priority).toBe("High");
    expect(coverageGap?.evidenceClass).toBe("CONFIRMED");

    const pricingGap = gaps.find((g) => g.factor === "Pricing Information");
    expect(pricingGap).toBeDefined();
    expect(pricingGap?.customerStatus).toContain("No transparent pricing page");
  });

  it("calculates transparent readiness score with explainable breakdown", () => {
    const gaps = buildRecommendationGaps(MOCK_ARTICLE, MOCK_CUSTOMER);
    const readiness = calculateReadiness(MOCK_ARTICLE, MOCK_CUSTOMER, gaps);

    expect(readiness.score).toBeGreaterThanOrEqual(0);
    expect(readiness.score).toBeLessThanOrEqual(100);
    expect(readiness.factors).toHaveLength(4);
    expect(readiness.summary).toBeTruthy();
    expect(["READY", "PARTIAL", "INCOMPLETE"]).toContain(readiness.state);
  });

  it("builds a personalized 5-step action plan", () => {
    const gaps = buildRecommendationGaps(MOCK_ARTICLE, MOCK_CUSTOMER);
    const plan = buildActionPlan(MOCK_CUSTOMER, MOCK_ARTICLE, gaps);

    expect(plan).toHaveLength(5);
    expect(plan[0].title).toBe("Improve Website Content");
    expect(plan[0].priority).toBe("High");
    expect(plan[2].title).toBe("Create Publisher-Specific Pitch");
    expect(plan[2].detail).toContain(MOCK_CUSTOMER.businessName);
  });

  it("drafts honest, non-spam editorial pitch for user review", () => {
    const pitch = generatePitchDraft(MOCK_CUSTOMER, MOCK_ARTICLE);
    expect(pitch).toContain(MOCK_CUSTOMER.businessName);
    expect(pitch).toContain(MOCK_CUSTOMER.domain);
    expect(pitch).toContain("10 Best Fresh Milk Delivery Services in Mumbai");
    expect(pitch).toContain("Mumbai");
    expect(pitch).not.toContain("Dear Sir/Madam, we demand a backlink");
  });

  it("computes realistic expected outcome metrics", () => {
    const outcome = computeExpectedOutcome(MOCK_ARTICLE);
    expect(outcome.potentialBacklink).toContain("1 editorial link");
    expect(outcome.estimatedMonthlyTraffic).toBe("500 - 2,000");
    expect(outcome.domainAuthorityBoost).toBe("+2 to +5");
  });
});
