import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiProvider, AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { extractAndParseJson } from '../ai-engine/utils/json-extractor.util';
import { crawlToShow } from '../crawler/crawl-selection';
import { SearchDemandService } from '../integrations/google/search-demand.service';
import { OPENED_PAGE } from '../crawler/page-outcome';
import { BusinessMarketingService } from './business-marketing.service';
import { CatalogBackfillService } from './catalog-backfill.service';
import {
  BusinessStrategyReport,
  buildPriceRows,
  buildStrategyPrompt,
  CatalogRow,
  normaliseStrategy,
  Positioning,
  rankPushedProducts,
  STRATEGY_SCHEMA,
  StrategyCompetitor,
  StrategyFacts,
  toStrategyProducts,
} from './business-strategy';

const CATALOG_FIELDS = { url: true, name: true, priceStatus: true, priceMinorUnits: true, currency: true, category: true } as const;
/** Enough links to rank a few hundred pages' worth of products, bounded so one huge site cannot exhaust memory. */
const LINKS_READ = 20_000;

/**
 * Business → Marketing Strategy. See business-strategy.ts for what is counted
 * and what is written.
 *
 * Generated on request and stored, so the tab opens on the last strategy at
 * once instead of waiting on the model every visit.
 */
@Injectable()
export class BusinessStrategyService {
  private readonly logger = new Logger(BusinessStrategyService.name);
  private readonly inFlight = new Map<string, Promise<BusinessStrategyReport>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MultiAiRouterService,
    private readonly marketing: BusinessMarketingService,
    private readonly backfill: CatalogBackfillService,
    @Optional() private readonly demand?: SearchDemandService,
  ) {}

  async latest(projectId: string): Promise<BusinessStrategyReport | null> {
    const row = await this.prisma.businessStrategySnapshot.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: { report: true },
    });
    return row ? (row.report as unknown as BusinessStrategyReport) : null;
  }

  /** One generation per project at a time; a second request joins the first. */
  generate(projectId: string, organizationId?: string): Promise<BusinessStrategyReport> {
    const running = this.inFlight.get(projectId);
    if (running) return running;
    const run = this.build(projectId, organizationId).finally(() => this.inFlight.delete(projectId));
    this.inFlight.set(projectId, run);
    return run;
  }

  private async build(projectId: string, organizationId?: string): Promise<BusinessStrategyReport> {
    await this.readMissingPositioning(projectId, organizationId);
    const facts = await this.gatherFacts(projectId);

    let strategy: BusinessStrategyReport['strategy'] = null;
    let strategyError: string | null = null;
    let model: string | null = null;
    if (!facts.business.domain) {
      strategyError = "Your website hasn't been read yet. Run the Website Audit first.";
    } else if (facts.competitors.length === 0) {
      strategyError = 'Add a competitor in Competitor Intelligence first; a strategy needs someone to compare against.';
    } else {
      try {
        const completion = await this.router.generate({
          prompt: buildStrategyPrompt(facts),
          systemInstruction:
            'You write practical marketing strategy for small businesses from the facts given. ' +
            'Never invent numbers, products or sales. Reply with valid JSON only.',
          task: AiTask.SEO_OPPORTUNITY_GENERATION,
          provider: AiProvider.SARVAM,
          // Shown as written by sarvam-105b; another vendor's text would carry the wrong name.
          allowFallback: false,
          jsonSchema: STRATEGY_SCHEMA,
          organizationId,
          projectId,
          maxTokens: 4000,
        });
        if (completion.refused || !completion.text.trim()) throw new Error('Sarvam returned no strategy');
        strategy = normaliseStrategy(extractAndParseJson<Record<string, unknown>>(completion.text), facts);
        model = completion.model ?? null;
      } catch (err) {
        this.logger.warn(`[${projectId}] marketing strategy failed: ${(err as Error).message}`);
        strategyError = `The strategy could not be written just now (${(err as Error).message}). The facts below are still current; try again in a minute.`.slice(0, 400);
      }
    }

    const report: BusinessStrategyReport = { generatedAt: new Date().toISOString(), facts, strategy, strategyError, model };
    try {
      await this.prisma.businessStrategySnapshot.create({ data: { projectId, report: report as any } });
    } catch (err) {
      this.logger.warn(`[${projectId}] could not store the marketing strategy: ${(err as Error).message}`);
    }
    return report;
  }

  /**
   * Reads positioning for any site that has none yet, so the strategy is not
   * written against "nothing read" and the customer is never asked to press
   * a "Re-read" button per competitor first. Failures are left to show as
   * "not read" rather than stopping the strategy.
   */
  private async readMissingPositioning(projectId: string, organizationId?: string): Promise<void> {
    const orgId =
      organizationId ?? (await this.prisma.project.findUnique({ where: { id: projectId }, select: { organizationId: true } }))?.organizationId;
    if (!orgId) return;

    const [ownCount, competitors] = await Promise.all([
      this.prisma.marketingSignal.count({ where: { projectId, competitorId: null } }),
      this.prisma.competitorDomain.findMany({ where: { projectId, websiteId: { not: null } }, select: { id: true } }),
    ]);
    const reads: Promise<unknown>[] = [];
    if (ownCount === 0) reads.push(this.marketing.generateForOwnSite(orgId, projectId));
    for (const c of competitors) {
      const has = await this.prisma.marketingSignal.count({ where: { projectId, competitorId: c.id } });
      if (has === 0) reads.push(this.marketing.generateForCompetitor(orgId, projectId, c.id));
    }
    const results = await Promise.allSettled(reads);
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed) this.logger.warn(`[${projectId}] ${failed} of ${results.length} positioning reads failed; continuing without them.`);
  }

  async gatherFacts(projectId: string): Promise<StrategyFacts> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true, organizationId: true, websites: { select: { domain: true }, take: 1 } },
    });
    const [mine, competitors, signals, search] = await Promise.all([
      this.prisma.catalogProduct.findMany({ where: { projectId, competitorId: null }, select: CATALOG_FIELDS, orderBy: { updatedAt: 'desc' } }),
      this.prisma.competitorDomain.findMany({
        where: { projectId },
        select: { id: true, domain: true, label: true, name: true, websiteId: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.marketingSignal.findMany({ where: { projectId }, select: { competitorId: true, kind: true, text: true } }),
      this.demand ? this.demand.forProject(projectId) : Promise.resolve(undefined),
    ]);

    const positioningOf = (competitorId: string | null): Positioning | null => {
      const rows = signals.filter((s) => s.competitorId === competitorId);
      if (rows.length === 0) return null;
      return {
        valueProps: rows.filter((r) => r.kind === 'VALUE_PROP').map((r) => r.text),
        promos: rows.filter((r) => r.kind === 'PROMO').map((r) => r.text),
        tone: rows.find((r) => r.kind === 'TONE')?.text ?? null,
      };
    };

    const rivals: Array<StrategyCompetitor & { catalog: CatalogRow[] }> = [];
    for (const c of competitors) {
      const name = c.label ?? c.name ?? c.domain;
      const catalog = await this.prisma.catalogProduct.findMany({
        where: { projectId, competitorId: c.id },
        select: CATALOG_FIELDS,
        orderBy: { updatedAt: 'desc' },
      });
      const crawlId = c.websiteId ? await this.readCrawl(c.websiteId) : null;
      if (crawlId && project) {
        // Products the crawl stored pages for but nobody catalogued yet are
        // read in the background; the next strategy includes them.
        this.backfill.ensure({ projectId, competitorId: c.id, organizationId: project.organizationId }, crawlId);
      }

      const [pages, links, pagesRead] = crawlId
        ? await Promise.all([
            this.prisma.page.findMany({ where: { crawlJobId: crawlId, ...OPENED_PAGE }, select: { url: true, title: true, h1: true, pageType: true }, take: 600 }),
            this.prisma.link.findMany({
              where: { linkType: 'INTERNAL', sourcePage: { crawlJobId: crawlId, ...OPENED_PAGE } },
              select: { targetUrl: true, anchorText: true, sourcePage: { select: { url: true, title: true, pageType: true } } },
              take: LINKS_READ,
            }),
            this.prisma.page.count({ where: { crawlJobId: crawlId, ...OPENED_PAGE } }),
          ])
        : [[], [], 0];

      rivals.push({
        id: c.id,
        name,
        domain: c.domain,
        pagesRead,
        productCount: catalog.length,
        pricedCount: catalog.filter((p) => p.priceStatus === 'FOUND').length,
        products: toStrategyProducts(catalog),
        pushed: rankPushedProducts({
          catalog,
          pages,
          links: links.map((l) => ({
            targetUrl: l.targetUrl,
            anchorText: l.anchorText,
            sourceUrl: l.sourcePage.url,
            sourceTitle: l.sourcePage.title,
            sourceType: l.sourcePage.pageType,
          })),
        }),
        positioning: positioningOf(c.id),
        catalog,
      });
    }

    return {
      business: { name: project?.name ?? null, domain: project?.websites[0]?.domain ?? null },
      you: {
        productCount: mine.length,
        pricedCount: mine.filter((p) => p.priceStatus === 'FOUND').length,
        products: toStrategyProducts(mine),
        positioning: positioningOf(null),
      },
      competitors: rivals.map(({ catalog: _catalog, ...rest }) => rest),
      prices: buildPriceRows(
        mine,
        rivals.map((r) => ({ name: r.name, products: r.catalog })),
      ),
      ...(search ? { search } : {}),
    };
  }

  /** The crawl a competitor's figures come from: the newest that read anything. */
  private async readCrawl(websiteId: string): Promise<string | null> {
    const { lastUsable } = crawlToShow(
      await this.prisma.crawlJob.findMany({
        where: { websiteId },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, status: true, finishedAt: true, pagesCrawled: true },
      }),
    );
    return lastUsable?.id ?? null;
  }
}
