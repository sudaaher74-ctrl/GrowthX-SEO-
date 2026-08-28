import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CrawlerService } from '../crawler/crawler.service';
import { PageType } from '../crawler/page-type';
import { canonicalUrl } from '../crawler/canonical-url';
import { closestMatch, distinctiveTokens, MATCH_THRESHOLD, siteBoilerplate } from './topic-match';

/**
 * Crawls a competitor's public website so their coverage can be compared with
 * the customer's.
 *
 * This is the same crawler that runs on the customer's own site, pointed at a
 * different domain with the politeness turned up. Nothing here scrapes
 * anything private, logs into anything, or copies a competitor's content: it
 * reads the pages their own robots.txt says a crawler may read, records what
 * kind of page each one is, and counts them. "They publish 24 service pages,
 * you publish 6" is a fact about two public sitemaps.
 *
 * The crawl is bounded on purpose. A competitor is a third party who never
 * asked to be crawled, so the job carries a page ceiling, a shallow depth and
 * a delay at least as slow as our own crawls — see the constants below.
 */
@Injectable()
export class CompetitorCrawlService {
  private readonly logger = new Logger(CompetitorCrawlService.name);

  /**
   * Enough to cover the service, product and location pages of a typical
   * business site, which is what a coverage gap is measured across, without
   * walking the whole of a large publisher's archive. A crawl that hits the
   * ceiling is reported as capped rather than as complete, so a gap count is
   * never quietly computed from a truncated site.
   */
  static readonly PAGE_LIMIT = 300;
  /** Their site, their bandwidth: half the rate we would use on our own. */
  static readonly RATE_LIMIT_DELAY_MS = 1000;
  static readonly MAX_CONCURRENCY = 2;
  static readonly MAX_DEPTH = 4;

  constructor(
    private readonly prisma: PrismaService,
    private readonly crawler: CrawlerService,
  ) {}

  /**
   * Reduces whatever the customer typed to a bare hostname.
   *
   * "https://www.acme.com/about?x=1" and "acme.com" are the same competitor,
   * and storing them as two would crawl that site twice and report two sets of
   * numbers for one company.
   */
  static normalizeDomain(input: string): string {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) throw new BadRequestException('A competitor domain is required.');

