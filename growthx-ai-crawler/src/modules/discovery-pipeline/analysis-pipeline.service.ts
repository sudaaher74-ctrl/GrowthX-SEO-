import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { ClassificationService } from '../content-intelligence/classification.service';
import { SocialScraperService } from '../content-intelligence/social-scraper.service';
import { OwnSocialSyncService } from '../content-intelligence/own-social-sync.service';
import { PatternDetectionService } from '../content-intelligence/pattern-detection.service';
import { GapAnalysisService } from '../content-intelligence/gap-analysis.service';
import { ContentStrategyService } from '../content-intelligence/content-strategy.service';
import { StrategyEngineService } from '../competitor-action-engine/strategy-engine.service';

/** One stage of the chain, and what it did. */
export interface AnalysisStage {
  stage: string;
  /** `ran` — did work. `nothing_to_do` — ran and had no input. `failed`. */
  outcome: 'ran' | 'nothing_to_do' | 'failed';
  /** What happened, in the words the stage itself used. */
  detail: string;
}

export interface AnalysisRun {
  projectId: string;
  startedAt: string;
  stages: AnalysisStage[];
}

/**
 * The analysis that turns collected competitor data into a plan.
 *
 * Seven stages, each refusing to run without the one before it: competitor
 * posts are collected, the customer's own posts are collected, that content is
 * classified, classifications become creative patterns, patterns become
 * content gaps, crawls and gaps become findings, and findings become a dated
 * action plan and a content strategy that can finally see both sides.
 *
 * Every stage was built, tested, and reachable only from a manual POST. The
 * one scheduled job in this area generated a content strategy every Monday
 * from `patterns: []` and `gaps: []`, because nothing had ever run the two
 * stages that fill them — so the strategy took its own "no competitive data
 * has been collected" branch every week on installations where competitor
 * content was being collected nightly and sitting unclassified.
 *
 * Ordering is the whole job. Each stage's own refusal message names the stage
 * before it, which is precisely the chain nothing was walking.
 */
@Injectable()
export class AnalysisPipelineService {
  private readonly logger = new Logger(AnalysisPipelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scraper: SocialScraperService,
    private readonly ownSocial: OwnSocialSyncService,
    private readonly classification: ClassificationService,
    private readonly patterns: PatternDetectionService,
    private readonly gaps: GapAnalysisService,
    private readonly contentStrategy: ContentStrategyService,
    private readonly actionEngine: StrategyEngineService,
  ) {}

  /**
   * Daily, after the sweeps that collect what this reads.
   *
   * 02:00 crawls competitor sites, 03:00 pulls their posts, 04:00 detects
   * changes. Analysis at 06:00 therefore always reads the same night's
   * collection rather than yesterday's.
   */
  @Cron('0 6 * * *')
  async runForAllProjects(): Promise<void> {
    if (process.env.COMPETITOR_CRON_ENABLED === 'false') return;

    const projects = await this.prisma.project.findMany({
      where: { competitors: { some: {} } },
      select: { id: true, name: true, organizationId: true },
    });
    if (projects.length === 0) return;

    this.logger.log(`Running competitor analysis for ${projects.length} project(s) with tracked competitors.`);

    for (const project of projects) {
      try {
        const run = await this.run(project.organizationId, project.id);
        const ran = run.stages.filter((stage) => stage.outcome === 'ran').length;
        this.logger.log(`[${project.name}] ${ran} of ${run.stages.length} analysis stages did work.`);
      } catch (err) {
        this.logger.error(`Analysis failed for project ${project.id}: ${err}`);
      }
    }
  }

  /**
   * Runs the chain once for one project, in order, and reports each stage.
   *
   * A stage that fails does not stop the run. The later stages read stored
   * output rather than the previous stage's return value, so a failed
   * classification leaves gap analysis working from whatever was already
   * classified — a smaller answer, not no answer. What it must never do is
   * present that smaller answer as a complete one, which is what the returned
   * stage list is for.
   */
  async run(organizationId: string, projectId: string): Promise<AnalysisRun> {
    const startedAt = new Date();
    const stages: AnalysisStage[] = [];

    stages.push(
      await this.stage('collect_competitor_content', () => this.collectCompetitorContent(organizationId, projectId)),
    );

    stages.push(
      await this.stage('own_social', async () => {
        const report = await this.ownSocial.syncProject(projectId);
        const imported = report.synced.reduce((sum, entry) => sum + entry.imported, 0);
        return {
          did: imported > 0,
          detail: imported > 0
            ? `Collected ${imported} of your own post(s) from ${report.synced.map((e) => e.handle).join(', ')}.`
            : report.skipped[0]?.reason || 'No posts were collected from your own accounts.',
        };
      }),
    );

    stages.push(
      await this.stage('classify_content', async () => {
        const result = await this.classification.classifyPending(projectId, organizationId);
        return {
          did: result.classified > 0,
          detail:
            result.classified > 0
              ? `Classified ${result.classified} competitor post(s).`
              : result.message || 'Nothing new to classify.',
        };
      }),
    );

    stages.push(
      await this.stage('detect_patterns', async () => {
        const result = await this.patterns.detectPatterns(projectId, organizationId);
        return {
          did: result.patternsDetected > 0,
          detail:
            result.patternsDetected > 0
              ? `Detected ${result.patternsDetected} creative pattern(s) across competitors.`
              : result.message || 'No patterns detected.',
        };
      }),
    );

    stages.push(
      await this.stage('analyze_gaps', async () => {
        const result = await this.gaps.analyzeGaps(projectId, organizationId);
        return {
          did: result.gapsGenerated > 0,
          detail:
            result.gapsGenerated > 0
              ? `Found ${result.gapsGenerated} content gap(s).`
              : result.message || 'No gaps found.',
        };
      }),
    );

    stages.push(
      await this.stage('plan_actions', async () => {
        const run = await this.actionEngine.generate(organizationId, projectId);
        return {
          did: true,
          detail: `Action plan run ${run.runId} is ${run.status.toLowerCase()}.`,
        };
      }),
    );

    stages.push(
      await this.stage('content_strategy', async () => {
        const strategy = await this.contentStrategy.generateStrategy(projectId, organizationId);
        return { did: true, detail: strategyDetail(strategy) };
      }),
    );

    return { projectId, startedAt: startedAt.toISOString(), stages };
  }

