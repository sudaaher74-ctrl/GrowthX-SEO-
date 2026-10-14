import { Injectable, NotFoundException } from "@nestjs/common";
import { load } from "cheerio";
import { PrismaService } from "../../database/prisma.service";
import { GoogleReportService } from "../search-intelligence/google-report.service";
import { CompetitorIntelReportService } from "../competitor-action-engine/competitor-intel-report.service";
import { VisibilityContext, VisibilityFact } from "./visibility-workflow.types";

@Injectable()
export class VisibilityContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly google: GoogleReportService,
    private readonly competitors: CompetitorIntelReportService,
  ) {}

  async gather(projectId: string): Promise<VisibilityContext> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        businessProfile: true,
        websites: {
          where: { scope: "own" },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    });
    if (!project) throw new NotFoundException("Project not found");
    const website = project.websites[0];
    const crawl = website
      ? await this.prisma.crawlJob.findFirst({
          where: { websiteId: website.id, status: "COMPLETED" },
          orderBy: { finishedAt: "desc" },
        })
      : null;
    const [pageCount, pages, googleResult, rivalsResult] = await Promise.all([
      crawl ? this.prisma.page.count({ where: { crawlJobId: crawl.id } }) : 0,
      crawl
        ? this.prisma.page.findMany({
            where: { crawlJobId: crawl.id, statusCode: { gte: 200, lt: 300 } },
            orderBy: { url: "asc" },
            take: 40,
            select: {
              id: true,
              url: true,
              title: true,
              h1: true,
              h2: true,
              metaDescription: true,
              pageType: true,
              rawHtml: true,
              renderedHtml: true,
              indexability: true,
              jsRequired: true,
              schemas: { select: { schemaType: true, isValid: true } },
              issues: {
                where: { status: "OPEN" },
                take: 5,
                select: { issueType: true, description: true, severity: true },
              },
            },
          })
        : [],
      this.google
        .gatherFacts(projectId, 28)
        .then((data) => ({ data, error: null }))
        .catch(() => ({
          data: null,
          error:
            "Google data could not be read. Reconnect or sync the Google section.",
        })),
      this.competitors
        .gatherFacts(projectId)
        .then((data) => ({ data, error: null }))
        .catch(() => ({
          data: null,
          error:
            "Competitor Intelligence could not be read. Complete its setup and crawl.",
        })),
    ]);
    const facts: VisibilityFact[] = [];
    const candidate = project.businessProfile;
    const profile =
      candidate &&
      website &&
      candidate.domain.replace(/^www\./, "") ===
        website.domain.replace(/^www\./, "")
        ? candidate
        : null;
    if (profile) {
      facts.push({
        id: "profile",
        source: "website",
        text: JSON.stringify({
          name: profile.businessName,
          industry: profile.industry,
          summary: profile.summary,
          offerings: profile.offerings,
          city: profile.city,
          state: profile.state,
          country: profile.country,
          goal: profile.businessGoal,
          audience: profile.targetAudience,
          confidence: profile.confidence,
          detectedAt: profile.detectedAt,
          signals: profile.signals,
        }),
      });
    }
    for (const page of pages) {
      const $ = load(
        (page.renderedHtml || page.rawHtml || "").slice(0, 400_000),
      );
      $("script,style,noscript,svg").remove();
      const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 1000);
      facts.push({
        id: `page-${page.id}`,
        source: "website",
        url: page.url,
        text: JSON.stringify({
          title: page.title,
          description: page.metaDescription?.slice(0, 400),
          headings: [...page.h1, ...page.h2]
            .slice(0, 12)
            .map((h) => h.slice(0, 160)),
          text,
          type: page.pageType,
          indexability: page.indexability,
          jsRequired: page.jsRequired,
          schemas: page.schemas,
          issues: page.issues.map((i) => ({
            ...i,
            description: i.description.slice(0, 300),
          })),
        }),
      });
    }
    const g = googleResult.data;
    if (g?.searchConsole.hasData)
      facts.push({
        id: "gsc",
        source: "gsc",
        text: JSON.stringify({
          periodDays: 28,
          syncedAt: g.searchConsole.lastSyncedAt,
          kpis: g.kpis.filter((k) => k.source === "GSC"),
          queries: g.topQueries,
          pages: g.topPages,
          opportunities: g.ctrOpportunities,
          strikingDistance: g.strikingDistance,
          declining: g.decliningQueries,
          index: g.index,
        }),
      });
    if (g?.traffic)
      facts.push({
        id: "ga4",
        source: "ga4",
        text: JSON.stringify({
          periodDays: 28,
          syncedAt: g.analytics.lastSyncedAt,
          ...g.traffic,
        }),
      });
    for (const [i, rival] of (rivalsResult.data?.rivals ?? []).entries()) {
      facts.push({
        id: `rival-${i}`,
        source: "competitors",
        url: `https://${rival.domain}`,
        text: JSON.stringify(rival),
      });
    }
    const limitations = [
      googleResult.error,
      rivalsResult.error,
      ...(g?.notMeasured ?? []),
    ].filter((s): s is string => !!s);
    // Reserve website evidence before filling the remaining budget with other sources.
    const firstPage = facts.find((f) => f.id.startsWith("page-"));
    const ordered = [
      ...(firstPage ? [firstPage] : []),
      ...facts.filter((f) => !f.id.startsWith("page-")),
      ...facts.filter((f) => f.id.startsWith("page-") && f !== firstPage),
    ];
    let chars = 0;
    const boundedFacts = ordered.filter((f) => {
      if (chars + f.text.length > 60_000) return false;
      chars += f.text.length;
      return true;
    });
    if (boundedFacts.length < facts.length)
      limitations.push(
        `Some evidence was omitted to fit the AI input budget (${facts
          .filter((f) => !boundedFacts.includes(f))
          .map((f) => f.id)
          .join(", ")}). Source modules retain the full reports.`,
      );
    if (pageCount > pages.length)
      limitations.push(
        `Website analysis uses ${pages.length} successful pages from ${pageCount} audited pages; a missing sampled topic is not proof the entire site lacks it.`,
      );
    limitations.push(
      "GA4 city labels and top-city samples cannot establish every visitor’s service eligibility or lead intent.",
      "API answers are a sample from the stated models. They do not measure the Gemini consumer app or Google AI Overviews.",
    );
    return {
      gatheredAt: new Date().toISOString(),
      businessName: profile?.businessName || project.name,
      domain: website?.domain || "",
      facts: boundedFacts,
      cities: g?.traffic?.cities ?? [],
      keyEvents: g?.traffic?.keyEvents ?? null,
      limitations,
      sources: [
        {
          id: "website",
          label: "Website Audit",
          available: !!pages.length,
          updatedAt: crawl?.finishedAt?.toISOString() ?? null,
          detail: crawl
            ? `${pageCount} pages audited · ${boundedFacts.filter((f) => f.id.startsWith("page-")).length} pages in this evidence snapshot`
            : "Run a Website Audit to understand the business.",
          href: "/website",
        },
        {
          id: "gsc",
          label: "Search Console",
          available: !!g?.searchConsole.hasData,
          updatedAt: g?.searchConsole.lastSyncedAt ?? null,
          detail: g?.searchConsole.hasData
            ? "Last 28 days: queries, clicks, impressions and search opportunities"
            : "Connect and sync Search Console to include search demand.",
          href: "/google",
        },
        {
          id: "ga4",
          label: "Google Analytics 4",
          available: !!g?.traffic,
          updatedAt: g?.analytics.lastSyncedAt ?? null,
          detail: g?.traffic
            ? "Last 28 days: cities, channels, landing pages and key events"
            : "Connect and sync GA4 to include visitor and conversion data.",
          href: "/google/analytics",
        },
        {
          id: "competitors",
          label: "Competitor Intelligence",
          available: !!rivalsResult.data?.rivals.some((r) => r.crawledAt),
          updatedAt:
            rivalsResult.data?.rivals
              .map((r) => r.crawledAt)
              .filter((d): d is string => !!d)
              .sort()
              .at(-1) ?? null,
          detail: `${rivalsResult.data?.rivals.filter((r) => r.crawledAt).length ?? 0} competitors with completed website evidence`,
          href: "/competitor-intelligence",
        },
      ],
    };
  }
}
