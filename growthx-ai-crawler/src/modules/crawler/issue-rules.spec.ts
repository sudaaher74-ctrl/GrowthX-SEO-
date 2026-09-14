import { evaluatePage, evaluateSite } from './issue-rules';
import { FetchOutcome } from './fetch/fetch.service';
import { FetchError } from './fetch/fetch-error';
import { extractPage } from './page-extract';
import { computeIndexability } from './indexability';
import { contentFingerprint } from './frontier/duplicate-clusters';

const url = 'https://www.example.com/';

function outcome(over: Partial<FetchOutcome> = {}): FetchOutcome {
  return {
    url,
    finalUrl: url,
    statusCode: 200,
    statusChain: [{ url, status: 200 }],
    headers: {},
    rawHtml: '',
    html: '',
    jsRequired: false,
    escalationReasons: [],
    blockedSuspected: false,
    totalMs: 10,
    tier: 'static',
    ...over,
  };
}

const goodPage = `<!doctype html><html lang="en"><head>
<title>A perfectly ordinary page about archery coaching</title>
<meta name="description" content="${'x'.repeat(140)}">
<link rel="canonical" href="${url}">
</head><body><main><h1>Archery</h1><p>${'word '.repeat(400)}</p></main></body></html>`;

describe('page rules', () => {
  describe('cascade suppression', () => {
    // The defect the screenshot showed: one phantom 403 produced five findings,
    // four of which were artefacts of a body that was never received.
    it('emits exactly one finding when the fetch failed', () => {
      const findings = evaluatePage({
        url,
        fetch: outcome({ statusCode: undefined, tier: 'failed', error: new FetchError('dns', 'getaddrinfo ENOTFOUND') }),
        indexability: computeIndexability({ pageUrl: url, fetchFailed: true }),
        isHomepage: true,
        inSitemap: true,
      });

      expect(findings).toHaveLength(1);
      expect(findings[0].id).toBe('FETCH_FAILED');
      expect(findings.map((f) => f.id)).not.toContain('MISSING_TITLE');
      expect(findings.map((f) => f.id)).not.toContain('MISSING_H1');
    });

    it('names the failure kind rather than blaming the site', () => {
      const findings = evaluatePage({
        url,
        fetch: outcome({ statusCode: undefined, tier: 'failed', error: new FetchError('proxy', 'our gateway failed') }),
        indexability: computeIndexability({ pageUrl: url, fetchFailed: true }),
        isHomepage: true,
        inSitemap: true,
      });

      expect(findings[0].evidence).toContain('proxy');
      expect(findings[0].explanation).toContain('not a statement about the page itself');
    });

    it('emits exactly one finding when a block is suspected', () => {
      const findings = evaluatePage({
        url,
        fetch: outcome({ statusCode: 403, blockedSuspected: true, blockedEvidence: 'HTTP 403, server=cloudfront' }),
        indexability: computeIndexability({ pageUrl: url, statusCode: 403, robotsTxtAllows: true }),
        isHomepage: true,
        inSitemap: true,
      });

      expect(findings).toHaveLength(1);
      expect(findings[0].id).toBe('FETCH_BLOCKED_SUSPECTED');
      expect(findings[0].confidence).toBe('LIKELY');
      expect(findings[0].evidence).toContain('cloudfront');
    });

    it('does not raise content findings against a 4xx page', () => {
      const findings = evaluatePage({
        url,
        fetch: outcome({ statusCode: 404 }),
        extracted: extractPage('', url),
        indexability: computeIndexability({ pageUrl: url, statusCode: 404, robotsTxtAllows: true }),
        isHomepage: false,
        inSitemap: true,
      });

      expect(findings.map((f) => f.id)).toEqual(['BROKEN_PAGE_4XX']);
    });
  });

  describe('JS_RENDER_REQUIRED', () => {
    it('quotes the raw-versus-rendered difference as its evidence', () => {
      const findings = evaluatePage({
        url,
        fetch: outcome({
          tier: 'rendered',
          jsRequired: true,
          renderDiff: {
            rawWordCount: 0,
            renderedWordCount: 427,
            rawLinkCount: 0,
            renderedLinkCount: 11,
            rawTitle: 'AURA | Premium Archery Academy',
            renderedTitle: 'Best Archery Academy New Panvel',
            fingerprints: ['vite-asset-bundle', 'vite-favicon'],
          },
        }),
        extracted: extractPage(goodPage, url),
        indexability: computeIndexability({ pageUrl: url, statusCode: 200, robotsTxtAllows: true }),
        isHomepage: true,
        inSitemap: true,
      });

      const js = findings.find((f) => f.id === 'JS_RENDER_REQUIRED')!;
      expect(js).toBeDefined();
      expect(js.evidence).toContain('0 words, 0 links');
      expect(js.evidence).toContain('427 words, 11 links');
      expect(js.evidence).toContain('AURA | Premium Archery Academy');
      expect(js.evidence).toContain('vite-asset-bundle');
    });

    it('explains the impact in terms of AI answer engines, not just Google', () => {
      const findings = evaluatePage({
        url,
        fetch: outcome({
          tier: 'rendered',
          jsRequired: true,
          renderDiff: { rawWordCount: 0, renderedWordCount: 427, rawLinkCount: 0, renderedLinkCount: 11, fingerprints: [] },
        }),
        extracted: extractPage(goodPage, url),
        indexability: computeIndexability({ pageUrl: url, statusCode: 200, robotsTxtAllows: true }),
        isHomepage: true,
        inSitemap: true,
      });

      const js = findings.find((f) => f.id === 'JS_RENDER_REQUIRED')!;
      expect(js.impact).toMatch(/GPTBot/);
      expect(js.impact).toMatch(/PerplexityBot/);
      expect(js.impact).toMatch(/ClaudeBot/);
    });

    it('is not raised for a page the origin already serves complete', () => {
      const findings = evaluatePage({
        url,
        fetch: outcome(),
        extracted: extractPage(goodPage, url),
        indexability: computeIndexability({ pageUrl: url, statusCode: 200, robotsTxtAllows: true }),
        isHomepage: true,
        inSitemap: true,
      });

      expect(findings.map((f) => f.id)).not.toContain('JS_RENDER_REQUIRED');
    });
  });

  it('raises NO_CANONICAL when the page declares none', () => {
    const noCanonical = goodPage.replace(`<link rel="canonical" href="${url}">`, '');
    const findings = evaluatePage({
      url,
      fetch: outcome(),
      extracted: extractPage(noCanonical, url),
      indexability: computeIndexability({ pageUrl: url, statusCode: 200, robotsTxtAllows: true }),
      isHomepage: true,
      inSitemap: true,
    });

    const finding = findings.find((f) => f.id === 'NO_CANONICAL')!;
    expect(finding).toBeDefined();
    expect(finding.recommendation).toContain(url);
  });

  it('treats a cross-domain canonical as critical and says so', () => {
    const html = goodPage.replace(`href="${url}"`, 'href="https://someone-else.com/"');
    const findings = evaluatePage({
      url,
      fetch: outcome(),
      extracted: extractPage(html, url),
      indexability: computeIndexability({ pageUrl: url, statusCode: 200, robotsTxtAllows: true, canonicalUrl: 'https://someone-else.com/' }),
      isHomepage: true,
      inSitemap: true,
    });

    const finding = findings.find((f) => f.id === 'CANONICAL_POINTS_ELSEWHERE')!;
    expect(finding.severity).toBe('CRITICAL');
    expect(finding.evidence).toContain('someone-else.com');
  });

  it('raises noindex from an X-Robots-Tag header with no meta tag on the page', () => {
    const findings = evaluatePage({
      url,
      fetch: outcome({ headers: { 'x-robots-tag': 'noindex' } }),
      extracted: extractPage(goodPage, url),
      indexability: computeIndexability({ pageUrl: url, statusCode: 200, robotsTxtAllows: true, xRobotsTag: 'noindex' }),
      isHomepage: true,
      inSitemap: true,
    });

    const finding = findings.find((f) => f.id === 'NOINDEX_DETECTED')!;
    expect(finding.evidence).toBe('X-Robots-Tag: noindex');
    expect(finding.sourceField).toBe('fetch.headers.x-robots-tag');
  });

  it('does not report thin content for a page that is part of a duplicate cluster', () => {
    const thin = `<html><head><title>Short page about things</title></head><body><main><h1>Hi</h1><p>Only a few words here.</p></main></body></html>`;
    const withCluster = evaluatePage({
      url,
      fetch: outcome(),
      extracted: extractPage(thin, url),
      indexability: computeIndexability({ pageUrl: url, statusCode: 200, robotsTxtAllows: true }),
      isHomepage: true,
      inSitemap: true,
      duplicateCluster: { contentHash: 'abc', urls: [url, 'https://www.example.com/copy'] },
    });
    const without = evaluatePage({
      url,
      fetch: outcome(),
      extracted: extractPage(thin, url),
      indexability: computeIndexability({ pageUrl: url, statusCode: 200, robotsTxtAllows: true }),
      isHomepage: true,
      inSitemap: true,
    });

    expect(withCluster.map((f) => f.id)).not.toContain('THIN_CONTENT');
    expect(without.map((f) => f.id)).toContain('THIN_CONTENT');
  });

  it('gives every finding evidence and a source field', () => {
    const findings = evaluatePage({
      url,
      fetch: outcome(),
      extracted: extractPage('<html><body><p>tiny</p></body></html>', url),
      indexability: computeIndexability({ pageUrl: url, statusCode: 200, robotsTxtAllows: true }),
      isHomepage: true,
      inSitemap: true,
    });

    expect(findings.length).toBeGreaterThan(0);
    for (const finding of findings) {
      expect(finding.evidence).toBeTruthy();
      expect(finding.sourceField).toBeTruthy();
      expect(finding.confidence).toBeTruthy();
    }
  });

  it('calls a tidy apex-to-www-to-https chain zero findings', () => {
    const findings = evaluatePage({
      url,
      fetch: outcome({
        statusChain: [
          { url: 'http://example.com/', status: 301, location: 'https://example.com/' },
          { url: 'https://example.com/', status: 301, location: 'https://www.example.com/' },
          { url, status: 200 },
        ],
      }),
      extracted: extractPage(goodPage, url),
      indexability: computeIndexability({ pageUrl: url, statusCode: 200, robotsTxtAllows: true }),
      isHomepage: true,
      inSitemap: true,
    });

    expect(findings.map((f) => f.id)).not.toContain('REDIRECT_CHAIN');
    expect(findings).toHaveLength(0);
  });
});

