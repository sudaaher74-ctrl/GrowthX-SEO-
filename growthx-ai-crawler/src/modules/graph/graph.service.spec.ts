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
      link: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      internalGraph: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      issue: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'issue_1' }),
      },
      crawlJob: {
        update: jest.fn().mockResolvedValue({}),
        // Findings raised here carry the same identity as every other, so the
        // graph analysis resolves the project its crawl belongs to.
        findUnique: jest.fn().mockResolvedValue({
          websiteId: 'site_1',
          website: { projectId: 'proj_1' },
        }),
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

  it('uses real extracted links from prisma.link instead of internalGraph spanning tree', async () => {
    mockPrisma.page.findMany.mockResolvedValue([
      { id: 'p1', url: 'https://example.com/', statusCode: 200, canonicalUrl: null, robotsMeta: null, pageType: 'HOME' },
      { id: 'p2', url: 'https://example.com/about', statusCode: 200, canonicalUrl: null, robotsMeta: null, pageType: 'ABOUT' },
      { id: 'p3', url: 'https://example.com/blog', statusCode: 200, canonicalUrl: null, robotsMeta: null, pageType: 'BLOG' },
    ]);
    // prisma.link has real edges: home -> about, about -> blog, blog -> home
    mockPrisma.link.findMany.mockResolvedValue([
      { sourcePage: { url: 'https://example.com/' }, targetUrl: 'https://example.com/about' },
      { sourcePage: { url: 'https://example.com/about' }, targetUrl: 'https://example.com/blog' },
      { sourcePage: { url: 'https://example.com/blog' }, targetUrl: 'https://example.com/' },
    ]);

    const report = await service.generateGraphReport('job_1');
    expect(mockPrisma.link.findMany).toHaveBeenCalled();
    expect(mockPrisma.internalGraph.findMany).not.toHaveBeenCalled();
    expect(report.totalEdges).toBe(3);
    expect(report.orphanPages).toEqual([]);
    // PageRank scores should be balanced and non-zero
    for (const node of report.nodes) {
      expect(node.linkEquityScore).toBeGreaterThan(0.5);
      expect(node.linkEquityScore).toBeLessThan(2.0);
    }
  });

  it('does not flag 404 or noindex pages as orphan pages', async () => {
    mockPrisma.page.findMany.mockResolvedValue([
      { id: 'p1', url: 'https://example.com/', statusCode: 200, canonicalUrl: null, robotsMeta: null, pageType: 'HOME' },
      { id: 'p2', url: 'https://example.com/deleted-page', statusCode: 404, canonicalUrl: null, robotsMeta: null, pageType: 'OTHER' },
      { id: 'p3', url: 'https://example.com/noindex-page', statusCode: 200, canonicalUrl: null, robotsMeta: 'noindex, follow', pageType: 'OTHER' },
    ]);
    mockPrisma.link.findMany.mockResolvedValue([]);
    mockPrisma.internalGraph.findMany.mockResolvedValue([]);

    const report = await service.generateGraphReport('job_1');
    expect(report.orphanPages).toEqual([]);
  });

  it('correctly anchors BFS from the homepage even if pages are returned out of order', async () => {
    mockPrisma.page.findMany.mockResolvedValue([
      { id: 'p2', url: 'https://example.com/deep/nested/page', statusCode: 200, canonicalUrl: null, robotsMeta: null, pageType: 'BLOG' },
      { id: 'p1', url: 'https://example.com/', statusCode: 200, canonicalUrl: null, robotsMeta: null, pageType: 'HOME' },
      { id: 'p3', url: 'https://example.com/direct-child', statusCode: 200, canonicalUrl: null, robotsMeta: null, pageType: 'CATEGORY' },
    ]);
    mockPrisma.link.findMany.mockResolvedValue([
      { sourcePage: { url: 'https://example.com/' }, targetUrl: 'https://example.com/direct-child' },
      { sourcePage: { url: 'https://example.com/direct-child' }, targetUrl: 'https://example.com/deep/nested/page' },
    ]);

    const report = await service.generateGraphReport('job_1');
    const homeNode = report.nodes.find((n) => n.url === 'https://example.com/');
    const childNode = report.nodes.find((n) => n.url === 'https://example.com/direct-child');
    const deepNode = report.nodes.find((n) => n.url === 'https://example.com/deep/nested/page');

    expect(homeNode?.crawlDepth).toBe(0);
    expect(childNode?.crawlDepth).toBe(1);
    expect(deepNode?.crawlDepth).toBe(2);
  });
});
