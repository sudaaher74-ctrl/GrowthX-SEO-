import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { CrawlerService } from '../crawler/crawler.service';
import { MarketResearchService } from '../market-research/market-research.service';
import { CompetitorCrawlService } from '../content-intelligence/competitor-crawl.service';
import { COMPETITOR_STATUS } from '../content-intelligence/competitor-status';
import { chooseOwnProfiles, CandidateProfile, ChosenProfile } from './own-social-accounts';
import { AnalysisPipelineService } from './analysis-pipeline.service';

/** How many identified competitors are tracked without anyone being asked. */
const AUTO_TRACK_LIMIT = 5;

/**
 * What a project's onboarding does after its website has been crawled.
 *
 * The steps all existed and none of them were connected. Detecting the
 * business, identifying its competitors, crawling those competitors and
 * reading everyone's social profiles were four separate buttons on three
 * separate pages, each waiting for someone to press it, and a customer who
 * added their website and watched the crawl finish was shown a set of empty
 * tabs with no indication that anything else was expected of them.
 *
 * This service is the chain between them. A finished crawl of a customer's own
 * site detects what they sell, identifies who they compete with, and starts
 * those competitors' crawls; each of those crawls finishing in turn records
 * that competitor's social accounts. Nothing here is new analysis — every step
 * calls the service that already implemented it.
 */
@Injectable()
export class DiscoveryPipelineService implements OnModuleInit {
  private readonly logger = new Logger(DiscoveryPipelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crawler: CrawlerService,
    private readonly research: MarketResearchService,
    private readonly competitorCrawl: CompetitorCrawlService,
    private readonly analysis: AnalysisPipelineService,
  ) {}

  onModuleInit(): void {
    this.crawler.onCrawlCompleted((jobId, websiteId) => this.handleCrawlCompleted(jobId, websiteId));
  }

  /**
   * Runs whichever half of the pipeline the finished crawl belongs to.
   *
   * A crawled site is the customer's own when it carries a projectId, and a
   * competitor's when a CompetitorDomain points at it. Both are possible at
   * once — one agency's client is another's competitor — so this asks both
   * questions rather than choosing between them.
   */
  async handleCrawlCompleted(jobId: string, websiteId: string): Promise<void> {
    const website = await this.prisma.website.findUnique({
      where: { id: websiteId },
      select: {
        domain: true,
        project: { select: { id: true, organizationId: true, competitorsIdentifiedAt: true } },
        competitors: {
          select: { id: true, domain: true, projectId: true, name: true, instagramHandle: true, youtubeUrl: true },
        },
      },
    });
    if (!website) return;

    const job = await this.prisma.crawlJob.findUnique({
      where: { id: jobId },
      select: { pagesCrawled: true },
    });
    const pagesCrawled = job?.pagesCrawled ?? 0;

    if (website.project) {
      await this.runForCustomerSite(jobId, website.domain, website.project, pagesCrawled);
    }

    for (const competitor of website.competitors) {
      await this.runForCompetitorSite(jobId, competitor, pagesCrawled);
    }
  }

  /**
   * The customer's own crawl: read the business, then find who it competes with.
   *
   * Each step is contained on its own. Competitor identification calls a model
   * and a search provider and can fail for reasons that say nothing about the
   * social accounts sitting in the crawl already, so one failing must not cost
   * the customer the others.
   */
  private async runForCustomerSite(
    crawlJobId: string,
    domain: string,
    project: { id: string; organizationId: string; competitorsIdentifiedAt: Date | null },
    pagesCrawled: number,
  ): Promise<void> {
    if (pagesCrawled === 0) {
      this.logger.warn(
        `Discovery skipped for ${domain}: the crawl finished with no pages, so there is nothing to read a business from.`,
      );
      return;
    }

    await this.step(`social accounts for ${domain}`, () =>
      this.recordOwnSocialAccounts(crawlJobId, project.id, project.organizationId),
    );

    await this.step(`business detection for ${domain}`, async () => {
      // Forced: the crawl just re-read every page of this site, so a profile
      // cached from an earlier version of it is the stale answer, not the cheap
      // one.
      const profile = await this.research.getBusinessProfile(project.organizationId, project.id, {
        refresh: true,
      });
      this.logger.log(
        profile
          ? `Detected ${domain} as "${profile.industry}" (${profile.confidence} confidence) from its own site.`
          : `Business detection is not configured; ${domain} keeps whatever profile it had.`,
      );
    });

    if (project.competitorsIdentifiedAt) return;

    await this.step(`competitor identification for ${domain}`, () =>
      this.identifyCompetitors(project.id, project.organizationId, domain),
    );
  }

