import { VisibilityContextService } from "./visibility-context.service";

function sources() {
  const prisma: any = {
    project: {
      findUnique: jest.fn(async () => ({
        name: "Milquufresh",
        websites: [{ id: "own", domain: "milquufresh.in" }],
        businessProfile: {
          domain: "old-project.test",
          businessName: "An unrelated old business",
        },
      })),
    },
    crawlJob: {
      findFirst: jest.fn(async () => ({
        id: "crawl",
        finishedAt: new Date("2026-10-14"),
      })),
    },
    page: {
      count: jest.fn(async () => 41),
      findMany: jest.fn(async () => [
        {
          id: "home",
          url: "https://milquufresh.in",
          title: "Milquufresh",
          h1: ["Cow milk delivery"],
          h2: ["Panvel"],
          metaDescription: null,
          rawHtml:
            "<body>Delivery in Panvel and Kharghar.<script>SECRET_SCRIPT</script></body>",
          renderedHtml: null,
          pageType: "HOME",
          indexability: "INDEXABLE",
          jsRequired: false,
          schemas: [],
          issues: [],
        },
      ]),
    },
  };
  const google: any = {
    gatherFacts: jest.fn(async () => ({
      searchConsole: { hasData: true, lastSyncedAt: "2026-10-13" },
      analytics: { lastSyncedAt: "2026-10-14" },
      kpis: [{ source: "GSC", label: "Clicks", value: 30 }],
      topQueries: [{ query: "milk delivery panvel", clicks: 30 }],
      topPages: [],
      ctrOpportunities: [],
      strikingDistance: [],
      decliningQueries: [],
      index: {},
      notMeasured: [],
      traffic: {
        cities: [{ city: "Delhi", country: "India", sessions: 200 }],
        keyEvents: null,
      },
    })),
  };
  const competitors: any = {
    gatherFacts: jest.fn(async () => ({
      rivals: [
        {
          name: "Local Dairy",
          domain: "localdairy.test",
          crawledAt: "2026-10-13",
          comparison: [],
        },
      ],
    })),
  };
  return {
    prisma,
    google,
    competitors,
    service: new VisibilityContextService(prisma, google, competitors),
  };
}

describe("cross-channel business evidence", () => {
  it("joins all four sources without accepting a profile from a different website", async () => {
    const h = sources();
    const result = await h.service.gather("project");
    expect(result.facts.map((f) => f.source)).toEqual(
      expect.arrayContaining(["website", "gsc", "ga4", "competitors"]),
    );
    expect(result.sources.every((s) => s.available)).toBe(true);
    expect(result.businessName).toBe("Milquufresh");
    expect(result.facts.some((f) => f.id === "profile")).toBe(false);
    expect(JSON.stringify(result.facts)).not.toContain("SECRET_SCRIPT");
    expect(result.cities[0].city).toBe("Delhi");
    expect(result.keyEvents).toBeNull();
    expect(h.google.gatherFacts).toHaveBeenCalledWith("project", 28);
    expect(h.competitors.gatherFacts).toHaveBeenCalledWith("project");
    expect(h.prisma.crawlJob.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { websiteId: "own", status: "COMPLETED" },
      }),
    );
    expect(result.limitations.join(" ")).toContain(
      "1 successful pages from 41",
    );
  });
  it("preserves website evidence and explicitly reports disconnected sources", async () => {
    const h = sources();
    h.google.gatherFacts.mockRejectedValue(new Error("Disconnected"));
    h.competitors.gatherFacts.mockRejectedValue(new Error("Not set up"));
    const result = await h.service.gather("project");
    expect(result.facts.map((f) => f.id)).toEqual(["page-home"]);
    expect(result.sources.filter((s) => s.available).map((s) => s.id)).toEqual([
      "website",
    ]);
    expect(result.keyEvents).toBeNull();
    expect(result.cities).toEqual([]);
    expect(result.limitations.join(" ")).toContain("Reconnect or sync");
  });
  it("keeps own-site evidence within the budget even when another report is oversized", async () => {
    const h = sources();
    const g = await h.google.gatherFacts();
    g.topQueries = [{ query: "x".repeat(70_000), clicks: 0 }];
    h.google.gatherFacts.mockResolvedValue(g);
    const result = await h.service.gather("project");
    expect(result.facts.some((f) => f.id === "page-home")).toBe(true);
    expect(
      result.facts.reduce((sum, f) => sum + f.text.length, 0),
    ).toBeLessThanOrEqual(60_000);
    expect(result.limitations.join(" ")).toContain("gsc");
  });
});
