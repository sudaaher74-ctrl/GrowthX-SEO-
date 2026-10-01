import { VerificationEngineService } from './verification-engine.service';

/**
 * The verifier takes issue ids and URLs from the request body. Both must be
 * confined to the project the route was authorised for.
 */
describe('VerificationEngineService — tenant scope', () => {
  function build() {
    const prisma: any = {
      website: {
        findFirst: jest.fn().mockResolvedValue({ id: 'w1', domain: 'mine.com', url: 'https://mine.com', project: {} }),
      },
      crawlJob: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn().mockResolvedValue({}) },
      issue: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        groupBy: jest.fn().mockResolvedValue([]),
      },
    };
    const fetcher: any = {
      fetch: jest.fn().mockResolvedValue({
        url: '',
        finalUrl: '',
        statusCode: 200,
        totalMs: 10,
        html: '<html><head><title>t</title></head><body></body></html>',
        statusChain: [],
      }),
      fetchPage: jest.fn().mockResolvedValue({
        url: '',
        finalUrl: '',
        statusCode: 200,
        responseTimeMs: 10,
        html: '<html><head><title>t</title></head><body></body></html>',
        redirectChain: [],
        engine: 'cheerio',
      }),
    };
    return { service: new VerificationEngineService(prisma, fetcher), prisma, fetcher };
  }

  it("only reads the project's own issues when ids are supplied", async () => {
    const { service, prisma } = build();
    await service.runVerification('org_1', 'p1', { issueIds: ['mine', 'theirs'] });

    expect(prisma.issue.findMany.mock.calls[0][0].where).toEqual({
      id: { in: ['mine', 'theirs'] },
      crawlJob: { website: { projectId: 'p1' } },
    });
  });

  it("only resolves issues that belong to the project", async () => {
    const { service, prisma } = build();
    prisma.issue.findMany.mockResolvedValue([
      {
        id: 'mine',
        issueType: 'MISSING_TITLE',
        severity: 'HIGH',
        affectedUrl: '/a',
        description: '',
        recommendation: '',
        status: 'OPEN',
        evidence: null,
      },
    ]);
    await service.runVerification('org_1', 'p1', { issueIds: ['mine'] });

    for (const call of prisma.issue.updateMany.mock.calls) {
      expect(call[0].where.crawlJob).toEqual({ website: { projectId: 'p1' } });
    }
  });

  it("never fetches a host other than the project's own site", async () => {
    const { service, fetcher } = build();
    await service.runVerification('org_1', 'p1', {
      urls: ['https://mine.com/a', 'https://www.mine.com/b', 'http://169.254.169.254/latest', 'https://rival.com/x'],
    });

    const callSource = fetcher.fetch.mock.calls.length ? fetcher.fetch : fetcher.fetchPage;
    const fetched = callSource.mock.calls.map((c: any[]) => c[0]);
    expect(fetched).toEqual(['https://mine.com/a', 'https://www.mine.com/b']);
  });

  it('falls back to the homepage when every supplied URL is foreign', async () => {
    const { service, fetcher } = build();
    await service.runVerification('org_1', 'p1', { urls: ['https://rival.com/x'] });

    const callSource = fetcher.fetch.mock.calls.length ? fetcher.fetch : fetcher.fetchPage;
    expect(callSource.mock.calls.map((c: any[]) => c[0])).toEqual(['https://mine.com']);
  });
});
