import { DiscoveryPipelineService } from './discovery-pipeline.service';

const customerSite = {
  domain: 'clientco.com',
  projectId: 'p1',
  project: { id: 'p1', organizationId: 'org1', competitorsIdentifiedAt: null as Date | null },
  competitors: [] as any[],
};

const competitorSite = {
  domain: 'rival.com',
  projectId: null,
  project: null,
  competitors: [
    { id: 'c1', domain: 'rival.com', projectId: 'p1', name: 'Rival', instagramHandle: null, youtubeUrl: null },
  ],
};

describe('DiscoveryPipelineService', () => {
  let prisma: any;
  let crawler: any;
  let research: any;
  let competitorCrawl: any;
  let service: DiscoveryPipelineService;

  beforeEach(() => {
    prisma = {
      website: { findUnique: jest.fn().mockResolvedValue(customerSite) },
      crawlJob: { findUnique: jest.fn().mockResolvedValue({ pagesCrawled: 42 }) },
      project: {
        findUnique: jest.fn().mockResolvedValue({ organizationId: 'org1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      competitorDomain: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      socialAccount: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
      competitorAccount: { upsert: jest.fn().mockResolvedValue({}) },
      siteSocialLink: { findMany: jest.fn().mockResolvedValue([]) },
    };
    crawler = { onCrawlCompleted: jest.fn() };
    research = {
      getBusinessProfile: jest.fn().mockResolvedValue({ industry: 'Dairy', confidence: 'high' }),
      autoIdentifyCompetitors: jest.fn().mockResolvedValue({ topCompetitors: [], notes: [] }),
      addSelectedCompetitors: jest.fn().mockResolvedValue({ count: 0, addedCompetitors: [] }),
    };
    competitorCrawl = { startCrawl: jest.fn().mockResolvedValue({ jobId: 'j2' }) };

    service = new DiscoveryPipelineService(prisma, crawler, research, competitorCrawl);
  });

  it('subscribes to crawl completion at start-up rather than being injected into the crawler', () => {
    service.onModuleInit();
    expect(crawler.onCrawlCompleted).toHaveBeenCalledTimes(1);
  });

  describe("the customer's own site", () => {
    it('re-reads the business from the crawl that just finished', async () => {
      await service.handleCrawlCompleted('j1', 'w1');

      expect(research.getBusinessProfile).toHaveBeenCalledWith('org1', 'p1', { refresh: true });
    });

    it('identifies competitors and tracks the verified ones', async () => {
      research.autoIdentifyCompetitors.mockResolvedValue({
        topCompetitors: [
          { domain: 'rival.com', name: 'Rival', industry: 'Dairy', description: 'x', overlapScore: 88, verified: true },
          { domain: 'ghost.com', name: 'Ghost', industry: 'Dairy', description: 'y', overlapScore: 60, verified: false },
        ],
        notes: [],
      });
      research.addSelectedCompetitors.mockResolvedValue({ count: 1, addedCompetitors: [] });

      await service.handleCrawlCompleted('j1', 'w1');

      const [, , tracked] = research.addSelectedCompetitors.mock.calls[0];
      expect(tracked).toEqual([expect.objectContaining({ domain: 'rival.com', confidenceScore: 88 })]);
    });

    it('caps automatic tracking at five however many were identified', async () => {
      research.autoIdentifyCompetitors.mockResolvedValue({
        topCompetitors: Array.from({ length: 9 }, (_, i) => ({
          domain: `rival${i}.com`,
          name: `Rival ${i}`,
          industry: 'Dairy',
          description: '',
          overlapScore: 80,
          verified: true,
        })),
      });

      await service.handleCrawlCompleted('j1', 'w1');

      expect(research.addSelectedCompetitors.mock.calls[0][2]).toHaveLength(5);
    });

    // A customer who reviewed the five we found and deleted four made a
    // decision. The next monthly crawl must not put them back.
    it('identifies competitors once and never again on its own', async () => {
      prisma.website.findUnique.mockResolvedValue({
        ...customerSite,
        project: { ...customerSite.project, competitorsIdentifiedAt: new Date('2026-01-01') },
      });

      await service.handleCrawlCompleted('j1', 'w1');

      expect(research.autoIdentifyCompetitors).not.toHaveBeenCalled();
      // Detection still runs: it describes the site as it is now.
      expect(research.getBusinessProfile).toHaveBeenCalled();
    });

    it('leaves a hand-built competitor list alone', async () => {
      prisma.competitorDomain.count.mockResolvedValue(3);

      await service.handleCrawlCompleted('j1', 'w1');

      expect(research.autoIdentifyCompetitors).not.toHaveBeenCalled();
      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { competitorsIdentifiedAt: expect.any(Date) } }),
      );
    });

    it('records that identification ran even when it found nobody', async () => {
      await service.handleCrawlCompleted('j1', 'w1');

      expect(prisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { competitorsIdentifiedAt: expect.any(Date) } }),
      );
    });

    it('reads nothing from a crawl that returned no pages', async () => {
      prisma.crawlJob.findUnique.mockResolvedValue({ pagesCrawled: 0 });

      await service.handleCrawlCompleted('j1', 'w1');

      expect(research.getBusinessProfile).not.toHaveBeenCalled();
      expect(research.autoIdentifyCompetitors).not.toHaveBeenCalled();
    });

    it('stores the social account found on their own site, unconnected', async () => {
      prisma.siteSocialLink.findMany.mockResolvedValue([
        { platform: 'INSTAGRAM', handle: '@clientco', profileUrl: 'https://www.instagram.com/clientco/', pageCount: 40 },
      ]);

      await service.handleCrawlCompleted('j1', 'w1');

      expect(prisma.socialAccount.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            handle: '@clientco',
            discoverySource: 'WEBSITE_CRAWL',
            status: 'DISCONNECTED',
          }),
        }),
      );
    });

    // Counts accumulated over a site's whole crawl history would say things
    // like "on 400 of 40 pages", so each crawl's findings are read on their own.
    it('reads the profiles the finished crawl found, not the site\'s whole history', async () => {
      await service.handleCrawlCompleted('j1', 'w1');

      expect(prisma.siteSocialLink.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { crawlJobId: 'j1' } }),
      );
    });

    // The handle on a connected account came from the platform itself.
    it('never overwrites an account the customer connected', async () => {
      prisma.siteSocialLink.findMany.mockResolvedValue([
        { platform: 'INSTAGRAM', handle: '@stale', profileUrl: 'https://www.instagram.com/stale/', pageCount: 9 },
      ]);
      prisma.socialAccount.findUnique.mockResolvedValue({ id: 's1', status: 'CONNECTED', discoverySource: null });

      await service.handleCrawlCompleted('j1', 'w1');

      expect(prisma.socialAccount.upsert).not.toHaveBeenCalled();
    });

    it('keeps a failing step from costing the customer the others', async () => {
      research.getBusinessProfile.mockRejectedValue(new Error('model unavailable'));

      await expect(service.handleCrawlCompleted('j1', 'w1')).resolves.toBeUndefined();
      expect(research.autoIdentifyCompetitors).toHaveBeenCalled();
    });
  });

  describe("a competitor's site", () => {
    beforeEach(() => {
      prisma.website.findUnique.mockResolvedValue(competitorSite);
    });

    // Nothing in the product moved a competitor past ANALYZING, so every one
    // ever tracked sat in a permanent "analysing" state with a null
    // lastAnalyzedAt.
    it('marks the competitor analysed, with the time it happened', async () => {
      await service.handleCrawlCompleted('j2', 'w2');

      expect(prisma.competitorDomain.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { status: 'ANALYZED', lastAnalyzedAt: expect.any(Date) },
      });
    });

    it('marks a competitor whose crawl read nothing as failed, not analysed', async () => {
      prisma.crawlJob.findUnique.mockResolvedValue({ pagesCrawled: 0 });

      await service.handleCrawlCompleted('j2', 'w2');

      expect(prisma.competitorDomain.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { status: 'FAILED' },
      });
    });

    it("registers the competitor's accounts for the content sweeps to read", async () => {
      prisma.siteSocialLink.findMany.mockResolvedValue([
        { platform: 'INSTAGRAM', handle: '@rival', profileUrl: 'https://www.instagram.com/rival/', pageCount: 30 },
        { platform: 'YOUTUBE', handle: '@rivaltv', profileUrl: 'https://www.youtube.com/@rivaltv', pageCount: 30 },
      ]);

      await service.handleCrawlCompleted('j2', 'w2');

      expect(prisma.competitorAccount.upsert).toHaveBeenCalledTimes(2);
      // The daily sync reads these columns, not the account rows.
      expect(prisma.competitorDomain.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { instagramHandle: '@rival', youtubeUrl: 'https://www.youtube.com/@rivaltv' },
      });
    });

    it('leaves a handle an operator typed in the setup form alone', async () => {
      prisma.website.findUnique.mockResolvedValue({
        ...competitorSite,
        competitors: [{ ...competitorSite.competitors[0], instagramHandle: '@typed.by.hand' }],
      });
      prisma.siteSocialLink.findMany.mockResolvedValue([
        { platform: 'INSTAGRAM', handle: '@found', profileUrl: 'https://www.instagram.com/found/', pageCount: 30 },
      ]);

      await service.handleCrawlCompleted('j2', 'w2');

      const handleWrites = prisma.competitorDomain.update.mock.calls.filter(
        ([arg]: any[]) => 'instagramHandle' in arg.data,
      );
      expect(handleWrites).toHaveLength(0);
    });
  });

  describe('the first crawl of a competitor added by hand', () => {
    it('starts one for every competitor still waiting', async () => {
      prisma.competitorDomain.findMany.mockResolvedValue([
        { id: 'c9', domain: 'new.com', projectId: 'p1', project: { organizationId: 'org1' } },
      ]);

      await service.crawlUncrawledCompetitors();

      expect(competitorCrawl.startCrawl).toHaveBeenCalledWith('org1', 'p1', 'c9');
    });

    it('asks only for competitors that have never been analysed', async () => {
      await service.crawlUncrawledCompetitors();

      expect(prisma.competitorDomain.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'PENDING', lastAnalyzedAt: null } }),
      );
    });

    // Both the API process and the worker boot the whole module tree, so this
    // cron body runs twice on every tick against the same database.
    it('leaves a competitor another process already claimed alone', async () => {
      prisma.competitorDomain.findMany.mockResolvedValue([
        { id: 'c9', domain: 'new.com', projectId: 'p1', project: { organizationId: 'org1' } },
      ]);
      prisma.competitorDomain.updateMany.mockResolvedValue({ count: 0 });

      await service.crawlUncrawledCompetitors();

      expect(competitorCrawl.startCrawl).not.toHaveBeenCalled();
    });

    it('releases a competitor whose crawl could not be started, so the next sweep retries', async () => {
      prisma.competitorDomain.findMany.mockResolvedValue([
        { id: 'c9', domain: 'new.com', projectId: 'p1', project: { organizationId: 'org1' } },
      ]);
      competitorCrawl.startCrawl.mockRejectedValue(new Error('unreachable'));

      await service.crawlUncrawledCompetitors();

      expect(prisma.competitorDomain.updateMany).toHaveBeenLastCalledWith({
        where: { id: 'c9', status: 'ANALYZING' },
        data: { status: 'PENDING' },
      });
    });

    it('carries on past a competitor whose crawl will not start', async () => {
      prisma.competitorDomain.findMany.mockResolvedValue([
        { id: 'c1', domain: 'a.com', projectId: 'p1', project: { organizationId: 'org1' } },
        { id: 'c2', domain: 'b.com', projectId: 'p1', project: { organizationId: 'org1' } },
      ]);
      competitorCrawl.startCrawl.mockRejectedValueOnce(new Error('unreachable'));

      await service.crawlUncrawledCompetitors();

      expect(competitorCrawl.startCrawl).toHaveBeenCalledTimes(2);
    });
  });
});