describe('site rules', () => {
  it('raises SITEMAP_WRONG_DOMAIN as critical, naming both domains', () => {
    const findings = evaluateSite({
      siteUrl: 'https://www.dronaarchery.com/',
      sitemapFindings: [
        {
          kind: 'WRONG_DOMAIN',
          sitemapUrl: 'https://www.dronaarchery.com/sitemap.xml',
          foreignDomain: 'deonaarcheryacademy.com',
          sampleUrls: ['https://deonaarcheryacademy.com/'],
          evidence: '5 of 5 URLs are on deonaarcheryacademy.com',
        },
      ],
      duplicateClusters: [],
      deadSitemapUrls: [],
    });

    const finding = findings.find((f) => f.id === 'SITEMAP_WRONG_DOMAIN')!;
    expect(finding.severity).toBe('CRITICAL');
    expect(finding.description).toContain('deonaarcheryacademy.com');
    expect(finding.description).toContain('dronaarchery.com');
  });

  it('raises SITEMAP_DEAD_URLS listing what failed and why', () => {
    const findings = evaluateSite({
      siteUrl: 'https://e.com/',
      sitemapFindings: [],
      duplicateClusters: [],
      deadSitemapUrls: [
        { url: 'https://e.com/gone', status: 404, reason: 'HTTP 404' },
        { url: 'https://e.com/broken', reason: 'dns: ENOTFOUND' },
      ],
    });

    const finding = findings.find((f) => f.id === 'SITEMAP_DEAD_URLS')!;
    expect(finding.evidence).toContain('https://e.com/gone - HTTP 404');
    expect(finding.evidence).toContain('dns: ENOTFOUND');
  });

  it('reports one duplicate cluster rather than one finding per copy', () => {
    const hash = contentFingerprint('the same page twice');
    const findings = evaluateSite({
      siteUrl: 'https://e.com/',
      sitemapFindings: [],
      duplicateClusters: [{ contentHash: hash, urls: ['https://e.com/a', 'https://e.com/b'] }],
      deadSitemapUrls: [],
    });

    const duplicates = findings.filter((f) => f.id === 'DUPLICATE_CONTENT');
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].evidence).toBe('https://e.com/a, https://e.com/b');
  });
});
