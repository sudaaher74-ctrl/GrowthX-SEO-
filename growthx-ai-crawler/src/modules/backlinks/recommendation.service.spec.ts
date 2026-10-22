import { NotFoundException } from "@nestjs/common";
import { RecommendationService } from "./recommendation.service";
import { ANALYSIS_VERSION } from "./recommendation-article";

const HTML = `<article><h1>Best Dairy</h1><p>${"Milk is popular daily. ".repeat(50)}</p>
<h2>1. Amul</h2><p><a href="https://amul.com/m">Amul</a> is good.</p>
<h2>2. Country Delight</h2><p>Country Delight delivers.</p><h2>3. Nandini</h2><p>x</p></article>`;

function build(overrides: { stored?: any; fetch?: any } = {}) {
  const prisma: any = {
    backlinkSource: {
      findFirst: jest.fn(async ({ where }: any) =>
        where.projectId === "p1" && where.id === "s1"
          ? { id: "s1", sourceUrl: "https://guide.example.org/a" }
          : null,
      ),
    },
    project: {
      findUnique: jest.fn(async () => ({
        id: "p1",
        organizationId: "org-1",
        name: "MilquuFresh",
        websites: [{ domain: "milquufresh.in" }],
        businessProfile: { businessName: "MilquuFresh", industry: "Dairy & Food", city: "Mumbai" },
      })),
    },
    recommendationAnalysis: {
      findUnique: jest.fn(async () => overrides.stored ?? null),
      upsert: jest.fn(async ({ create }: any) => ({ ...create, analyzedAt: new Date() })),
      update: jest.fn(async ({ data }: any) => ({ ...overrides.stored, ...data })),
    },
  };
  const fetcher: any = {
    fetch: jest.fn(overrides.fetch ?? (async () => ({ outcome: "READ", html: HTML, finalUrl: "https://guide.example.org/a", reason: "ok" }))),
  };
  const backlinks: any = {
    context: jest.fn(async () => ({ own: ["milquufresh.in"], competitors: ["amul.com", "countrydelight.in"] })),
  };
  return { prisma, fetcher, service: new RecommendationService(prisma, fetcher, backlinks) };
}

describe("RecommendationService", () => {
  it("never reaches another project's source (tenant isolation)", async () => {
    const { service, fetcher, prisma } = build();
    await expect(service.analyze("other-project", "s1")).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.analysis("other-project", "s1")).rejects.toBeInstanceOf(NotFoundException);
    expect(fetcher.fetch).not.toHaveBeenCalled();
    expect(prisma.recommendationAnalysis.upsert).not.toHaveBeenCalled();
  });

  it("stores an analysis built only from fetched evidence", async () => {
    const { service, prisma } = build();
    const result = await service.analyze("p1", "s1");
    expect(result.state).toBe("ANALYZED");
    if (result.state !== "UNAVAILABLE") {
      expect(result.analysis.article.ownMentioned).toBe(false);
      expect(result.analysis.article.featured.map((f) => f.host).sort()).toEqual(["amul.com", "countrydelight.in"]);
      expect(result.analysis.gaps.length).toBeGreaterThan(0);
      expect(result.analysis.readiness.score).toBeGreaterThan(0);
      expect(result.analysis.actionPlan.length).toBe(5);
    }
    const saved = prisma.recommendationAnalysis.upsert.mock.calls[0][0].create;
    expect(saved.analysisVersion).toBe(ANALYSIS_VERSION);
    expect(JSON.stringify(saved.analysis)).not.toContain("<article>");
  });

  it.each(["BLOCKED", "UNKNOWN", "ABSENT"])("records nothing when the page is %s", async (outcome) => {
    const { service, prisma } = build({ fetch: async () => ({ outcome, reason: "robots.txt access refused." }) });
    const result = await service.analyze("p1", "s1");
    expect(result.state).toBe("UNAVAILABLE");
    expect(prisma.recommendationAnalysis.upsert).not.toHaveBeenCalled();
  });

  it("serves a recent analysis from cache without fetching", async () => {
    const { service, fetcher } = build({
      stored: { analysisVersion: ANALYSIS_VERSION, analyzedAt: new Date(), contentHash: "x", analysis: { title: "cached" } },
    });
    const result = await service.analyze("p1", "s1");
    expect(result.state).toBe("CACHED");
    expect(fetcher.fetch).not.toHaveBeenCalled();
  });

  it("skips re-analysis when content and version are unchanged", async () => {
    const { evidenceHash } = jest.requireActual("./backlink-evidence");
    const { service, prisma } = build({
      stored: {
        analysisVersion: ANALYSIS_VERSION,
        analyzedAt: new Date(Date.now() - 3_600_000),
        contentHash: evidenceHash(HTML),
        analysis: { title: "same" },
      },
    });
    const result = await service.analyze("p1", "s1");
    expect(result.state).toBe("CACHED");
    expect(prisma.recommendationAnalysis.upsert).not.toHaveBeenCalled();
  });

  it("re-analyzes when the analysis version changes", async () => {
    const { service, prisma } = build({
      stored: { analysisVersion: "old", analyzedAt: new Date(), contentHash: "x", analysis: {} },
    });
    expect((await service.analyze("p1", "s1")).state).toBe("ANALYZED");
    expect(prisma.recommendationAnalysis.upsert).toHaveBeenCalledTimes(1);
  });

  it("pushes a recommendation action plan into GrowthOpportunity", async () => {
    const { service, prisma } = build({
      stored: {
        analysisVersion: ANALYSIS_VERSION,
        analyzedAt: new Date(),
        analysis: {
          article: { title: "Best Dairy Services", featured: [{ name: "Amul" }] },
          readiness: { score: 75, state: "READY" },
          actionPlan: [{ detail: "Update pricing and delivery areas." }],
          gaps: [{ priority: "High" }],
        },
      },
    });
    prisma.project = { findUnique: jest.fn(async () => ({ organizationId: "org-1" })) };
    prisma.growthOpportunity = { upsert: jest.fn(async ({ create }: any) => ({ id: "opp-1", ...create })) };

    const res = await service.pushToOpportunities("p1", "s1");
    expect(res.opportunityId).toBe("opp-1");
    expect(prisma.growthOpportunity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId_fingerprint: { projectId: "p1", fingerprint: "backlink:recommendation:s1" } },
      }),
    );
  });

  it("updates outreach status and requires user approval", async () => {
    const { service, prisma } = build({
      stored: {
        analysisVersion: ANALYSIS_VERSION,
        analyzedAt: new Date(),
        analysis: {
          outreach: { status: "ANALYZED", approvedByUser: false, pitchDraft: "Initial" },
        },
      },
    });

    const res = await service.updateOutreach("p1", "s1", {
      status: "READY_FOR_REVIEW",
      approvedByUser: true,
      pitchDraft: "Custom pitch",
    });

    expect(res.outreach.approvedByUser).toBe(true);
    expect(res.outreach.status).toBe("READY_FOR_REVIEW");
    expect(res.outreach.pitchDraft).toBe("Custom pitch");
    expect(prisma.recommendationAnalysis.update).toHaveBeenCalled();
  });
});
