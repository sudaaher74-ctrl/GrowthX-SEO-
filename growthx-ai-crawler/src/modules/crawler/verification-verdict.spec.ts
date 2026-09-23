import { PageFacts, verdictFor } from './verification-verdict';
import { VerificationEngineService } from './verification-engine.service';

const page = (over: Partial<PageFacts> = {}): PageFacts => ({
  url: 'https://client.com/pricing',
  title: 'Pricing | Client',
  metaDescription: 'Plans and prices.',
  canonical: 'https://client.com/pricing',
  h1Count: 1,
  imagesMissingAlt: 0,
  metaRobots: null,
  schemaTypes: [],
  ...over,
});

describe('verdictFor', () => {
  it.each([
    ['MISSING_TITLE', { title: null }],
    ['LONG_TITLE', { title: 'x'.repeat(70) }],
    ['MISSING_META_DESCRIPTION', { metaDescription: null }],
    ['LONG_META_DESCRIPTION', { metaDescription: 'x'.repeat(161) }],
    ['NO_CANONICAL', { canonical: null }],
    ['CANONICAL_POINTS_ELSEWHERE', { canonical: 'https://other.com/' }],
    ['MISSING_H1', { h1Count: 0 }],
    ['MULTIPLE_H1', { h1Count: 3 }],
    ['MISSING_ALT_TEXT', { imagesMissingAlt: 2 }],
    ['META_ROBOTS_NOINDEX', { metaRobots: 'noindex, follow' }],
  ])('keeps %s open while the defect is still on the page', (type, facts) => {
    expect(verdictFor(type, page(facts)).status).toBe('FAILED');
  });

  it.each([
    'MISSING_TITLE',
    'LONG_TITLE',
    'MISSING_META_DESCRIPTION',
    'LONG_META_DESCRIPTION',
    'NO_CANONICAL',
    'CANONICAL_POINTS_ELSEWHERE',
    'MISSING_H1',
    'MULTIPLE_H1',
    'MISSING_ALT_TEXT',
    'META_ROBOTS_NOINDEX',
  ])('confirms %s once the page is fixed', (type) => {
    expect(verdictFor(type, page()).status).toBe('VERIFIED');
  });

  // The regression: META_ROBOTS_NOINDEX used to pass because the page had a
  // meta description, and anything unrecognised passed on a 200.
  it('does not confirm noindex removal from an unrelated meta tag', () => {
    expect(verdictFor('META_ROBOTS_NOINDEX', page({ metaRobots: 'noindex' })).status).toBe('FAILED');
  });

  it.each(['THIN_CONTENT', 'DUPLICATE_TITLE', 'BROKEN_IMAGE', 'SCHEMA_ERROR_MISSING_FIELD'])(
    'leaves %s for the next full crawl instead of guessing',
    (type) => {
      expect(verdictFor(type, page({ schemaTypes: ['Product'] })).status).toBe('PARTIAL');
    },
  );
});

describe('VerificationEngineService', () => {
  function build(html: string | Error, issueType = 'THIN_CONTENT') {
    const prisma: any = {
      website: {
        findFirst: jest.fn().mockResolvedValue({ id: 'w1', domain: 'client.com', url: 'https://client.com' }),
      },
      issue: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'i1',
            issueType,
            severity: 'HIGH',
            affectedUrl: 'https://client.com/pricing',
            description: 'd',
            recommendation: 'r',
            status: 'OPEN',
            evidence: null,
          },
        ]),
        updateMany: jest.fn(),
      },
      crawlJob: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
    };
    const fetcher: any = {
      fetchPage: jest.fn().mockImplementation(async (url: string) => {
        if (html instanceof Error) throw html;
        return { url, finalUrl: url, statusCode: 200, responseTimeMs: 120, html, redirectChain: [url], engine: 'cheerio' };
      }),
    };
    return { service: new VerificationEngineService(prisma, fetcher), prisma };
  }

  it('does not resolve an issue just because the page answered 200', async () => {
    const { service, prisma } = build('<html><head><title>Pricing</title></head><body>hi</body></html>');

    const cert = await service.runVerification('org', 'p1', { issueIds: ['i1'] });

    expect(cert.items[0].status).toBe('PARTIAL');
    expect(cert.status).not.toBe('PASSED');
    expect(prisma.issue.updateMany).not.toHaveBeenCalled();
  });

  it('records a failed fetch as a failure with no invented status or latency', async () => {
    const { service } = build(new Error('ECONNREFUSED'), 'MISSING_TITLE');

    const cert = await service.runVerification('org', 'p1', { issueIds: ['i1'] });

    expect(cert.items[0].status).toBe('FAILED');
    expect(cert.items[0].httpStatus).toBe(0);
    expect(cert.avgLatencyMs).toBe(0);
  });

  it('has no certificate to show until a verification has actually run', async () => {
    const { service } = build('<html></html>');

    await expect(service.getLatestCertificate('org', 'p1')).resolves.toBeNull();
  });
});
