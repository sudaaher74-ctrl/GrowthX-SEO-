import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import {
  AgentKind,
  AgentRun,
  Evidence,
  IssueSeverity,
  RecommendationEffort,
  RecommendationHorizon,
  RecommendationImpact,
  } from '@prisma/client';
import { USABLE_CRAWL } from '../crawler/crawl-selection';
import { PrismaService } from '../../database/prisma.service';
import { AgentRunService } from '../agents/agent-run.service';
import { AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { AiVisibilityService } from '../ai-visibility/ai-visibility.service';
import { parseModelJson } from '../ai-engine/utils/json-extractor.util';
import {
  buildEvidenceRecords,
  buildStrategyPrompt,
  STRATEGY_SCHEMA,
  STRATEGY_SYSTEM_PROMPT,
  StrategyEvidence,
} from './strategy-evidence';

/** Enough context that a plan is about this business, not websites in general. */
const SAMPLE_PAGE_LIMIT = 15;
const LOST_PROMPT_LIMIT = 10;

/**
 * The model answers with the labels from the JSON schema; these map them onto
 * the stored enums. An unrecognised label falls back to the most conservative
 * option rather than the most flattering one.
 */
const HORIZONS: Record<string, RecommendationHorizon> = {
  '30-day': RecommendationHorizon.DAYS_30,
  '60-day': RecommendationHorizon.DAYS_60,
  '90-day': RecommendationHorizon.DAYS_90,
};

const EFFORTS: Record<string, RecommendationEffort> = {
  LOW: RecommendationEffort.LOW,
  MEDIUM: RecommendationEffort.MEDIUM,
  HIGH: RecommendationEffort.HIGH,
};

const IMPACTS: Record<string, RecommendationImpact> = {
  LOW: RecommendationImpact.LOW,
  MEDIUM: RecommendationImpact.MEDIUM,
  HIGH: RecommendationImpact.HIGH,
  VERY_HIGH: RecommendationImpact.VERY_HIGH,
};

@Injectable()
export class StrategyService {
  private readonly logger = new Logger(StrategyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MultiAiRouterService,
    private readonly visibility: AiVisibilityService,private readonly agentRuns: AgentRunService,
  ) {}

  /**
   * Assembles everything we know about a project from its crawl and its AI
   * visibility history. Exposed so the API can show a customer the basis for a
   * plan before paying a report against their allowance.
   */
  async gatherEvidence(projectId: string): Promise<StrategyEvidence> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { websites: { select: { id: true, domain: true } }, competitors: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const websiteIds = project.websites.map((w) => w.id);

    const latestCrawl = websiteIds.length
      ? await this.prisma.crawlJob.findFirst({
          // Finished crawls only: a crawl still running has read part of the site.
          where: { websiteId: { in: websiteIds }, ...USABLE_CRAWL },
          orderBy: { createdAt: 'desc' },
        })
      : null;

    let criticalIssues = 0;
    let highIssues = 0;
    let topIssueTypes: { issueType: string; count: number }[] = [];
    let samplePages: StrategyEvidence['site']['samplePages'] = [];

    if (latestCrawl) {
      const [critical, high, grouped, pages] = await Promise.all([
        this.prisma.issue.count({ where: { crawlJobId: latestCrawl.id, severity: IssueSeverity.CRITICAL } }),
        this.prisma.issue.count({ where: { crawlJobId: latestCrawl.id, severity: IssueSeverity.HIGH } }),
        this.prisma.issue.groupBy({
          by: ['issueType'],
          where: { crawlJobId: latestCrawl.id, status: 'OPEN' },
          _count: { issueType: true },
          orderBy: { _count: { issueType: 'desc' } },
          take: 8,
        }),
        this.prisma.page.findMany({
          where: { crawlJobId: latestCrawl.id },
          select: { url: true, title: true, wordCount: true },
          orderBy: { wordCount: 'desc' },
          take: SAMPLE_PAGE_LIMIT,
        }),
      ]);

      criticalIssues = critical;
      highIssues = high;
      topIssueTypes = grouped.map((g: any) => ({ issueType: g.issueType, count: g._count.issueType }));
      samplePages = pages;
    }

    const trackedPromptCount = await this.prisma.trackedPrompt.count({
      where: { projectId, isActive: true },
    });

    let citationSharePct: number | null = null;
    let averagePosition: number | null = null;
    let byAssistant: { assistant: string; citationSharePct: number }[] = [];
    let lostPrompts: { prompt: string; competitors: string[] }[] = [];

    if (trackedPromptCount > 0) {
      const report = await this.visibility.getReport(projectId, 28);
      citationSharePct = report.summary.citationSharePct;
      averagePosition = report.summary.averagePosition;
      byAssistant = report.byAssistant.map((a) => ({
        assistant: a.assistant,
        citationSharePct: a.citationSharePct,
      }));

      // The prompts worth writing content for: a rival is being recommended
      // and this business is not.
      const losses = await this.prisma.promptCheck.findMany({
        where: {
          trackedPrompt: { projectId },
          cited: false,
          error: null,
          NOT: { competitorsCited: { isEmpty: true } },
        },
        select: { competitorsCited: true, trackedPrompt: { select: { text: true } } },
        orderBy: { checkedAt: 'desc' },
        take: 50,
      });

      const seen = new Set<string>();
      for (const loss of losses) {
        const text = loss.trackedPrompt.text;
        if (seen.has(text)) continue;
        seen.add(text);
        lostPrompts.push({ prompt: text, competitors: loss.competitorsCited });
        if (lostPrompts.length >= LOST_PROMPT_LIMIT) break;
      }
    }

    const since28d = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);

    // Cross-signal 1: Search Console (28d)
    let searchConsole: StrategyEvidence['searchConsole'] = null;
    if (this.prisma.gscDailyMetric?.findMany) {
      try {
        const [totalRows, queryRows] = await Promise.all([
          this.prisma.gscDailyMetric.findMany({
            where: { projectId, grain: 'TOTAL', date: { gte: since28d } },
            select: { clicks: true, impressions: true },
          }),
          this.prisma.gscDailyMetric.findMany({
            where: { projectId, grain: 'QUERY', date: { gte: since28d }, query: { not: null } },
            select: { query: true, clicks: true, impressions: true, position: true },
            take: 1500,
          }),
        ]);

        const byQuery = new Map<string, { clicks: number; impressions: number; posWeighted: number }>();
        for (const r of queryRows) {
          const q = (r.query ?? '').trim();
          if (!q) continue;
          const prev = byQuery.get(q) ?? { clicks: 0, impressions: 0, posWeighted: 0 };
          prev.clicks += r.clicks;
          prev.impressions += r.impressions;
          prev.posWeighted += r.position * Math.max(1, r.impressions);
          byQuery.set(q, prev);
        }

        const aggregated = [...byQuery.entries()].map(([query, v]) => ({
          query,
          clicks: v.clicks,
          impressions: v.impressions,
          ctrPct: v.impressions > 0 ? Number(((v.clicks / v.impressions) * 100).toFixed(2)) : 0,
          position: v.impressions > 0 ? Number((v.posWeighted / v.impressions).toFixed(1)) : 0,
        }));

        const totalClicks = totalRows.reduce((acc, r) => acc + r.clicks, 0);
        const totalImpressions = totalRows.reduce((acc, r) => acc + r.impressions, 0);

        if (totalClicks > 0 || totalImpressions > 0 || aggregated.length > 0) {
          const topQueries = [...aggregated].sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).slice(0, 6);
          const lowCtrQueries = aggregated
            .filter((q) => q.impressions >= 25 && q.ctrPct < 3)
            .sort((a, b) => b.impressions - a.impressions)
            .slice(0, 5);

          searchConsole = {
            windowDays: 28,
            clicks: totalClicks || aggregated.reduce((acc, r) => acc + r.clicks, 0),
            impressions: totalImpressions || aggregated.reduce((acc, r) => acc + r.impressions, 0),
            topQueries,
            lowCtrQueries,
          };
        }
      } catch (err: any) {
        this.logger.warn(`Strategy GSC evidence skipped for ${projectId}: ${err?.message ?? err}`);
      }
    }

    // Cross-signal 2: Google Analytics 4 (28d)
    let analytics: StrategyEvidence['analytics'] = null;
    if (this.prisma.ga4DailyMetric?.findMany) {
      try {
        const [totalRows, channelRows] = await Promise.all([
          this.prisma.ga4DailyMetric.findMany({
            where: { projectId, grain: 'TOTAL', date: { gte: since28d } },
            select: { sessions: true, users: true, conversions: true },
          }),
          this.prisma.ga4DailyMetric.findMany({
            where: { projectId, grain: 'CHANNEL', date: { gte: since28d }, channel: { not: null } },
            select: { channel: true, sessions: true },
            take: 1000,
          }),
        ]);

        const sessions = totalRows.reduce((acc, r) => acc + r.sessions, 0);
        const users = totalRows.reduce((acc, r) => acc + r.users, 0);
        const hasConversions = totalRows.some((r) => r.conversions !== null);
        const conversions = hasConversions
          ? totalRows.reduce((acc, r) => acc + (r.conversions ?? 0), 0)
          : null;

        const byChannel = new Map<string, number>();
        for (const r of channelRows) {
          const ch = (r.channel ?? '').trim();
          if (!ch) continue;
          byChannel.set(ch, (byChannel.get(ch) ?? 0) + r.sessions);
        }
        const channelTotal = [...byChannel.values()].reduce((a, b) => a + b, 0) || sessions;
        const topChannels = [...byChannel.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([channel, count]) => ({
            channel,
            sessions: count,
            sharePct: channelTotal > 0 ? Number(((count / channelTotal) * 100).toFixed(1)) : 0,
          }));

        if (sessions > 0) {
          analytics = {
            windowDays: 28,
            sessions,
            users,
            conversions,
            topChannels,
          };
        }
      } catch (err: any) {
        this.logger.warn(`Strategy GA4 evidence skipped for ${projectId}: ${err?.message ?? err}`);
      }
    }

    // Cross-signal 3: Verified Backlinks & Lost Links
    let backlinks: StrategyEvidence['backlinks'] = null;
    if (this.prisma.backlink?.findMany) {
      try {
        const rows = await this.prisma.backlink.findMany({
          where: { source: { projectId } },
          select: { status: true, source: { select: { sourceUrl: true } } },
          take: 500,
        });
        const verified = rows.filter((r) => r.status === 'VERIFIED');
        const lost = rows.filter((r) => r.status === 'LOST');
        if (verified.length > 0 || lost.length > 0) {
          const domains = new Set<string>();
          for (const row of verified) {
            try {
              domains.add(new URL(row.source.sourceUrl).hostname.replace(/^www\./i, ''));
            } catch {
              // ignore malformed URL
            }
          }
          backlinks = {
            verifiedCount: verified.length,
            referringDomains: domains.size,
            lostCount: lost.length,
          };
        }
      } catch (err: any) {
        this.logger.warn(`Strategy Backlinks evidence skipped for ${projectId}: ${err?.message ?? err}`);
      }
    }

    return {
      business: { projectName: project.name, domains: project.websites.map((w) => w.domain) },
      site: {
        crawlJobId: latestCrawl?.id ?? null,
        pagesCrawled: latestCrawl?.pagesCrawled ?? 0,
        lastCrawledAt: latestCrawl?.finishedAt?.toISOString() ?? null,
        criticalIssues,
        highIssues,
        topIssueTypes,
        samplePages,
      },
      aiVisibility: {
        citationSharePct,
        averagePosition,
        byAssistant,
        lostPrompts,
        trackedPromptCount,
      },
      competitors: project.competitors.map((c) => ({ domain: c.domain, label: c.label })),
      searchConsole,
      analytics,
      backlinks,
    };
  }

  /**
   * Produces a market + SEO + content + social plan for a project.
   *
   * There is no heuristic fallback here on purpose. A crawl fix can be derived
   * from a URL, but a strategy cannot — a template would be generic advice
   * dressed up as analysis, which is exactly what the customer is paying us not
   * to send. If no model is reachable we say so.
   */
  async generate(projectId: string, _organizationId: string) {

    const evidence = await this.gatherEvidence(projectId);

    if (evidence.site.pagesCrawled === 0) {
      throw new BadRequestException(
        'Run a crawl before generating a strategy — without site data the plan would be generic advice.',
      );
    }

    const keyed = buildEvidenceRecords(evidence);

    return this.agentRuns.withRun(
      projectId,
      AgentKind.STRATEGY,
      async (run) => {
        // Evidence is persisted before the model is called, so the observations
        // exist independently of whatever the model does with them.
        const stored = await this.agentRuns.recordEvidenceBatch(
          run,
          keyed.map(({ key: _key, ...record }) => record),
        );
        const byKey = new Map(keyed.map((record, i) => [record.key, stored[i]]));

        const completion = await this.router.generate({
          prompt: buildStrategyPrompt(evidence, keyed),
          systemInstruction: STRATEGY_SYSTEM_PROMPT,
          task: AiTask.REASONING,
          // Without this the call had no organization, so no budget or token
          // wallet applied to what is one of the longest calls in the product.
          projectId,
          jsonSchema: STRATEGY_SCHEMA as unknown as Record<string, unknown>,
          // Strategy output is long; leave room for reasoning plus the plan itself.
          maxTokens: 16000,
        });

        if (completion.refused || !completion.text.trim()) {
          throw new ServiceUnavailableException('The model did not return a strategy. Please retry.');
        }

        const content = this.parseJson(completion.text);
        if (!content.seoRoadmap || !Array.isArray(content.seoRoadmap)) {
          throw new ServiceUnavailableException('The model returned an unusable strategy. Please retry.');
        }

        const { recommendations, discarded } = await this.persistRoadmap(run, content.seoRoadmap, byKey);

        if (recommendations === 0) {
          throw new ServiceUnavailableException(
            'The model produced no recommendation that cited real evidence. Please retry.',
          );
        }
        if (discarded > 0) {
          this.logger.warn(
            `Discarded ${discarded} strategy item(s) for project ${projectId}: cited evidence that was never observed.`,
          );
        }

        const report = await this.prisma.strategyReport.create({
          data: {
            projectId,
            evidence: evidence as any,
            content,
            generatedByModel: completion.model,
          },
        });
        this.logger.log(
          `Strategy generated for project ${projectId} by ${completion.model}: ${recommendations} recommendation(s).`,
        );

        return { result: report, model: completion.model };
      },
      { pagesCrawled: evidence.site.pagesCrawled, evidenceCount: keyed.length },
    );
  }

  /**
   * Turns roadmap entries into Recommendations, dropping any that cite an
   * evidence key we never recorded.
   *
   * A model asked to cite its sources will occasionally invent a plausible key.
   * Dropping those is the whole point of the mechanism: the alternative is
   * attaching the recommendation to some arbitrary other observation, which
   * would make the provenance trail lie rather than merely be incomplete.
   */
  private async persistRoadmap(
    run: AgentRun,
    roadmap: any[],
    byKey: Map<string, Evidence>,
  ): Promise<{ recommendations: number; discarded: number }> {
    let recommendations = 0;
    let discarded = 0;

    for (const item of roadmap) {
      const primaryEvidence = byKey.get(String(item?.evidenceKey ?? ''));
      if (!primaryEvidence || !item?.action) {
        discarded++;
        continue;
      }

      await this.agentRuns.recommend(run, {
        title: String(item.action),
        rationale: String(item.why ?? ''),
        horizon: HORIZONS[String(item.horizon)] ?? RecommendationHorizon.DAYS_90,
        effort: EFFORTS[String(item.effort)] ?? RecommendationEffort.MEDIUM,
        impact: IMPACTS[String(item.impact)] ?? RecommendationImpact.MEDIUM,
        owner: String(item.owner || 'Unassigned'),
        primaryEvidence,
      });
      recommendations++;
    }

    return { recommendations, discarded };
  }

  async list(projectId: string) {
    return this.prisma.strategyReport.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, generatedByModel: true },
    });
  }

  async get(projectId: string, reportId: string) {
    const report = await this.prisma.strategyReport.findFirst({ where: { id: reportId, projectId } });
    if (!report) throw new NotFoundException('Strategy report not found');
    return report;
  }

  /** Reads the model's JSON answer, repairing truncation or naming the failure. */
  private parseJson(text: string): Record<string, any> {
    return parseModelJson(text, 'Strategy');
  }
}