  /**
   * Identifies competitors once, off the first crawl, and tracks the top few.
   *
   * The marker is written whether or not anything was found. Identification
   * that legitimately returns nothing — a business with no verifiable online
   * competitors — must not re-run on every subsequent crawl, and a customer who
   * curates the list afterwards must not have their deletions undone by the
   * next monthly crawl.
   */
  private async identifyCompetitors(
    projectId: string,
    organizationId: string,
    domain: string,
  ): Promise<void> {
    const alreadyTracked = await this.prisma.competitorDomain.count({ where: { projectId } });
    if (alreadyTracked > 0) {
      // Someone added competitors by hand before the crawl finished. Their
      // list, not ours.
      await this.markIdentified(projectId);
      return;
    }

    const result = await this.research.autoIdentifyCompetitors(organizationId, projectId, {});
    const verified = (result.topCompetitors || []).filter((c) => c.verified !== false);

    if (verified.length === 0) {
      await this.markIdentified(projectId);
      this.logger.warn(
        `No competitor for ${domain} survived verification. ${(result.notes || []).join(' ') || 'Nothing was tracked.'}`,
      );
      return;
    }

    // addSelectedCompetitors saves these and starts each one's first crawl,
    // which is what brings the second half of this pipeline round again.
    const added = await this.research.addSelectedCompetitors(
      organizationId,
      projectId,
      verified.slice(0, AUTO_TRACK_LIMIT).map((competitor) => ({
        domain: competitor.domain,
        name: competitor.name,
        industry: competitor.industry,
        description: competitor.description,
        location: competitor.location,
        confidenceScore: competitor.overlapScore,
      })),
    );

    await this.markIdentified(projectId);
    this.logger.log(
      `Identified and started tracking ${added.count} competitor(s) for ${domain}; their crawls are underway.`,
    );
  }

  private markIdentified(projectId: string): Promise<unknown> {
    return this.prisma.project.update({
      where: { id: projectId },
      data: { competitorsIdentifiedAt: new Date() },
    });
  }

  /**
   * A competitor's crawl finishing: record that it happened, and what it found.
   *
   * Nothing moved a competitor past ANALYZING. `startCrawl` set it and no code
   * anywhere set anything else, so every competitor the product has ever
   * tracked sat in a permanent "analysing" state and `lastAnalyzedAt` stayed
   * null forever — which is what made the data-feed diagnostics report that no
   * competitor had ever been analysed on installations where the crawls had in
   * fact all succeeded.
   */
  private async runForCompetitorSite(
    crawlJobId: string,
    competitor: {
      id: string;
      domain: string;
      projectId: string;
      name: string | null;
      instagramHandle: string | null;
      youtubeUrl: string | null;
    },
    pagesCrawled: number,
  ): Promise<void> {
    if (pagesCrawled === 0) {
      // A crawl that read nothing has analysed nothing, and saying otherwise
      // would put a timestamp on an analysis that never happened.
      await this.prisma.competitorDomain.update({
        where: { id: competitor.id },
        data: { status: COMPETITOR_STATUS.FAILED },
      });
      this.logger.warn(`Crawl of competitor ${competitor.domain} returned no pages; marked FAILED.`);
      return;
    }

    await this.prisma.competitorDomain.update({
      where: { id: competitor.id },
      data: { status: COMPETITOR_STATUS.ANALYZED, lastAnalyzedAt: new Date() },
    });

    await this.step(`social accounts for competitor ${competitor.domain}`, () =>
      this.recordCompetitorSocialAccounts(crawlJobId, competitor),
    );

    await this.step(`analysis check for ${competitor.domain}`, () =>
      this.analyseWhenAllCompetitorsAreIn(competitor.projectId),
    );
  }

