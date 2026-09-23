import { WebsiteAuditAdapter } from './website-audit.adapter';
import { PrismaService } from '../../database/prisma.service';
import { IssueGroupService, IssueGroup } from './issue-group.service';

describe('WebsiteAuditAdapter', () => {
  let adapter: WebsiteAuditAdapter;
  let mockPrisma: any;
  let mockIssueGroupService: any;

  const mockGroups: IssueGroup[] = [
    {
      groupKey: 'audit::MISSING_H1',
      issueType: 'MISSING_H1',
      category: 'TECHNICAL',
      severity: 'HIGH',
      confidence: 'CONFIRMED',
      affectedCount: 3,
      sampleUrls: ['https://example.com/a', 'https://example.com/b'],
      aiFixAvailable: true,
      fixClass: 'AUTO',
      impact: 75,
      reachAvailable: true,
      firstDetectedAt: '2026-09-01T00:00:00.000Z',
      regressionCount: 0,
      title: 'Missing main page headings',
      summary: '3 pages lack a top-level H1 heading.',
      action: 'Generate and insert descriptive H1 headings.',
    },
  ];

  beforeEach(() => {
    mockPrisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({ organizationId: 'org-123' }),
      },
    };
    mockIssueGroupService = {
      groupsForProject: jest.fn().mockResolvedValue({ groups: mockGroups, reachAvailable: true }),
    };
    adapter = new WebsiteAuditAdapter(
      mockPrisma as unknown as PrismaService,
      mockIssueGroupService as unknown as IssueGroupService,
    );
  });

  it('produces stable fingerprints across two invocations with identical inputs', async () => {
    const run1 = await adapter.collect('proj-1');
    const run2 = await adapter.collect('proj-1');

    expect(run1).toHaveLength(1);
    expect(run2).toHaveLength(1);
    expect(run1[0].fingerprint).toBe(run2[0].fingerprint);
    expect(run1[0].fingerprint).toBe('audit::MISSING_H1');
    expect(run1[0].fixClass).toBe('AUTO');
    expect(run1[0].impact).toBe(75);
    expect(run1[0].detailType).toBe('ISSUE_GROUP');
    expect(run1[0].detailRef).toBe('audit::MISSING_H1');
  });
});
