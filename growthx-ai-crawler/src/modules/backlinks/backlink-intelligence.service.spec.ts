import { Test, TestingModule } from '@nestjs/testing';
import { BacklinkIntelligenceService } from './backlink-intelligence.service';
import { PrismaService } from '../../database/prisma.service';
import { DataForSeoBacklinksService } from './dataforseo-backlinks.service';

describe('BacklinkIntelligenceService', () => {
  let service: BacklinkIntelligenceService;
  let prisma: any;
  let dataforseo: any;

  beforeEach(async () => {
    prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'proj_1',
          name: 'MilQuu Fresh',
          websites: [{ id: 'w1', domain: 'milquufresh.in', scope: 'own' }],
        }),
      },
      website: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'w1',
          domain: 'milquufresh.in',
          url: 'https://milquufresh.in',
        }),
      },
      crawlJob: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      competitorDomain: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      backlinkDomainSnapshot: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'snap_1', ...args.data, checkedAt: new Date() })),
      },
      backlinkSource: {
        upsert: jest.fn().mockResolvedValue({ id: 'source_1', sourceUrl: 'https://dairyreview.com/post' }),
      },
      backlink: {
        upsert: jest.fn().mockResolvedValue({ id: 'link_1', targetUrl: 'https://milquufresh.in/' }),
      },
    };

    dataforseo = {
      getDomainSummary: jest.fn().mockResolvedValue({
        target: 'milquufresh.in',
        rank: 380,
        backlinks: 450,
        crawledPages: 45,
        internalLinksCount: 120,
        externalLinksCount: 8,
        brokenBacklinks: 2,
        brokenPages: 0,
        referringDomains: 38,
        referringMainDomains: 35,
        referringIps: 30,
        referringSubnets: 22,
        referringPages: 110,
        dofollow: 390,
        nofollow: 60,
        referringLinksTld: { in: 350, com: 100 },
        referringLinksTypes: { anchor: 420, image: 30 },
        referringLinksAttributes: { dofollow: 390, nofollow: 60 },
        referringLinksPlatformTypes: {},
        spamScore: 4,
        costUsd: 0.02,
      }),
      getReferringDomains: jest.fn().mockResolvedValue({
        items: [
          {
            domain: 'dairyreview.com',
            rank: 410,
            backlinks: 15,
            dofollowBacklinks: 15,
            firstSeen: '2026-03-01T00:00:00Z',
            lostDate: null,
            spamScore: 2,
            brokenBacklinks: 0,
            brokenPages: 0,
          },
        ],
        totalCount: 38,
        costUsd: 0.02,
      }),
      getBacklinks: jest.fn().mockResolvedValue({
        items: [
          {
            urlFrom: 'https://dairyreview.com/post',
            urlTo: 'https://milquufresh.in/',
            domainFrom: 'dairyreview.com',
            tldFrom: 'com',
            anchor: 'Pure A2 Milk',
            textPre: 'Get the best',
            textPost: 'delivered fresh',
            dofollow: true,
            rank: 410,
            pageFromRank: 25,
            domainFromRank: 55,
            spamScore: 2,
            firstSeen: '2026-03-01T00:00:00Z',
            lastSeen: '2026-10-28T00:00:00Z',
            isBroken: false,
            isNew: false,
            isLost: false,
            linkType: 'anchor',
          },
        ],
        totalCount: 450,
        costUsd: 0.02,
      }),
      getAnchors: jest.fn().mockResolvedValue({
        items: [
          {
            anchor: 'Pure A2 Milk',
            backlinks: 85,
            referringDomains: 12,
            referringPages: 40,
            firstSeen: '2026-03-01T00:00:00Z',
            lastSeen: '2026-10-28T00:00:00Z',
            spamScore: 2,
            brokenBacklinks: 0,
          },
        ],
        totalCount: 1,
        costUsd: 0.02,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BacklinkIntelligenceService,
        { provide: PrismaService, useValue: prisma },
        { provide: DataForSeoBacklinksService, useValue: dataforseo },
      ],
    }).compile();

    service = module.get<BacklinkIntelligenceService>(BacklinkIntelligenceService);
  });

  describe('getOverview', () => {
    it('returns cached snapshot without calling DataForSEO when snapshot is fresh', async () => {
      prisma.backlinkDomainSnapshot.findFirst.mockResolvedValueOnce({
        id: 'cached_snap',
        domain: 'milquufresh.in',
        targetKind: 'OWN',
        provider: 'dataforseo',
        checkedAt: new Date(Date.now() - 2 * 3600 * 1000), // 2 hours old
        rank: 380,
        backlinks: 450,
        referringDomains: 38,
        referringMainDomains: 35,
        referringIps: 30,
        referringSubnets: 22,
        referringPages: 110,
        dofollow: 390,
        nofollow: 60,
        brokenBacklinks: 2,
        brokenPages: 0,
        spamScore: 4,
        topAnchors: [],
        topReferringDomains: [],
        backlinksList: [],
        rawSummary: { tldDistribution: { in: 350 } },
        costUsd: 0.02,
      });

      const overview = await service.getOverview('proj_1', 'milquufresh.in');
      expect(overview.isCached).toBe(true);
      expect(overview.metrics.backlinks).toBe(450);
      expect(overview.metrics.referringDomains).toBe(38);
      expect(dataforseo.getDomainSummary).not.toHaveBeenCalled();
    });

    it('calls DataForSEO and persists snapshot when no cache exists', async () => {
      const overview = await service.getOverview('proj_1', 'milquufresh.in');
      expect(overview.isCached).toBe(false);
      expect(overview.metrics.backlinks).toBe(450);
      expect(overview.metrics.rank).toBe(380);
      expect(dataforseo.getDomainSummary).toHaveBeenCalledWith('milquufresh.in');
      expect(prisma.backlinkDomainSnapshot.create).toHaveBeenCalled();
    });

    it('returns cached snapshot with warning if live DataForSEO sync fails', async () => {
      const cached = {
        id: 'old_snap',
        domain: 'milquufresh.in',
        targetKind: 'OWN',
        provider: 'dataforseo',
        checkedAt: new Date(Date.now() - 30 * 3600 * 1000), // 30 hours old
        rank: 370,
        backlinks: 400,
        referringDomains: 35,
        referringMainDomains: 32,
        referringIps: 28,
        referringSubnets: 20,
        referringPages: 100,
        dofollow: 350,
        nofollow: 50,
        brokenBacklinks: 0,
        brokenPages: 0,
        spamScore: 3,
        topAnchors: [],
        topReferringDomains: [],
        backlinksList: [],
        rawSummary: {},
        costUsd: 0.02,
      };
      prisma.backlinkDomainSnapshot.findFirst.mockResolvedValueOnce(cached);
      dataforseo.getDomainSummary.mockRejectedValueOnce(
        new Error('DataForSEO account verification required.'),
      );

      const overview = await service.getOverview('proj_1', 'milquufresh.in', true);
      expect(overview.isCached).toBe(true);
      expect(overview.warning).toContain('DataForSEO account verification required');
      expect(overview.metrics.backlinks).toBe(400);
    });
  });

  describe('syncDomainIntelligence and Link Ingestion', () => {
    it('syncs discovered backlinks into database BacklinkSource and Backlink tables', async () => {
      await service.syncDomainIntelligence('proj_1', 'milquufresh.in');
      expect(prisma.backlinkSource.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId_sourceUrl: { projectId: 'proj_1', sourceUrl: 'https://dairyreview.com/post' } },
          create: expect.objectContaining({
            projectId: 'proj_1',
            sourceUrl: 'https://dairyreview.com/post',
            discovery: 'DATAFORSEO',
          }),
        }),
      );

      expect(prisma.backlink.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            targetUrl: 'https://milquufresh.in/',
            anchorText: 'Pure A2 Milk',
            followState: 'FOLLOW',
          }),
        }),
      );
    });
  });

  describe('Referring Domains, Backlinks, and Anchors', () => {
    it('returns referring domains list', async () => {
      const res = await service.getReferringDomains('proj_1', 'milquufresh.in');
      expect(res.items).toHaveLength(1);
      expect(res.items[0].domain).toBe('dairyreview.com');
      expect(res.items[0].rank).toBe(410);
    });

    it('returns detailed backlinks list', async () => {
      const res = await service.getBacklinksList('proj_1', 'milquufresh.in');
      expect(res.items).toHaveLength(1);
      expect(res.items[0].urlFrom).toBe('https://dairyreview.com/post');
      expect(res.items[0].anchor).toBe('Pure A2 Milk');
      expect(res.items[0].dofollow).toBe(true);
    });

    it('returns anchor text analysis', async () => {
      const res = await service.getAnchors('proj_1', 'milquufresh.in');
      expect(res.items).toHaveLength(1);
      expect(res.items[0].anchor).toBe('Pure A2 Milk');
      expect(res.items[0].backlinks).toBe(85);
      expect(res.items[0].referringDomains).toBe(12);
    });
  });
});