  /**
   * Runs the analysis as soon as the last competitor's first crawl lands.
   *
   * Otherwise a customer who added competitors in the morning would see the
   * comparison fill in and the strategy stay empty until the 06:00 sweep the
   * following day — the point at which the product stops describing rivals and
   * starts saying what to do about them.
   *
   * Only on the first pass. Once a project has an action plan, the nightly
   * sweep keeps it current, and re-running the whole chain on every recurring
   * competitor crawl would spend a model call per competitor per night for an
   * answer that had not changed.
   */
  private async analyseWhenAllCompetitorsAreIn(projectId: string): Promise<void> {
    const [waiting, alreadyPlanned, project] = await Promise.all([
      this.prisma.competitorDomain.count({ where: { projectId, lastAnalyzedAt: null } }),
      this.prisma.strategyRun.count({ where: { projectId } }),
      this.prisma.project.findUnique({ where: { id: projectId }, select: { organizationId: true } }),
    ]);

    if (waiting > 0 || alreadyPlanned > 0 || !project) return;

    this.logger.log(`Every tracked competitor for project ${projectId} has been crawled; running the analysis.`);
    const run = await this.analysis.run(project.organizationId, projectId);
    const ran = run.stages.filter((stage) => stage.outcome === 'ran').length;
    this.logger.log(`First analysis for project ${projectId}: ${ran} of ${run.stages.length} stages did work.`);
  }

  /** The customer's own accounts, as published on their own site. */
  private async recordOwnSocialAccounts(
    crawlJobId: string,
    projectId: string,
    organizationId: string,
  ): Promise<void> {
    const { chosen, ambiguous } = chooseOwnProfiles(await this.candidates(crawlJobId));
    const stored: string[] = [];

    for (const profile of chosen) {
      const existing = await this.prisma.socialAccount.findUnique({
        where: { projectId_platform: { projectId, platform: profile.platform } },
        select: { id: true, status: true, discoverySource: true },
      });

      // A connected account was authorised by the customer and its handle came
      // from the platform itself. A link read off a page does not get to
      // overwrite that, and neither does it get to overwrite a connection that
      // has merely expired — that row is still about their OAuth account.
      if (existing && existing.discoverySource !== 'WEBSITE_CRAWL') {
        this.logger.log(
          `${profile.platform} ${profile.handle} is published on the site, but the project already has a connected ${profile.platform} account; the connected one stands.`,
        );
        continue;
      }

      await this.prisma.socialAccount.upsert({
        where: { projectId_platform: { projectId, platform: profile.platform } },
        update: {
          handle: profile.handle,
          profileUrl: profile.profileUrl,
          discoveredAt: new Date(),
        },
        create: {
          organizationId,
          projectId,
          platform: profile.platform,
          handle: profile.handle,
          profileUrl: profile.profileUrl,
          discoverySource: 'WEBSITE_CRAWL',
          discoveredAt: new Date(),
          // Left DISCONNECTED on purpose: we found where their account is, not
          // permission to post to it.
          status: 'DISCONNECTED',
        },
      });
      stored.push(`${profile.platform} ${profile.handle}`);
    }

    if (stored.length) {
      this.logger.log(`Read ${stored.length} social account(s) off the customer's own site: ${stored.join(', ')}.`);
    }
    for (const platform of ambiguous) {
      this.logger.log(
        `The site links ${platform.handles.length} ${platform.platform} profiles equally often (${platform.handles.join(', ')}); none was recorded as theirs.`,
      );
    }
  }

  /** A competitor's accounts, which is what the content sweeps read from. */
  private async recordCompetitorSocialAccounts(
    crawlJobId: string,
    competitor: {
      id: string;
      domain: string;
      projectId: string;
      name: string | null;
      instagramHandle: string | null;
      youtubeUrl: string | null;
    },
  ): Promise<void> {
    const { chosen } = chooseOwnProfiles(await this.candidates(crawlJobId));
    if (chosen.length === 0) return;

    const project = await this.prisma.project.findUnique({
      where: { id: competitor.projectId },
      select: { organizationId: true },
    });
    if (!project) return;

    const displayName = competitor.name || competitor.domain;

    for (const profile of chosen) {
      await this.prisma.competitorAccount.upsert({
        where: {
          projectId_platform_handle: {
            projectId: competitor.projectId,
            platform: profile.platform,
            handle: profile.handle,
          },
        },
        update: {
          competitorId: competitor.id,
          profileUrl: profile.profileUrl,
          matchConfidence: profile.confidence,
          isActive: true,
        },
        create: {
          organizationId: project.organizationId,
          projectId: competitor.projectId,
          competitorId: competitor.id,
          platform: profile.platform,
          handle: profile.handle,
          profileUrl: profile.profileUrl,
          displayName,
          website: competitor.domain,
          discoverySource: 'WEBSITE_CRAWL',
          verificationStatus: 'VERIFIED',
          matchConfidence: profile.confidence,
          isActive: true,
        },
      });
    }

    // The daily content sweep reads these two columns rather than the account
    // rows, so a discovered handle that is not copied here is collected by
    // nothing. Only filled when empty: an operator who typed a handle in the
    // setup form meant that one.
    await this.fillCompetitorHandles(competitor, chosen);

    this.logger.log(
      `Read ${chosen.length} social account(s) off ${competitor.domain}: ${chosen
        .map((p) => `${p.platform} ${p.handle}`)
        .join(', ')}.`,
    );
  }

