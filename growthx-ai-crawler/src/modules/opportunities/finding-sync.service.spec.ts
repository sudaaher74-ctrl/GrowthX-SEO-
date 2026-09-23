import { FindingLifecycle } from '@prisma/client';
import { FindingSyncService } from './finding-sync.service';
import { PrismaService } from '../../database/prisma.service';
import { NormalisedFinding } from './finding-adapter.interface';

describe('FindingSyncService', () => {
  let service: FindingSyncService;
  let mockPrisma: any;
  let mockWebsiteAdapter: any;
  let mockGbpAdapter: any;
  let mockCompetitorAdapter: any;
  let mockAiVisAdapter: any;

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

    mockWebsiteAdapter = { collect: jest.fn().mockResolvedValue([sampleFinding]) };
    mockGbpAdapter = { collect: jest.fn().mockResolvedValue([]) };
    mockCompetitorAdapter = { collect: jest.fn().mockResolvedValue([]) };
    mockAiVisAdapter = { collect: jest.fn().mockResolvedValue([]) };

    service = new FindingSyncService(
      mockPrisma as unknown as PrismaService,
      mockWebsiteAdapter,
      mockGbpAdapter,
      mockCompetitorAdapter,
      mockAiVisAdapter,
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
});
