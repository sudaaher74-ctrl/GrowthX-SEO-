import * as cheerio from 'cheerio';
import { HtmlExtractorService } from '../extractor/html-extractor.service';
import { computeIndexability } from './indexability';
import { IssueEngineService } from '../issues/issue-engine.service';

describe('crawl evidence integrity', () => {
  const extractor = new HtmlExtractorService();
  it('retains conflicting canonicals and treats indexability as unknown', () => {
    const data = extractor.extract(cheerio.load('<link rel="canonical" href="/"><link rel="canonical" href="/local">'), 'https://example.com/local');
    expect(data.canonicalUrls).toEqual(['https://example.com/', 'https://example.com/local']);
    expect(computeIndexability({ statusCode: 200, robotsTxtAllows: true, pageUrl: 'https://example.com/local', ...data }).indexability).toBe('UNKNOWN');
  });
  it('does not treat duplicate identical canonicals as conflicting', () => {
    expect(computeIndexability({ statusCode: 200, robotsTxtAllows: true, pageUrl: 'https://example.com/', canonicalUrl: 'https://example.com/', canonicalUrls: ['https://example.com/', 'https://example.com/'] }).indexability).toBe('INDEXABLE');
  });
  it('does not claim indexability when rendering was unavailable', () => {
    expect(computeIndexability({ statusCode: 200, robotsTxtAllows: true, pageUrl: 'https://example.com/', renderUnavailable: true }).indexability).toBe('UNKNOWN');
  });
  it('preserves an observed noindex even when rendering fails', () => {
    expect(computeIndexability({ statusCode: 200, robotsTxtAllows: true, pageUrl: 'https://example.com/', renderUnavailable: true, metaRobots: 'noindex' }).indexability).toBe('NOT_INDEXABLE');
  });
  it.each(['/login', '/app/cart', '/account/settings'])('does not prescribe search copy or sitemap inclusion for %s', async path => {
    const prisma = { issue: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) }, page: { findFirst: jest.fn().mockResolvedValue(null) }, crawlJob: { update: jest.fn().mockResolvedValue({}) } };
    const engine = new IssueEngineService(prisma as any);
    const $ = cheerio.load('<html><title>Account</title><h1>Account</h1></html>');
    const data = extractor.extract($, `https://example.com${path}`);
    const issues = await engine.evaluateAndPersistIssues('job', 'project', 'site', 'page', `https://example.com${path}`, 200, [], $.html(), $, data, [], { internalCount: 1, externalCount: 0, brokenAnchors: [], nofollowLinks: [] } as any, { wordCount: 5, headingStructureErrors: [] } as any, [], false, true);
    expect(issues.some(i => ['THIN_CONTENT', 'NOT_IN_SITEMAP'].includes(i.issueType))).toBe(false);
  });
});