  private async fillCompetitorHandles(
    competitor: { id: string; instagramHandle: string | null; youtubeUrl: string | null },
    chosen: ChosenProfile[],
  ): Promise<void> {
    const instagram = chosen.find((p) => p.platform === 'INSTAGRAM');
    const youtube = chosen.find((p) => p.platform === 'YOUTUBE');

    const data: { instagramHandle?: string; youtubeUrl?: string } = {};
    if (!competitor.instagramHandle && instagram) data.instagramHandle = instagram.handle;
    if (!competitor.youtubeUrl && youtube) data.youtubeUrl = youtube.profileUrl;
    if (Object.keys(data).length === 0) return;

    await this.prisma.competitorDomain.update({ where: { id: competitor.id }, data });
  }

  /** What this crawl found published, which is what its page counts describe. */
  private async candidates(crawlJobId: string): Promise<CandidateProfile[]> {
    return this.prisma.siteSocialLink.findMany({
      where: { crawlJobId },
      select: { platform: true, handle: true, profileUrl: true, pageCount: true },
    });
  }

  /**
   * Starts the first crawl of any competitor that has never had one.
   *
   * `addSelectedCompetitors` starts a crawl for the competitors it saves, but a
   * competitor typed into the setup form by hand had nothing start one, and the
   * only recurring sweep runs at 02:00 UTC — so an operator who added a
   * competitor at nine in the morning saw an empty comparison until the next
   * night. This closes that window without the setup form having to know how
   * crawling works, which is what keeps the action engine free of collector
   * imports.
   */
  @Cron('*/10 * * * *')
  async crawlUncrawledCompetitors(): Promise<void> {
    if (process.env.COMPETITOR_CRON_ENABLED === 'false') return;

    const waiting = await this.prisma.competitorDomain.findMany({
      where: { status: COMPETITOR_STATUS.PENDING, lastAnalyzedAt: null },
      select: { id: true, domain: true, projectId: true, project: { select: { organizationId: true } } },
      take: 25,
    });
    if (waiting.length === 0) return;

    let started = 0;
    for (const competitor of waiting) {
      // Claim it before crawling it. The API process and the worker process
      // both boot the whole module tree, so this cron body runs twice on every
      // tick, and without a claim both copies would start a crawl of the same
      // competitor and spend a stranger's bandwidth twice over. Moving the row
      // off PENDING is the same transition `startCrawl` makes; doing it here
      // makes it the thing that decides who crawls.
      const claimed = await this.prisma.competitorDomain.updateMany({
        where: { id: competitor.id, status: COMPETITOR_STATUS.PENDING },
        data: { status: COMPETITOR_STATUS.ANALYZING },
      });
      if (claimed.count === 0) continue;

      try {
        await this.competitorCrawl.startCrawl(
          competitor.project.organizationId,
          competitor.projectId,
          competitor.id,
        );
        started++;
      } catch (err) {
        // Put it back so the next sweep retries, rather than leaving it
        // claimed by a crawl that never started.
        await this.prisma.competitorDomain.updateMany({
          where: { id: competitor.id, status: COMPETITOR_STATUS.ANALYZING },
          data: { status: COMPETITOR_STATUS.PENDING },
        });
        this.logger.warn(`Could not start the first crawl for ${competitor.domain}: ${err}`);
      }
    }

    if (started > 0) {
      this.logger.log(`Started a first crawl for ${started} newly added competitor(s).`);
    }
  }

  /** Runs one step, logging a failure instead of ending the pipeline. */
  private async step(what: string, run: () => Promise<unknown>): Promise<void> {
    try {
      await run();
    } catch (err) {
      this.logger.error(`Discovery step failed — ${what}: ${err}`);
    }
  }
}
