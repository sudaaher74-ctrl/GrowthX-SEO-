import { Injectable, NotFoundException, Optional } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { BacklinkFetcher } from "./backlink-fetcher.service";
import { BacklinksService } from "./backlinks.service";
import { evidenceHash } from "./backlink-evidence";
import { analyzeArticle, ANALYSIS_VERSION, ArticleAnalysis } from "./recommendation-article";
import {
  buildActionPlan,
  buildRecommendationGaps,
  calculateReadiness,
  computeExpectedOutcome,
  CustomerBusinessContext,
  EnrichedRecommendationReport,
  generatePitchDraft,
  PublisherOutreachState,
} from "./recommendation-gap-engine";
import { SiteProfileLoader } from "../competitor-action-engine/site-profile.loader";

const PAGE = 25;
const COOLDOWN_MS = 10 * 60_000;

export type AnalyzeResult =
  | { state: "ANALYZED" | "CACHED"; analysis: EnrichedRecommendationReport; analyzedAt: Date }
  | { state: "UNAVAILABLE"; reason: string };

@Injectable()
export class RecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fetcher: BacklinkFetcher,
    private readonly backlinks: BacklinksService,
    @Optional() private readonly siteProfileLoader?: SiteProfileLoader,
  ) {}

  /**
   * KPI Metrics for the header cards matching the design architecture.
   */
  async stats(projectId: string) {
    const competitorSources = await this.prisma.backlinkSource.findMany({
      where: {
        projectId,
        links: { some: { targetKind: "COMPETITOR" } },
      },
      select: {
        id: true,
        links: { select: { targetHost: true, targetKind: true } },
        recommendation: { select: { analysis: true } },
      },
    });

    const totalOpportunities = competitorSources.length;
    const competitorHosts = new Set<string>();
    let highFitCount = 0;

    for (const source of competitorSources) {
      for (const link of source.links) {
        if (link.targetKind === "COMPETITOR") competitorHosts.add(link.targetHost);
      }
      const raw = source.recommendation?.analysis as any;
      if (raw?.readiness?.score >= 65 || raw?.readiness?.state === "READY") {
        highFitCount++;
      }
    }

    const verifiedLinks = await this.prisma.backlink.count({
      where: {
        source: { projectId },
        targetKind: "OWN",
        status: "VERIFIED",
      },
    });

    return {
      totalOpportunities,
      competitorsMentioned: competitorHosts.size,
      highFitOpportunities: highFitCount,
      earnedBacklinks: verifiedLinks,
      estimatedTraffic: `${(totalOpportunities * 45).toLocaleString()}`,
    };
  }

  /**
   * Pages already in this project's monitored sources that link to a saved
   * competitor. A row is a candidate until verified & analyzed.
   */
  async candidates(projectId: string, offset = 0) {
    const where: Prisma.BacklinkSourceWhereInput = {
      projectId,
      links: { some: { targetKind: "COMPETITOR" } },
    };
    const [total, sources] = await Promise.all([
      this.prisma.backlinkSource.count({ where }),
      this.prisma.backlinkSource.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: offset,
        take: PAGE,
        select: {
          id: true,
          sourceUrl: true,
          status: true,
          lastAttemptAt: true,
          links: {
            select: { targetHost: true, targetKind: true, status: true, lastVerifiedAt: true },
          },
          recommendation: { select: { analysis: true, analyzedAt: true } },
        },
      }),
    ]);
    return {
      total,
      offset,
      pageSize: PAGE,
      definitions: {
        candidate:
          "A monitored page that links to a saved competitor. It is not confirmed to be a recommendation until analyzed.",
        ownLink:
          "Own-site link status comes from the verification engine; archived or imported links are not counted as live.",
      },
      items: sources.map((source) => {
        const fullReport = source.recommendation?.analysis as unknown as EnrichedRecommendationReport | undefined;
        const article = (fullReport?.article ?? fullReport) as ArticleAnalysis | undefined;
        const readiness = fullReport?.readiness;
        const own = source.links.filter((link) => link.targetKind === "OWN");
        return {
          id: source.id,
          sourceUrl: source.sourceUrl,
          sourceStatus: source.status,
          lastAttemptAt: source.lastAttemptAt,
          competitorHosts: [
            ...new Set(source.links.filter((l) => l.targetKind === "COMPETITOR").map((l) => l.targetHost)),
          ],
          ownLinkState: own.some((l) => l.status === "VERIFIED")
            ? "VERIFIED"
            : own.length
              ? "NOT_VERIFIED"
              : "NONE_OBSERVED",
          analysis: article
            ? {
                analyzedAt: source.recommendation!.analyzedAt,
                title: article.title,
                listicle: article.listicle,
                featuredCount: article.featured?.length ?? 0,
                ownMentioned: article.ownMentioned,
                ownLinked: article.ownLinked,
                readinessScore: readiness?.score ?? null,
                readinessState: readiness?.state ?? null,
              }
            : null,
        };
      }),
    };
  }

  async analysis(projectId: string, sourceId: string) {
    const source = await this.owned(projectId, sourceId);
    const stored = await this.prisma.recommendationAnalysis.findUnique({ where: { sourceId } });
    return {
      sourceUrl: source.sourceUrl,
      analysis: (stored?.analysis as unknown as EnrichedRecommendationReport) ?? null,
      analyzedAt: stored?.analyzedAt ?? null,
    };
  }

  /**
   * Fetches through the existing robots-aware, SSRF-protected, paced fetcher,
   * extracts article recommendations, and performs gap + readiness assessment.
   */
  async analyze(projectId: string, sourceId: string): Promise<AnalyzeResult> {
    const source = await this.owned(projectId, sourceId);
    const stored = await this.prisma.recommendationAnalysis.findUnique({ where: { sourceId } });
    if (
      stored &&
      stored.analysisVersion === ANALYSIS_VERSION &&
      Date.now() - stored.analyzedAt.getTime() < COOLDOWN_MS
    ) {
      return {
        state: "CACHED",
        analysis: stored.analysis as unknown as EnrichedRecommendationReport,
        analyzedAt: stored.analyzedAt,
      };
    }

    const context = await this.backlinks.context(projectId);
    const fetched = await this.fetcher.fetch(source.sourceUrl);
    if (fetched.outcome !== "READ" || !fetched.html) {
      return {
        state: "UNAVAILABLE",
        reason: `${fetched.reason} No analysis was recorded.`,
      };
    }

    const contentHash = evidenceHash(fetched.html);
    if (stored && stored.contentHash === contentHash && stored.analysisVersion === ANALYSIS_VERSION) {
      const touched = await this.prisma.recommendationAnalysis.update({
        where: { sourceId },
        data: { analyzedAt: new Date() },
      });
      return {
        state: "CACHED",
        analysis: touched.analysis as unknown as EnrichedRecommendationReport,
        analyzedAt: touched.analyzedAt,
      };
    }

    // 1. Deterministic article analysis
    const article = analyzeArticle(
      fetched.html,
      fetched.finalUrl ?? source.sourceUrl,
      context.own,
      context.competitors,
    );

    // 2. Load customer business & site profile
    const customerContext = await this.loadCustomerContext(projectId);

    // 3. Gap Analysis & Readiness Assessment
    const gaps = buildRecommendationGaps(article, customerContext);
    const readiness = calculateReadiness(article, customerContext, gaps);
    const actionPlan = buildActionPlan(customerContext, article, gaps);
    const expectedOutcome = computeExpectedOutcome(article);
    const pitchDraft = generatePitchDraft(customerContext, article);

    const outreach: PublisherOutreachState = {
      status: "ANALYZED",
      approvedByUser: false,
      pitchDraft,
      contactChannel: null,
      contactedAt: null,
      outcome: null,
    };

    const fullReport: EnrichedRecommendationReport = {
      article,
      gaps,
      readiness,
      actionPlan,
      expectedOutcome,
      outreach,
    };

    const saved = await this.prisma.recommendationAnalysis.upsert({
      where: { sourceId },
      create: {
        sourceId,
        analysisVersion: ANALYSIS_VERSION,
        contentHash,
        analysis: fullReport as unknown as Prisma.InputJsonValue,
      },
      update: {
        analysisVersion: ANALYSIS_VERSION,
        contentHash,
        analysis: fullReport as unknown as Prisma.InputJsonValue,
        analyzedAt: new Date(),
      },
    });

    return {
      state: "ANALYZED",
      analysis: fullReport,
      analyzedAt: saved.analyzedAt,
    };
  }

  /**
   * Pushes the primary recommendation action into Reigel's GrowthOpportunity queue.
   */
  async pushToOpportunities(projectId: string, sourceId: string) {
    const source = await this.owned(projectId, sourceId);
    const stored = await this.prisma.recommendationAnalysis.findUnique({ where: { sourceId } });
    if (!stored) throw new NotFoundException("Analyze this recommendation before adding to opportunities.");

    const report = stored.analysis as unknown as EnrichedRecommendationReport;
    const article = report.article ?? (report as any);
    const readiness = report.readiness;
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });
    if (!project) throw new NotFoundException("Project not found.");

    const fingerprint = `backlink:recommendation:${sourceId}`;
    const firstAction = report.actionPlan?.[0];

    const opportunity = await this.prisma.growthOpportunity.upsert({
      where: { projectId_fingerprint: { projectId, fingerprint } },
      create: {
        organizationId: project.organizationId,
        projectId,
        fingerprint,
        source: "BACKLINKS",
        category: "SEO",
        title: `Editorial placement: ${article.title.slice(0, 90)}`,
        summary: `Publisher article recommends competitors (${article.featured?.map((f: any) => f.name).slice(0, 3).join(", ") || "industry"}). Readiness score is ${readiness?.score ?? 60}/100.`,
        recommendedAction: firstAction?.detail ?? "Review editorial criteria and update website presentation.",
        evidence: [
          { label: "Publisher URL", value: source.sourceUrl, source: "Recommendation analysis" },
          { label: "Readiness score", value: `${readiness?.score ?? "N/A"}/100 (${readiness?.state ?? "PARTIAL"})`, source: "Recommendation readiness" },
          { label: "High priority gaps", value: String(report.gaps?.filter((g) => g.priority === "High").length ?? 0), source: "Gap analysis" },
        ],
        potential: "HIGH",
        effort: "MEDIUM",
        confidence: readiness?.score ?? 70,
        priority: 75,
        detailType: "RECOMMENDATION",
        detailRef: sourceId,
      },
      update: {
        summary: `Publisher article recommends competitors. Readiness score: ${readiness?.score ?? 60}/100.`,
        recommendedAction: firstAction?.detail ?? "Review editorial criteria and update website presentation.",
      },
    });

    return {
      message: "Action plan pushed to your Opportunities queue.",
      opportunityId: opportunity.id,
    };
  }

  /**
   * Updates publisher outreach status, human approval, or customized pitch draft.
   */
  async updateOutreach(
    projectId: string,
    sourceId: string,
    payload: {
      status?: PublisherOutreachState["status"];
      approvedByUser?: boolean;
      pitchDraft?: string;
      contactChannel?: string;
      outcome?: string;
    },
  ) {
    await this.owned(projectId, sourceId);
    const stored = await this.prisma.recommendationAnalysis.findUnique({ where: { sourceId } });
    if (!stored) throw new NotFoundException("Analysis not found.");

    const report = stored.analysis as unknown as EnrichedRecommendationReport;
    const currentOutreach = report.outreach ?? {
      status: "ANALYZED",
      approvedByUser: false,
      pitchDraft: "",
      contactChannel: null,
      contactedAt: null,
      outcome: null,
    };

    const updatedOutreach: PublisherOutreachState = {
      ...currentOutreach,
      status: payload.status ?? currentOutreach.status,
      approvedByUser: payload.approvedByUser !== undefined ? payload.approvedByUser : currentOutreach.approvedByUser,
      pitchDraft: payload.pitchDraft !== undefined ? payload.pitchDraft : currentOutreach.pitchDraft,
      contactChannel: payload.contactChannel !== undefined ? payload.contactChannel : currentOutreach.contactChannel,
      contactedAt: payload.status === "CONTACTED" && !currentOutreach.contactedAt ? new Date().toISOString() : currentOutreach.contactedAt,
      outcome: payload.outcome !== undefined ? payload.outcome : currentOutreach.outcome,
    };

    report.outreach = updatedOutreach;

    await this.prisma.recommendationAnalysis.update({
      where: { sourceId },
      data: { analysis: report as unknown as Prisma.InputJsonValue },
    });

    return {
      message: "Outreach status updated successfully.",
      outreach: updatedOutreach,
    };
  }

  private async loadCustomerContext(projectId: string): Promise<CustomerBusinessContext> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        websites: { select: { domain: true }, take: 1 },
        businessProfile: true,
      },
    });

    const domain = project?.websites[0]?.domain ?? "example.com";
    const bp = project?.businessProfile;

    let siteProfile = null;
    if (this.siteProfileLoader) {
      try {
        siteProfile = await this.siteProfileLoader.forProject(projectId);
      } catch {
        /* site profile load failure degrades gracefully */
      }
    }

    return {
      domain,
      businessName: bp?.businessName || project?.name || domain,
      industry: bp?.industry ?? null,
      summary: bp?.summary ?? null,
      offerings: bp?.offerings ?? [],
      city: bp?.city ?? null,
      state: bp?.state ?? null,
      country: bp?.country ?? null,
      totalPages: siteProfile?.totalPages,
      pagesByType: siteProfile?.byType,
      healthScore: siteProfile?.healthScore,
      pagesWithSchema: siteProfile?.pagesWithSchema,
    };
  }

  /** Tenant isolation: a source is only reachable through its own project. */
  private async owned(projectId: string, sourceId: string) {
    const source = await this.prisma.backlinkSource.findFirst({
      where: { id: sourceId, projectId },
      select: { id: true, sourceUrl: true },
    });
    if (!source) throw new NotFoundException("Source page not found.");
    return source;
  }
}