  /**
   * Pulls each tracked competitor's recent posts before anything reads them.
   *
   * This chain classified competitor content and never collected any. The
   * 03:00 sweep collects, this ran at 06:00, and nightly that ordering is
   * correct — but it left the two paths that matter most to a new customer
   * reading yesterday's collection or none at all: the on-demand run, and the
   * run that fires the moment a project's last competitor crawl lands. A
   * project set up this morning would classify nothing, detect no patterns and
   * find no gaps, and every stage would truthfully report that it had nothing
   * to work with.
   *
   * Re-collecting three hours after the sweep costs almost nothing: the import
   * deduplicates on content URL, so a second pass on an unchanged channel
   * writes no rows, and YouTube charges a handful of quota units per account
   * against a daily allowance in the thousands.
   */
  private async collectCompetitorContent(
    organizationId: string,
    projectId: string,
  ): Promise<{ did: boolean; detail: string }> {
    const platforms = configuredPlatforms();
    if (platforms.length === 0) {
      return {
        did: false,
        detail:
          'No ingestion credentials are set (YOUTUBE_API_KEY, or INSTAGRAM_ACCESS_TOKEN with ' +
          'INSTAGRAM_BUSINESS_ACCOUNT_ID), so no competitor posts can be collected automatically.',
      };
    }

    const accounts = await this.prisma.competitorAccount.findMany({
      where: { projectId, platform: { in: platforms }, isActive: true },
      select: { id: true, handle: true, platform: true, organizationId: true },
    });
    if (accounts.length === 0) {
      return {
        did: false,
        detail:
          `No ${platforms.join(' or ')} account is known for any tracked competitor. They are found ` +
          "automatically from the links published on each competitor's own website when it is crawled.",
      };
    }

    let imported = 0;
    const failed: string[] = [];

    for (const account of accounts) {
      try {
        const result = await this.scraper.syncAccountContent(
          account.organizationId || organizationId,
          projectId,
          account.id,
        );
        imported += result.imported;
      } catch (err) {
        // One channel that has been renamed, deleted or made private must not
        // stop the rest — and must not be reported as having nothing to say.
        failed.push(`${account.handle} (${err instanceof Error ? err.message : String(err)})`);
      }
    }

    const detail = [
      imported > 0
        ? `Collected ${imported} new competitor post(s) from ${accounts.length} account(s).`
        : `Checked ${accounts.length} competitor account(s); nothing new since the last run.`,
      failed.length ? `Could not read: ${failed.join('; ')}.` : null,
    ]
      .filter(Boolean)
      .join(' ');

    return { did: imported > 0, detail };
  }

  private async stage(
    name: string,
    run: () => Promise<{ did: boolean; detail: string }>,
  ): Promise<AnalysisStage> {
    try {
      const { did, detail } = await run();
      return { stage: name, outcome: did ? 'ran' : 'nothing_to_do', detail };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Analysis stage ${name} failed: ${detail}`);
      return { stage: name, outcome: 'failed', detail };
    }
  }
}

/**
 * Platforms this deployment can actually read, from what is configured.
 *
 * Each has its own credentials and either can be set alone, so the collector
 * takes whichever it can rather than refusing outright because one is missing.
 */
function configuredPlatforms(): string[] {
  const platforms: string[] = [];
  if (process.env.YOUTUBE_API_KEY) platforms.push('YOUTUBE');
  if (process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID) {
    platforms.push('INSTAGRAM');
  }
  return platforms;
}

/** What the content strategy stage produced, without guessing at its shape. */
function strategyDetail(strategy: unknown): string {
  const title = (strategy as { title?: unknown } | null)?.title;
  return typeof title === 'string' && title.trim()
    ? `Generated "${title}".`
    : 'Generated a content strategy.';
}
