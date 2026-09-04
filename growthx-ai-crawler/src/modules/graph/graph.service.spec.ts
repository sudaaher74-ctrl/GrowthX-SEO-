import { GraphService } from './graph.service';
import { PrismaService } from '../../database/prisma.service';

describe('GraphService', () => {
  let service: GraphService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      page: {
        findMany: jest.fn(),
      },
      internalGraph: {
        findMany: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      issue: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'issue_1' }),
      },
      crawlJob: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    service = new GraphService(mockPrisma as PrismaService);
  });

  it('does not mark the homepage or utility pages as orphan pages', async () => {
    mockPrisma.page.findMany.mockResolvedValue([
      { id: 'p1', url: 'https://example.com/', statusCode: 200, canonicalUrl: null, robotsMeta: null, pageType: 'HOME' },
      { id: 'p2', url: 'https://example.com/privacy-policy', statusCode: 200, canonicalUrl: null, robotsMeta: null, pageType: 'LEGAL' },
    ]);
    mockPrisma.internalGraph.findMany.mockResolvedValue([]);

    const report = await service.generateGraphReport('job_1');
    expect(report.orphanPages).toEqual([]);
    expect(mockPrisma.issue.create).not.toHaveBeenCalled();
  });

  it('flags unlinked internal page as orphan with evidence and medium severity', async () => {
    mockPrisma.page.findMany.mockResolvedValue([
      { id: 'p1', url: 'https://example.com/', statusCode: 200, canonicalUrl: null, robotsMeta: null, pageType: 'HOME' },
      { id: 'p2', url: 'https://example.com/services', statusCode: 200, canonicalUrl: null, robotsMeta: null, pageType: 'SERVICE' },
      { id: 'p3', url: 'https://example.com/isolated-page', statusCode: 200, canonicalUrl: null, robotsMeta: null, pageType: 'BLOG' },
    ]);
    // Link from home to services, but isolated-page has no incoming link
    mockPrisma.internalGraph.findMany.mockResolvedValue([
      { sourceUrl: 'https://example.com/', targetUrl: 'https://example.com/services', crawlDepth: 1 },
    ]);

    const report = await service.generateGraphReport('job_1');
    expect(report.orphanPages).toContain('https://example.com/isolated-page');
    expect(mockPrisma.issue.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        affectedUrl: 'https://example.com/isolated-page',
        issueType: 'ORPHAN_PAGE',
        severity: 'MEDIUM',
        confidence: 'CONFIRMED',
        evidence: expect.stringContaining('Incoming internal HTML links: 0'),
      }),
    }));
  });
});
