import axios from 'axios';
import { FetcherService } from './fetcher.service';
import { MetricsService } from '../observability/metrics.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/** A page with enough real text that it is not mistaken for an unrendered SPA. */
const REAL_PAGE = `<html><body><h1>Winter jackets</h1><p>${'word '.repeat(60)}</p></body></html>`;

function metricsStub(): MetricsService {
  return {
    pageFetchDurationSeconds: { observe: jest.fn() },
    pagesCrawledTotal: { inc: jest.fn() },
  } as unknown as MetricsService;
}

function response(overrides: Record<string, any> = {}) {
  return {
    status: 200,
    headers: { 'content-type': 'text/html' },
    data: REAL_PAGE,
    request: {},
    ...overrides,
  };
}

describe('FetcherService', () => {
  let service: FetcherService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FetcherService(metricsStub());
    // Playwright is never initialised in these tests; the service must cope
    // with it being unavailable rather than assuming a browser exists.
    (service as any).ensurePlaywrightInitialized = jest.fn().mockResolvedValue(false);
  });

  describe('SSRF protection', () => {
    // The crawler fetches URLs supplied by customers. Without this, a customer
    // could point it at the metadata endpoint or another service on our network
    // and read the response back out of the crawl results.
    it.each([
      ['localhost', 'http://localhost:3000/admin'],
      ['loopback', 'http://127.0.0.1/secrets'],
      ['private 10.x', 'http://10.0.0.5/internal'],
      ['private 192.168.x', 'http://192.168.1.1/router'],
      ['private 172.x', 'http://172.16.0.1/'],
      ['link-local metadata', 'http://169.254.169.254/latest/meta-data/'],
    ])('refuses to fetch %s', async (_label, url) => {
      const result = await service.fetchPage(url);

      expect(result.statusCode).toBe(403);
      expect(result.errorMessage).toContain('SSRF');
      expect(result.html).toBe('');
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('refuses a malformed URL rather than passing it to the HTTP client', async () => {
      const result = await service.fetchPage('not a url');

      expect(result.statusCode).toBe(403);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('allows a normal public URL', async () => {
      mockedAxios.get.mockResolvedValue(response());

      const result = await service.fetchPage('https://example.com/pricing');

      expect(result.statusCode).toBe(200);
      expect(mockedAxios.get).toHaveBeenCalled();
    });
  });

  describe('retries', () => {
    it('retries a 429 and returns the eventual success', async () => {
      mockedAxios.get
        .mockResolvedValueOnce(response({ status: 429 }))
        .mockResolvedValueOnce(response({ status: 200 }));

      const result = await service.fetchPage('https://example.com/');

      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      expect(result.statusCode).toBe(200);
    });

    it.each([500, 502, 503, 504])('retries a transient %i', async (status) => {
      mockedAxios.get
        .mockResolvedValueOnce(response({ status }))
        .mockResolvedValueOnce(response({ status: 200 }));

      const result = await service.fetchPage('https://example.com/');

      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      expect(result.statusCode).toBe(200);
    });

    // A 404 is a real answer about the page, not a transient failure — retrying
    // it would trip rate limits on sites with many dead links.
    it('does not retry a 404', async () => {
      mockedAxios.get.mockResolvedValue(response({ status: 404, data: '' }));

      const result = await service.fetchPage('https://example.com/missing');

      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      expect(result.statusCode).toBe(404);
    });

    it('gives up after repeated failures and reports the error', async () => {
      mockedAxios.get.mockRejectedValue(new Error('ECONNRESET'));

      const result = await service.fetchPage('https://example.com/');

      expect(mockedAxios.get).toHaveBeenCalledTimes(3);
      expect(result.statusCode).toBe(500);
      expect(result.errorMessage).toContain('ECONNRESET');
    });

    it('does not fall back to a fabricated page when the fetch fails', async () => {
      mockedAxios.get.mockRejectedValue(new Error('DNS failure'));

      const result = await service.fetchPage('https://example.com/');

      expect(result.html).toBe('');
    });
  });

  describe('redirects', () => {
    it('records the final URL and the chain that led to it', async () => {
      mockedAxios.get.mockResolvedValue(
        response({ request: { res: { responseUrl: 'https://example.com/final' } } }),
      );

      const result = await service.fetchPage('https://example.com/start');

      expect(result.finalUrl).toBe('https://example.com/final');
      expect(result.redirectChain).toEqual(['https://example.com/start', 'https://example.com/final']);
    });

    it('does not duplicate the URL when there was no redirect', async () => {
      mockedAxios.get.mockResolvedValue(
        response({ request: { res: { responseUrl: 'https://example.com/same' } } }),
      );

      const result = await service.fetchPage('https://example.com/same');

      expect(result.redirectChain).toEqual(['https://example.com/same']);
    });
  });

  describe('response handling', () => {
    it('reports the content type and engine used', async () => {
      mockedAxios.get.mockResolvedValue(response());

      const result = await service.fetchPage('https://example.com/');

      expect(result.contentType).toContain('text/html');
      expect(result.engine).toBe('cheerio');
    });

    it('treats a non-string body as empty html rather than coercing it', async () => {
      mockedAxios.get.mockResolvedValue(response({ data: Buffer.from('binary'), status: 200 }));

      const result = await service.fetchPage('https://example.com/file.pdf');

      expect(result.html).toBe('');
    });

    it('measures response time', async () => {
      mockedAxios.get.mockResolvedValue(response());

      const result = await service.fetchPage('https://example.com/');

      expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('single-page-app detection', () => {
    const needsRendering = (html: string) => (service as any).needsDynamicRendering(html);

    it('flags an empty React root as needing rendering', () => {
      expect(needsRendering('<html><body><div id="root"></div></body></html>')).toBe(true);
    });

    it('flags an empty Vue mount point', () => {
      expect(needsRendering('<html><body><div id="app"></div></body></html>')).toBe(true);
    });

    it('flags a suspiciously short response', () => {
      expect(needsRendering('<html></html>')).toBe(true);
    });

    // The expensive path is Playwright; a server-rendered page must not take it.
    it('does not flag a page that already has content', () => {
      expect(needsRendering(REAL_PAGE)).toBe(false);
    });

    it('does not flag a populated root element', () => {
      const html = `<html><body><div id="root"><h1>Real</h1><p>${'word '.repeat(60)}</p></div></body></html>`;

      expect(needsRendering(html)).toBe(false);
    });

    it('returns the static result when Playwright is unavailable', async () => {
      mockedAxios.get.mockResolvedValue(
        response({ data: '<html><body><div id="root"></div></body></html>' }),
      );

      const result = await service.fetchPage('https://example.com/spa');

      // Playwright stub returns false, so the static HTML is returned rather
      // than the request failing outright.
      expect(result.engine).toBe('cheerio');
      expect(result.statusCode).toBe(200);
    });
  });
});