    let host: string;
    try {
      host = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`).hostname;
    } catch {
      throw new BadRequestException(`"${input}" is not a valid domain.`);
    }

    const bare = host.replace(/^www\./, '');
    // A hostname with no dot is a local name, not a site we can crawl. Saying
    // so beats accepting it and producing a crawl that fails with a DNS error.
    if (!bare.includes('.')) throw new BadRequestException(`"${input}" is not a valid domain.`);
    return bare;
  }

  /**
   * Starts a crawl of the competitor's site and returns the job id.
   *
   * The Website row is found by domain rather than created per competitor:
   * two projects tracking the same company should read one crawl, not send two
   * crawlers at a stranger's server. Its projectId is deliberately left alone
   * — null for a site we only know as a competitor. Every query that reads a
   * project's own pages filters on `website.projectId`, so a null one cannot
   * leak into the customer's own analysis; setting it would put a
   * competitor's pages into the customer's content strategy as if they had
   * written them.
   */
  async startCrawl(organizationId: string, projectId: string, competitorId: string) {
    const competitor = await this.prisma.competitorDomain.findFirst({
      where: { id: competitorId, projectId, project: { organizationId } },
    });
    if (!competitor) throw new NotFoundException('Competitor not found for this project.');

    const domain = CompetitorCrawlService.normalizeDomain(competitor.domain);

    const website = await this.prisma.website.upsert({
      where: { domain },
      update: {},
      create: {
        domain,
        url: `https://${domain}`,
        rateLimitDelayMs: CompetitorCrawlService.RATE_LIMIT_DELAY_MS,
        maxConcurrency: CompetitorCrawlService.MAX_CONCURRENCY,
        maxDepth: CompetitorCrawlService.MAX_DEPTH,
        // Left off any recurring schedule. A competitor's site is re-crawled
        // when someone asks for it, not on a timer we chose for them.
        crawlFrequency: 'OFF',
      },
    });

    const jobId = await this.crawler.startCrawlJob(website.id, {
      maxConcurrency: CompetitorCrawlService.MAX_CONCURRENCY,
      maxDepth: CompetitorCrawlService.MAX_DEPTH,
      pageLimit: CompetitorCrawlService.PAGE_LIMIT,
      rateLimitDelayMs: CompetitorCrawlService.RATE_LIMIT_DELAY_MS,
    });

    await this.prisma.competitorDomain.update({
      where: { id: competitor.id },
      data: { websiteId: website.id, status: 'ANALYZING' },
    });

    this.logger.log(`Started competitor crawl ${jobId} for ${domain} (competitor ${competitor.id}).`);
    return { jobId, websiteId: website.id, domain, pageLimit: CompetitorCrawlService.PAGE_LIMIT };
  }

  /**
   * What the last completed crawl of this competitor found, by page kind.
   *
   * Returns null when there is nothing crawled yet, rather than an object of
   * zeroes: "we have not looked" and "they have no service pages" are
   * different answers, and a zero would be read as the second.
   */
  async getCoverage(organizationId: string, projectId: string, competitorId: string) {
    const competitor = await this.prisma.competitorDomain.findFirst({
      where: { id: competitorId, projectId, project: { organizationId } },
      select: { id: true, domain: true, websiteId: true },
    });
    if (!competitor) throw new NotFoundException('Competitor not found for this project.');
    if (!competitor.websiteId) return null;

    const job = await this.prisma.crawlJob.findFirst({
      where: { websiteId: competitor.websiteId, status: 'COMPLETED' },
      orderBy: { finishedAt: 'desc' },
      select: { id: true, finishedAt: true, pagesCrawled: true, pageLimit: true },
    });
    if (!job) return null;

    const byType = (await this.countByType(job.id)) as Record<PageType, number>;
    const totalPages = Object.values(byType).reduce((sum, n) => sum + n, 0);

    return {
      competitorId: competitor.id,
      domain: competitor.domain,
      crawlJobId: job.id,
      crawledAt: job.finishedAt,
      // The sum of what is shown below it, so the header and the rows agree.
      // Deliberately not job.pagesCrawled, which counts every fetch including
      // redirects, errors and duplicate spellings of one page.
      totalPages,
      // True when the crawl stopped at its ceiling rather than at the end of
      // the site. Measured against pagesCrawled, since the ceiling limits
      // fetches rather than the pages that survive to be counted. Counts from
      // a capped crawl are a floor, not a total, and the client has to be able
      // to say so.
      capped: job.pageLimit != null && job.pagesCrawled >= job.pageLimit,
      byType,
      // How many of their pages the crawler could not assign a kind to.
      //
      // This is what makes the by-kind table honest. Page kind comes from the
      // URL, and a site with flat URLs gives it nothing to read: the real
      // competitor tracked here publishes /guava-pulp/ and /mango-pulp/ at the
      // root, so eight product pages type as OTHER. Against a customer whose
      // own URLs happen to be /products/..., the table then reads "products:
      // you 32, them 1" — a lead that is an artefact of their URL scheme, not
      // a fact about their catalogue. The client shows this count so the
      // comparison can be read with the doubt it deserves.
      untyped: byType.OTHER ?? 0,
    };
  }

  /**
   * Pages of each kind in one crawl, counting a page once however it was
   * linked.
   *
   * Counting rows would overcount. A site links itself both with and without
   * `www.`, and crawls recorded before the crawler deduplicated those stored
   * the same page under each spelling — on the site crawled here, 35 pages as
   * 44 rows. Two sites link themselves each way in different proportions, so
   * the inflation differs per site and the gap between two inflated counts is
   * wrong by an amount nobody can predict.
   *
   * The host normalisation below deliberately mirrors `visitKey` in
   * CrawlerService, which is what prevents the duplicates being written in the
   * first place. It is kept for crawls recorded before that existed; for
   * anything crawled since, it finds nothing to collapse and costs one regex
   * per row.
   */
  private async countByType(crawlJobId: string): Promise<Record<string, number>> {
    const rows = await this.prisma.$queryRaw<{ pageType: string; n: bigint }[]>`
      SELECT "pageType",
             count(DISTINCT regexp_replace(url, '^https?://(www\.)?', '')) AS n
      FROM "Page"
      WHERE "crawlJobId" = ${crawlJobId}
        AND "statusCode" >= 200 AND "statusCode" < 300
      GROUP BY "pageType"
    `;
    return Object.fromEntries(rows.map((row) => [row.pageType, Number(row.n)]));
  }

  /**
   * The customer's own page coverage, from their latest completed crawl.
   *
   * Scoped through `website.projectId`, which is exactly what a competitor's
   * site does not have — so a competitor's pages can never be counted here.
   */
  private async getOwnCoverage(projectId: string) {
    const job = await this.prisma.crawlJob.findFirst({
      where: { status: 'COMPLETED', website: { projectId } },
      orderBy: { finishedAt: 'desc' },
      select: { id: true, finishedAt: true, pagesCrawled: true },
    });
    if (!job) return null;

    const byType = await this.countByType(job.id);

    return {
      crawlJobId: job.id,
      crawledAt: job.finishedAt,
      totalPages: Object.values(byType).reduce((sum, n) => sum + n, 0),
      byType,
    };
  }

  /**
   * Both sides of the coverage comparison, by page kind.
   *
   * Returns which side is ahead per kind rather than only the counts, since
   * that is the question being asked, and returns nulls where a side has not
   * been crawled instead of substituting zero. A missing crawl rendered as
   * zero reads as "they publish nothing", which is the opposite of "we have
   * not looked" and would send someone off writing pages they already have.
   *
   * LEGAL is excluded: every site has a privacy policy, and a difference of
   * one in that count is not an opportunity.
   */
  async getComparison(organizationId: string, projectId: string, competitorId: string) {
    const [theirs, ours] = await Promise.all([
      this.getCoverage(organizationId, projectId, competitorId),
      this.getOwnCoverage(projectId),
    ]);

    const COMPARED: PageType[] = [
      'SERVICE',
      'PRODUCT',
      'LOCATION',
      'BLOG',
      'CASE_STUDY',
      'FAQ',
      'ABOUT',
      'CONTACT',
    ];

    const rows = COMPARED.map((pageType) => {
      const mine = ours ? (ours.byType[pageType] ?? 0) : null;
      const theirCount = theirs ? (theirs.byType[pageType] ?? 0) : null;
      return {
        pageType,
        ours: mine,
        theirs: theirCount,
        // Null, not zero, when either side is uncrawled: a gap cannot be
        // computed from a number nobody has measured.
        gap: mine === null || theirCount === null ? null : theirCount - mine,
      };
    });

    return {
      ours,
      theirs,
      // Only where they genuinely lead, largest first. This is the list the
      // dashboard turns into "they publish 24 service pages, you publish 6".
      behindOn: rows.filter((r) => (r.gap ?? 0) > 0).sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0)),
      rows,
    };
  }

  /**
   * The competitor's pages with no close counterpart on the customer's site.
   *
   * This is the actionable form of the coverage gap. "They have 18 more
   * service pages" is a number; this is the list, and every row carries the
   * closest thing found on the customer's own site so the reader can see for
   * themselves whether it is really missing.
   *
   * Deliberately never phrased as a certainty. Matching is done on words in
   * the URL and title, which is right often enough to be worth showing and
   * wrong often enough that claiming "you are missing this page" would be
   * dishonest — the customer may well cover the topic in wording this cannot
   * see. The field is named `closestOwnPage` and carries its score for exactly
   * that reason.
   *
   * LEGAL and OTHER are excluded. Nobody needs a privacy policy suggested to
   * them, and OTHER is by definition a page whose subject the crawler could
   * not determine, so it cannot be described as an opportunity.
   */
  async getOpportunities(
    organizationId: string,
    projectId: string,
    competitorId: string,
    options: { pageType?: string; limit?: number } = {},
  ) {
    const competitor = await this.prisma.competitorDomain.findFirst({
      where: { id: competitorId, projectId, project: { organizationId } },
      select: { websiteId: true, domain: true },
    });
    if (!competitor) throw new NotFoundException('Competitor not found for this project.');
    if (!competitor.websiteId) return null;

    const [theirJob, ourJob] = await Promise.all([
      this.prisma.crawlJob.findFirst({
        where: { websiteId: competitor.websiteId, status: 'COMPLETED' },
        orderBy: { finishedAt: 'desc' },
        select: { id: true },
      }),
      this.prisma.crawlJob.findFirst({
        where: { status: 'COMPLETED', website: { projectId } },
        orderBy: { finishedAt: 'desc' },
        select: { id: true },
      }),
    ]);
    // Both sides are required. Against an uncrawled own site every page they
    // have would be listed as an opportunity, which is not a finding about
    // their site at all — it is a report that we have not looked at ours.
    if (!theirJob || !ourJob) return null;

    const [theirPages, ourPages] = await Promise.all([
      this.pagesFor(theirJob.id),
      this.pagesFor(ourJob.id),
    ]);

    const ourList = [...ourPages.values()];
    const theirList = [...theirPages.values()];
    // Structural pages, not content opportunities. Every site has a home page,
    // an about page and a contact page; suggesting the customer write one is
    // noise that makes the real rows look less credible, and LEGAL is here for
    // the same reason.
    //
    // OTHER is deliberately NOT skipped, though an earlier version did skip it
    // on the reasoning that a page whose kind is unknown cannot be described.
    // That conflated two different things. OTHER means the crawler could not
    // work out the page's *kind*, not its *subject*: the real competitor
    // publishes /guava-pulp/ and /papaya-pulp/ as flat URLs with no structural
    // word in them, so they type as OTHER while their subject is perfectly
    // clear. Skipping them dropped the eight product pages that are the single
    // most useful thing on that competitor's site. Pages with no readable
    // subject are excluded a few lines down, which is the check that was
    // actually wanted.
    const skipped = new Set(['LEGAL', 'HOME', 'ABOUT', 'CONTACT']);

    // Each site's own name and tagline, dropped before comparing. Without
    // this, two pages on the same topic score around 0.5 purely because half
    // of each title is a different brand name, and a topic the customer
    // already covers is reported as a gap.
    const boilerplate = { theirs: siteBoilerplate(theirList), ours: siteBoilerplate(ourList) };

    const opportunities = theirList
      .filter((page) => !skipped.has(page.pageType))
      .filter((page) => !options.pageType || page.pageType === options.pageType)
      .map((page) => ({
        page,
        match: closestMatch(page, ourList, boilerplate),
        // closestMatch returns null for two different reasons and only one of
        // them is a gap: their page has no readable topic at all, or it has
        // one and nothing of ours shares a word. Telling them apart matters —
        // the real competitor's home page has no topic words, and treating
        // that null as "no match found" listed their front page as a page the
        // customer should go and write.
        readable: distinctiveTokens(page, boilerplate.theirs).size > 0,
      }))
      .filter(({ match, readable }) => readable && (!match || match.score < MATCH_THRESHOLD))
      .map(({ page, match }) => ({
        url: page.url,
        title: page.title,
        pageType: page.pageType,
        closestOwnPage: match
          ? { url: match.page.url, title: match.page.title ?? null, score: Number(match.score.toFixed(2)) }
          : null,
      }))
      // Weakest match first: the topics with nothing like them on the
      // customer's site are the ones worth reading first.
      .sort((a, b) => (a.closestOwnPage?.score ?? 0) - (b.closestOwnPage?.score ?? 0));

    return {
      domain: competitor.domain,
      /** How the list was produced, so the number is never read as more than it is. */
      basis: 'Compared by words in each page URL and title. Pages we could not match may still be covered on your site in different wording.',
      total: opportunities.length,
      opportunities: opportunities.slice(0, Math.min(options.limit ?? 50, 200)),
    };
  }

  /**
   * What changed on the competitor's site between their last two crawls.
   *
   * Diffed straight from the two crawls rather than from a stored snapshot.
   * Every crawl already keeps its own pages, so a snapshot table would be a
   * second copy of data we have — and a copy that can disagree with the pages
   * it was derived from, which is the worst kind of wrong on a screen that
   * exists to report changes.
   *
   * Returns null until there are two completed crawls. A first crawl looks
   * exactly like "they added 35 pages" if it is diffed against nothing, which
   * would announce a site's entire existence as this week's news.
   */
  async getChanges(organizationId: string, projectId: string, competitorId: string) {
    const competitor = await this.prisma.competitorDomain.findFirst({
      where: { id: competitorId, projectId, project: { organizationId } },
      select: { websiteId: true, domain: true },
    });
    if (!competitor) throw new NotFoundException('Competitor not found for this project.');
    if (!competitor.websiteId) return null;

    const jobs = await this.prisma.crawlJob.findMany({
      where: { websiteId: competitor.websiteId, status: 'COMPLETED' },
      orderBy: { finishedAt: 'desc' },
      take: 2,
      select: { id: true, finishedAt: true },
    });
    if (jobs.length < 2) return null;

    const [current, previous] = jobs;
    const [currentPages, previousPages] = await Promise.all([
      this.pagesFor(current.id),
      this.pagesFor(previous.id),
    ]);

    const added = [...currentPages.values()].filter((page) => !previousPages.has(page.key));
    const removed = [...previousPages.values()].filter((page) => !currentPages.has(page.key));

    // Only pages present in both, so a retitle is never confused with a page
    // that was replaced by a different one at the same address.
    const retitled = [...currentPages.values()]
      .map((page) => ({ page, before: previousPages.get(page.key) }))
      .filter(({ page, before }) => before && before.title && page.title && before.title !== page.title)
      .map(({ page, before }) => ({
        url: page.url,
        pageType: page.pageType,
        from: before!.title,
        to: page.title,
      }));

    return {
      domain: competitor.domain,
      since: previous.finishedAt,
      until: current.finishedAt,
      added: added.map((p) => ({ url: p.url, title: p.title, pageType: p.pageType })),
      removed: removed.map((p) => ({ url: p.url, title: p.title, pageType: p.pageType })),
      retitled,
      // Net movement by page kind — the shape of what they are investing in.
      // A site that added six service pages and dropped two blog posts is
      // doing something a single "8 changes" number would hide.
      byType: this.netByType(added, removed),
    };
  }

  private async pagesFor(crawlJobId: string) {
    const pages = await this.prisma.page.findMany({
      where: { crawlJobId, statusCode: { gte: 200, lt: 300 } },
      select: { url: true, title: true, pageType: true },
    });

    // Keyed canonically for the same reason coverage counts canonically: a
    // page linked as www. in one crawl and bare in the next is not a page
    // that was removed and a different one added.
    const byKey = new Map<string, { key: string; url: string; title: string | null; pageType: string }>();
    for (const page of pages) {
      const key = canonicalUrl(page.url);
      if (!byKey.has(key)) byKey.set(key, { key, ...page });
    }
    return byKey;
  }

  private netByType(
    added: { pageType: string }[],
    removed: { pageType: string }[],
  ): Record<string, { added: number; removed: number }> {
    const net: Record<string, { added: number; removed: number }> = {};
    for (const page of added) {
      net[page.pageType] ??= { added: 0, removed: 0 };
      net[page.pageType].added += 1;
    }
    for (const page of removed) {
      net[page.pageType] ??= { added: 0, removed: 0 };
      net[page.pageType].removed += 1;
    }
    return net;
  }

  /** The competitor's crawled pages of one kind, for showing what they cover. */
  async listPages(
    organizationId: string,
    projectId: string,
    competitorId: string,
    options: { pageType?: string; limit?: number } = {},
  ) {
    const competitor = await this.prisma.competitorDomain.findFirst({
      where: { id: competitorId, projectId, project: { organizationId } },
      select: { websiteId: true },
    });
    if (!competitor) throw new NotFoundException('Competitor not found for this project.');
    if (!competitor.websiteId) return [];

    const job = await this.prisma.crawlJob.findFirst({
      where: { websiteId: competitor.websiteId, status: 'COMPLETED' },
      orderBy: { finishedAt: 'desc' },
      select: { id: true },
    });
    if (!job) return [];

    return this.prisma.page.findMany({
      where: {
        crawlJobId: job.id,
        statusCode: { gte: 200, lt: 300 },
        ...(options.pageType ? { pageType: options.pageType } : {}),
      },
      select: { url: true, title: true, metaDescription: true, h1: true, pageType: true, wordCount: true },
      orderBy: { url: 'asc' },
      take: Math.min(options.limit ?? 100, 300),
    });
  }
}
