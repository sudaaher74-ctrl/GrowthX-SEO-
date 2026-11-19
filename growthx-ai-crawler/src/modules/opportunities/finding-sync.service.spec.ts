import { FindingLifecycle } from '@prisma/client';
import { FindingSyncService } from './finding-sync.service';
import { PrismaService } from '../../database/prisma.service';
import { NormalisedFinding } from './finding-adapter.interface';

describe('FindingSyncService', () => {
  let service: FindingSyncService;
  let mockPrisma: any;
  let mockWebsiteAdapter: any;
  let mockCompetitorAdapter: any;
  let mockAiVisAdapter: any;
  let mockBacklinksAdapter: any;
  let mockTrafficAdapter: any;

  const sampleFinding: NormalisedFinding = {
    projectId: 'proj-1',
    organizationId: 'org-1',
    fingerprint: 'audit::MISSING_H1',
    source: 'WEBSITE',
    category: 'TECHNICAL',
    title: 'Missing H1 heading',
    summary: '3 pages lack H1',
    recommendedAction: 'Add H1 tags',
    evidence: [{ label: 'Affected', value: '3', source: 'CRAWLER' }],
    potential: 'HIGH',
    effort: 'LOW',
    confidence: 90,
    impact: 80,
    fixClass: 'AUTO',
    affectedPages: ['https://example.com'],
    affectedCount: 3,
    detailType: 'ISSUE_GROUP',
    detailRef: 'audit::MISSING_H1',
  };

  beforeEach(() => {
    mockPrisma = {
      growthOpportunity: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    };

    mockWebsiteAdapter = { source: 'WEBSITE', collect: jest.fn().mockResolvedValue([sampleFinding]) };
    mockCompetitorAdapter = { source: 'COMPETITOR', collect: jest.fn().mockResolvedValue([]) };
    mockAiVisAdapter = { source: 'MARKET', collect: jest.fn().mockResolvedValue([]) };
    mockBacklinksAdapter = { source: 'BACKLINKS', collect: jest.fn().mockResolvedValue([]) };
    mockTrafficAdapter = { source: 'SEARCH_CONSOLE', collect: jest.fn().mockResolvedValue([]) };

    service = new FindingSyncService(
      mockPrisma as unknown as PrismaService,
      mockWebsiteAdapter,
      mockCompetitorAdapter,
      mockAiVisAdapter,
      mockBacklinksAdapter,
      mockTrafficAdapter,
    );
  });

  it('running twice with identical input: creates first run, updates second run without recreating', async () => {
    // Run 1: No existing rows
    mockPrisma.growthOpportunity.findUnique.mockResolvedValue(null);
    mockPrisma.growthOpportunity.findMany.mockResolvedValue([]);
    mockPrisma.growthOpportunity.create.mockResolvedValue({});

    const run1 = await service.syncProject('proj-1');
    expect(run1).toEqual({ created: 1, updated: 0, resolved: 0 });
    expect(mockPrisma.growthOpportunity.create).toHaveBeenCalledTimes(1);

    // Run 2: Row exists
    mockPrisma.growthOpportunity.findUnique.mockResolvedValue({
      id: 'opp-1',
      fingerprint: sampleFinding.fingerprint,
      status: 'OPEN',
      lifecycle: FindingLifecycle.QUEUED,
    });
    mockPrisma.growthOpportunity.findMany.mockResolvedValue([
      {
        id: 'opp-1',
        fingerprint: sampleFinding.fingerprint,
        source: 'WEBSITE',
        status: 'OPEN',
        lifecycle: FindingLifecycle.QUEUED,
      },
    ]);
    mockPrisma.growthOpportunity.update.mockResolvedValue({});

    const run2 = await service.syncProject('proj-1');
    expect(run2).toEqual({ created: 0, updated: 1, resolved: 0 });
    expect(mockPrisma.growthOpportunity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'opp-1' },
        data: expect.not.objectContaining({
          status: expect.anything(),
          lifecycle: expect.anything(),
        }),
      }),
    );
  });

  it('dismissed rows survive a resync that still detects them (status and lifecycle untouched)', async () => {
    mockPrisma.growthOpportunity.findUnique.mockResolvedValue({
      id: 'opp-dismissed',
      fingerprint: sampleFinding.fingerprint,
      status: 'DISMISSED',
      lifecycle: FindingLifecycle.DISMISSED,
    });
    mockPrisma.growthOpportunity.findMany.mockResolvedValue([
      {
        id: 'opp-dismissed',
        fingerprint: sampleFinding.fingerprint,
        source: 'WEBSITE',
        status: 'DISMISSED',
        lifecycle: FindingLifecycle.DISMISSED,
      },
    ]);
    mockPrisma.growthOpportunity.update.mockResolvedValue({});

    const res = await service.syncProject('proj-1');
    expect(res).toEqual({ created: 0, updated: 1, resolved: 0 });

    // Ensure status was NEVER overwritten to OPEN or QUEUED
    expect(mockPrisma.growthOpportunity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'opp-dismissed' },
        data: expect.not.objectContaining({
          status: 'OPEN',
          lifecycle: FindingLifecycle.QUEUED,
        }),
      }),
    );
  });

  it('findings mid-execution are NOT resolved by disappearing from detection', async () => {
    // Adapter returns empty array (finding no longer detected by crawler)
    mockWebsiteAdapter.collect.mockResolvedValue([]);

    mockPrisma.growthOpportunity.findMany.mockResolvedValue([
      {
        id: 'opp-executing',
        fingerprint: 'audit::MISSING_H1',
        source: 'WEBSITE',
        status: 'ACTIONED',
        lifecycle: FindingLifecycle.APPLYING, // Mid-execution!
        transitions: [],
      },
    ]);

    const res = await service.syncProject('proj-1');
    expect(res).toEqual({ created: 0, updated: 0, resolved: 0 });

    // Should NOT have called update to RESOLVED
    expect(mockPrisma.growthOpportunity.update).not.toHaveBeenCalled();
  });

  it('resolves an OPEN/QUEUED finding when it is no longer detected', async () => {
    mockWebsiteAdapter.collect.mockResolvedValue([]);

    mockPrisma.growthOpportunity.findMany.mockResolvedValue([
      {
        id: 'opp-open',
        fingerprint: 'audit::MISSING_H1',
        source: 'WEBSITE',
        status: 'OPEN',
        lifecycle: FindingLifecycle.QUEUED,
        transitions: [],
      },
    ]);
    mockPrisma.growthOpportunity.update.mockResolvedValue({});

    const res = await service.syncProject('proj-1');
    expect(res).toEqual({ created: 0, updated: 0, resolved: 1 });

    expect(mockPrisma.growthOpportunity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'opp-open' },
        data: expect.objectContaining({
          status: 'RESOLVED',
          lifecycle: FindingLifecycle.RESOLVED,
          resolvedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('does not resolve a source when its adapter failed', async () => {
    mockWebsiteAdapter.collect.mockRejectedValue(new Error('audit store unavailable'));
    mockPrisma.growthOpportunity.findMany.mockResolvedValue([
      {
        id: 'opp-open',
        fingerprint: 'audit::MISSING_H1',
        source: 'WEBSITE',
        status: 'OPEN',
        lifecycle: FindingLifecycle.QUEUED,
        transitions: [],
      },
    ]);

    const res = await service.syncProject('proj-1');

    expect(res).toEqual({ created: 0, updated: 0, resolved: 0 });
    expect(mockPrisma.growthOpportunity.update).not.toHaveBeenCalled();
  });

  it('syncs only requested sources when options.sources is provided (skipping Traffic)', async () => {
    mockWebsiteAdapter.collect.mockResolvedValue([
      { ...sampleFinding, fingerprint: 'audit::NEW_BROKEN_LINK', source: 'WEBSITE' },
    ]);
    mockPrisma.growthOpportunity.findUnique.mockResolvedValue(null);
    mockPrisma.growthOpportunity.create.mockResolvedValue({});
    mockPrisma.growthOpportunity.findMany.mockResolvedValue([
      {
        id: 'opp-old-website',
        fingerprint: 'audit::OLD_ISSUE',
        source: 'WEBSITE',
        status: 'OPEN',
        lifecycle: FindingLifecycle.QUEUED,
        transitions: [],
      },
      {
        id: 'opp-traffic',
        fingerprint: 'traffic::LOW_CTR',
        source: 'SEARCH_CONSOLE',
        status: 'OPEN',
        lifecycle: FindingLifecycle.QUEUED,
        transitions: [],
      },
    ]);

    const res = await service.syncProject('proj-1', { sources: ['WEBSITE'] });

    expect(res).toEqual({ created: 1, updated: 0, resolved: 1 });
    expect(mockWebsiteAdapter.collect).toHaveBeenCalledWith('proj-1');
    expect(mockTrafficAdapter.collect).not.toHaveBeenCalled();
    expect(mockCompetitorAdapter.collect).not.toHaveBeenCalled();
    expect(mockAiVisAdapter.collect).not.toHaveBeenCalled();
    expect(mockBacklinksAdapter.collect).not.toHaveBeenCalled();
    expect(mockPrisma.growthOpportunity.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.growthOpportunity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'opp-old-website' },
        data: expect.objectContaining({ status: 'RESOLVED' }),
      }),
    );
  });

  it('auto-syncs WEBSITE on own crawl completion, COMPETITOR on rival crawl completion, and BACKLINKS on discovery completion', async () => {
    let crawlHandler: ((jobId: string, websiteId: string) => Promise<void>) | undefined;
    let discoveryHandler: ((projectId: string) => Promise<void>) | undefined;

    const mockCrawler = {
      onCrawlCompleted: jest.fn((h) => {
        crawlHandler = h;
      }),
    };
    const mockDiscovery = {
      onDiscoveryCompleted: jest.fn((h) => {
        discoveryHandler = h;
      }),
    };
    mockPrisma.website = {
      findUnique: jest.fn(),
    };
    mockPrisma.growthOpportunity.findUnique.mockResolvedValue(null);
    mockPrisma.growthOpportunity.create.mockResolvedValue({});
    mockPrisma.growthOpportunity.findMany.mockResolvedValue([]);

    const wiredService = new FindingSyncService(
      mockPrisma,
      mockWebsiteAdapter,
      mockCompetitorAdapter,
      mockAiVisAdapter,
      mockBacklinksAdapter,
      mockTrafficAdapter,
      mockCrawler as any,
      mockDiscovery as any,
    );
    wiredService.onModuleInit();

    expect(mockCrawler.onCrawlCompleted).toHaveBeenCalledTimes(1);
    expect(mockDiscovery.onDiscoveryCompleted).toHaveBeenCalledTimes(1);

    mockPrisma.website.findUnique.mockResolvedValueOnce({ projectId: 'proj-1', scope: 'OWN' });
    await crawlHandler!('job-1', 'site-own');
    expect(mockWebsiteAdapter.collect).toHaveBeenCalledWith('proj-1');
    expect(mockTrafficAdapter.collect).not.toHaveBeenCalled();

    jest.clearAllMocks();
    mockPrisma.website.findUnique.mockResolvedValueOnce({ projectId: 'proj-1', scope: 'COMPETITOR' });
    await crawlHandler!('job-2', 'site-rival');
    expect(mockCompetitorAdapter.collect).toHaveBeenCalledWith('proj-1');
    expect(mockTrafficAdapter.collect).not.toHaveBeenCalled();

    jest.clearAllMocks();
    await discoveryHandler!('proj-1');
    expect(mockBacklinksAdapter.collect).toHaveBeenCalledWith('proj-1');
    expect(mockTrafficAdapter.collect).not.toHaveBeenCalled();
  });

  it('reconciles stale SavedPlan items, runs post-crawl opportunity detection excluding traffic, and broadcasts WebSocket updates', async () => {
    let crawlHandler: ((jobId: string, websiteId: string) => Promise<void>) | undefined;
    const mockCrawler = { onCrawlCompleted: jest.fn((h) => { crawlHandler = h; }) };
    const mockDetection = { detect: jest.fn().mockResolvedValue({ detected: 2, failedDetectors: [] }) };
    const mockGateway = { broadcastFindingsUpdated: jest.fn() };

    mockPrisma.website = {
      findUnique: jest.fn().mockResolvedValue({
        projectId: 'proj-1',
        scope: 'OWN',
        project: { organizationId: 'org-1' },
      }),
    };
    mockPrisma.savedPlan = {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'plan-1',
          source: 'TECHNICAL_AUDIT',
          title: 'Missing H1 heading',
          affectedUrl: 'https://example.com/about',
        },
        {
          id: 'plan-keep',
          source: 'TECHNICAL_AUDIT',
          title: 'Still broken page',
          affectedUrl: 'https://example.com/still-broken',
        },
      ]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };

    mockWebsiteAdapter.collect.mockResolvedValue([]);
    mockPrisma.growthOpportunity.findMany.mockResolvedValue([
      {
        id: 'opp-fixed',
        fingerprint: 'audit::MISSING_H1',
        source: 'WEBSITE',
        title: 'Missing H1 heading',
        affectedPages: ['https://example.com/about'],
        status: 'OPEN',
        lifecycle: FindingLifecycle.QUEUED,
        transitions: [],
      },
    ]);

    const wired = new FindingSyncService(
      mockPrisma,
      mockWebsiteAdapter,
      mockCompetitorAdapter,
      mockAiVisAdapter,
      mockBacklinksAdapter,
      mockTrafficAdapter,
      mockCrawler as any,
      undefined,
      mockDetection as any,
      mockGateway as any,
    );
    wired.onModuleInit();

    await crawlHandler!('job-9', 'site-own');

    expect(mockPrisma.savedPlan.updateMany).toHaveBeenCalledWith({
      where: { projectId: 'proj-1', id: { in: ['plan-1'] } },
      data: { status: 'EXECUTED' },
    });
    expect(mockDetection.detect).toHaveBeenCalledWith('org-1', 'proj-1', { excludeTraffic: true });
    expect(mockGateway.broadcastFindingsUpdated).toHaveBeenCalledWith(
      'proj-1',
      expect.objectContaining({
        sources: ['WEBSITE'],
        resolved: 1,
        savedPlansResolved: 1,
      }),
    );
  });
});
