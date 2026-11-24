import {
  blockedHostname,
  browserMayLoad,
  handleBrowserPublicRoute,
  isPrivateAddress,
  publicAxios,
  ResponseTooLargeError,
  safeLookup,
  safePublicFetch,
  SSRF_ERROR_CODE,
} from './ssrf';
import { SecurityService } from './security.service';
import { FetchService } from '../crawler/fetch/fetch.service';
import { startFixtureServer, FixtureServer } from '../crawler/testing/fixture-server';

/**
 * The crawler fetches URLs customers choose, and follows wherever their sites
 * redirect. These tests run with the loopback exemption the rest of the suite
 * uses switched off, so the guard behaves as it does in production.
 */
describe('SSRF guard', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    delete process.env.ALLOW_PRIVATE_CRAWL_TARGETS;
    delete process.env.SSRF_ALLOWED_HOSTS;
    for (const key of ['HTTPS_PROXY', 'HTTP_PROXY', 'https_proxy', 'http_proxy']) delete process.env[key];
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  describe('isPrivateAddress', () => {
    it.each([
      '127.0.0.1',
      '10.1.2.3',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254', // cloud metadata
      '100.64.0.1',
      '0.0.0.0',
      '224.0.0.1',
      '255.255.255.255',
      '::',
      '::1',
      'fd00::1',
      'fe80::1',
      '::ffff:127.0.0.1', // IPv4-mapped
      '::ffff:a9fe:a9fe', // 169.254.169.254, mapped and written in hex
      '64:ff9b::a9fe:a9fe', // NAT64 of the metadata address
      '[::1]',
    ])('refuses %s', (ip) => {
      expect(isPrivateAddress(ip)).toBe(true);
    });

    it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '100.128.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8'])('allows %s', (ip) => {
      expect(isPrivateAddress(ip)).toBe(false);
    });
  });

  describe('blockedHostname', () => {
    it('refuses internal names and literal internal addresses without a lookup', () => {
      for (const host of ['localhost', 'LOCALHOST.', 'db.internal', 'printer.local', '169.254.169.254', '[::1]']) {
        expect(blockedHostname(host)).toBeDefined();
      }
      expect(blockedHostname('example.com')).toBeUndefined();
      expect(blockedHostname('8.8.8.8')).toBeUndefined();
    });

    it('lets an operator allow a specific host, and the configured proxy', () => {
      process.env.SSRF_ALLOWED_HOSTS = '10.0.0.5';
      process.env.HTTPS_PROXY = 'http://proxy.internal:8080';
      expect(blockedHostname('10.0.0.5')).toBeUndefined();
      expect(blockedHostname('proxy.internal')).toBeUndefined();
      expect(blockedHostname('10.0.0.6')).toBeDefined();
    });

    it('stays open for the test fixtures when explicitly allowed', () => {
      process.env.ALLOW_PRIVATE_CRAWL_TARGETS = 'true';
      expect(blockedHostname('127.0.0.1')).toBeUndefined();
    });
  });

  it('refuses a public-looking name at lookup time when it resolves to an internal address', (done) => {
    // "localhost" resolves to loopback: the lookup itself must refuse it.
    safeLookup('localhost', {}, (err) => {
      expect((err as any)?.code).toBe(SSRF_ERROR_CODE);
      done();
    });
  });

  describe('publicAxios', () => {
    let server: FixtureServer | undefined;
    afterEach(async () => {
      await server?.close();
      server = undefined;
    });

    it('refuses a literal internal address before sending anything', async () => {
      server = await startFixtureServer({ '/': { body: 'secret' } });

      await expect(publicAxios.get(server.url('/'))).rejects.toMatchObject({ code: SSRF_ERROR_CODE });
      expect(server.requests).toHaveLength(0);
    });

    it('refuses a redirect to the cloud metadata address', async () => {
      server = await startFixtureServer({
        '/start': { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } },
      });
      // The starting host is allowed here only so the fixture can serve the redirect.
      process.env.SSRF_ALLOWED_HOSTS = '127.0.0.1';

      await expect(publicAxios.get(server.url('/start'), { timeout: 5000 })).rejects.toMatchObject({ code: SSRF_ERROR_CODE });
    });

    it('refuses a redirect to a name that resolves to loopback', async () => {
      server = await startFixtureServer({
        '/start': { status: 302, headers: { location: 'http://localhost:1/admin' } },
      });
      process.env.SSRF_ALLOWED_HOSTS = '127.0.0.1';

      await expect(publicAxios.get(server.url('/start'), { timeout: 5000 })).rejects.toMatchObject({ code: SSRF_ERROR_CODE });
    });
  });

  describe('the crawler', () => {
    let server: FixtureServer | undefined;
    afterEach(async () => {
      await server?.close();
      server = undefined;
    });

    it('checks every redirect hop, not only the first URL', async () => {
      server = await startFixtureServer({
        '/': { status: 301, headers: { location: 'http://169.254.169.254/latest/meta-data/iam/' } },
      });
      process.env.SSRF_ALLOWED_HOSTS = '127.0.0.1';
      const fetcher = new FetchService({} as any);

      const outcome = await fetcher.fetch(server.url('/'), { timeoutMs: 5000 });

      expect(outcome.error?.kind).toBe('ssrf');
    });
  });

  it('keeps the browser off internal hosts, fails closed on DNS errors, and allows inline resources', async () => {
    await expect(browserMayLoad('http://169.254.169.254/')).resolves.toBe(false);
    await expect(browserMayLoad('http://localhost:3000/')).resolves.toBe(false);
    await expect(browserMayLoad('http://metadata.google.internal/computeMetadata/v1/')).resolves.toBe(false);
    await expect(browserMayLoad('ws://example.com/socket')).resolves.toBe(false);
    // Unresolvable host must fail CLOSED (false), never open.
    await expect(browserMayLoad('https://nonexistent.invalid.example.test/')).resolves.toBe(false);
    await expect(browserMayLoad('https://8.8.8.8/')).resolves.toBe(true);
    await expect(browserMayLoad('data:text/plain,hi')).resolves.toBe(true);
  });

  describe('safePublicFetch connection-time controls (HTTP client)', () => {
    let server: FixtureServer | undefined;
    afterEach(async () => {
      await server?.close();
      server = undefined;
    });

    it('blocks private/loopback/metadata destinations before connecting and on redirects', async () => {
      server = await startFixtureServer({
        '/': { body: 'internal secret' },
        '/redirect-meta': { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } },
      });

      await expect(safePublicFetch(server.url('/'))).rejects.toMatchObject({ code: SSRF_ERROR_CODE });
      expect(server.requests).toHaveLength(0);

      process.env.SSRF_ALLOWED_HOSTS = '127.0.0.1';
      await expect(safePublicFetch(server.url('/redirect-meta'))).rejects.toMatchObject({ code: SSRF_ERROR_CODE });
    });

    it('enforces hard response size limits and timeouts', async () => {
      server = await startFixtureServer({
        '/huge': { body: 'A'.repeat(4096) },
      });
      process.env.SSRF_ALLOWED_HOSTS = '127.0.0.1';

      await expect(
        safePublicFetch(server.url('/huge'), { maxBytes: 512, timeoutMs: 5000 }),
      ).rejects.toBeInstanceOf(ResponseTooLargeError);
    });

    it('blocks domain ownership verification against private or metadata addresses without connecting', async () => {
      server = await startFixtureServer({
        '/': { body: '<meta name="growthx-verification" content="tok123">' },
      });
      process.env.ENCRYPTION_KEY = 'a'.repeat(64);
      const sec = new SecurityService();

      const verified = await sec.verifyDomainOwnership(new URL(server.url('/')).host, 'tok123');
      expect(verified).toBe(false);
      expect(server.requests).toHaveLength(0);
    });
  });

  describe('handleBrowserPublicRoute (Chromium egress controls)', () => {
    let server: FixtureServer | undefined;
    afterEach(async () => {
      await server?.close();
      server = undefined;
    });

    it('aborts internal, metadata, and non-HTTP schemes in browser routes without contacting them', async () => {
      for (const badUrl of [
        'http://127.0.0.1:8080/admin',
        'http://169.254.169.254/latest/meta-data/',
        'http://metadata.google.internal/',
        'ws://127.0.0.1:3000/socket.io',
        'file:///etc/passwd',
      ]) {
        const abort = jest.fn().mockResolvedValue(undefined);
        const fulfill = jest.fn().mockResolvedValue(undefined);
        const cont = jest.fn().mockResolvedValue(undefined);
        await handleBrowserPublicRoute({
          request: () => ({ url: () => badUrl, method: () => 'GET', headers: () => ({}), resourceType: () => 'document' }),
          abort,
          fulfill,
          continue: cont,
        });
        expect(abort).toHaveBeenCalledWith('blockedbyclient');
        expect(fulfill).not.toHaveBeenCalled();
        expect(cont).not.toHaveBeenCalled();
      }
    });

    it('fulfills allowed browser requests through connection-time safePublicFetch and aborts redirects to metadata', async () => {
      server = await startFixtureServer({
        '/ok': { body: '<html><title>Public</title></html>', headers: { 'content-type': 'text/html' } },
        '/evil-redir': { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } },
      });
      process.env.SSRF_ALLOWED_HOSTS = '127.0.0.1';

      const okFulfill = jest.fn().mockResolvedValue(undefined);
      const okAbort = jest.fn().mockResolvedValue(undefined);
      await handleBrowserPublicRoute({
        request: () => ({ url: () => server!.url('/ok'), method: () => 'GET', headers: () => ({}), resourceType: () => 'document' }),
        abort: okAbort,
        fulfill: okFulfill,
        continue: jest.fn(),
      });
      expect(okAbort).not.toHaveBeenCalled();
      expect(okFulfill).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));

      const redirFulfill = jest.fn().mockResolvedValue(undefined);
      const redirAbort = jest.fn().mockResolvedValue(undefined);
      await handleBrowserPublicRoute({
        request: () => ({ url: () => server!.url('/evil-redir'), method: () => 'GET', headers: () => ({}), resourceType: () => 'document' }),
        abort: redirAbort,
        fulfill: redirFulfill,
        continue: jest.fn(),
      });
      expect(redirAbort).toHaveBeenCalledWith('blockedbyclient');
      expect(redirFulfill).not.toHaveBeenCalled();
    });

    it('aborts third-party analytics/ad trackers without hitting the network when blockTrackers is enabled, while fulfilling first-party scripts', async () => {
      server = await startFixtureServer({
        '/app.js': { body: 'console.log("app");', headers: { 'content-type': 'application/javascript' } },
      });
      process.env.SSRF_ALLOWED_HOSTS = '127.0.0.1';

      const trackerAbort = jest.fn().mockResolvedValue(undefined);
      const trackerFulfill = jest.fn().mockResolvedValue(undefined);
      await handleBrowserPublicRoute(
        {
          request: () => ({
            url: () => 'https://www.googletagmanager.com/gtm.js?id=GTM-123',
            method: () => 'GET',
            headers: () => ({}),
            resourceType: () => 'script',
          }),
          abort: trackerAbort,
          fulfill: trackerFulfill,
          continue: jest.fn(),
        },
        { blockTrackers: true, targetHost: '127.0.0.1' },
      );
      expect(trackerAbort).toHaveBeenCalled();
      expect(trackerFulfill).not.toHaveBeenCalled();

      const appAbort = jest.fn().mockResolvedValue(undefined);
      const appFulfill = jest.fn().mockResolvedValue(undefined);
      await handleBrowserPublicRoute(
        {
          request: () => ({
            url: () => server!.url('/app.js'),
            method: () => 'GET',
            headers: () => ({}),
            resourceType: () => 'script',
          }),
          abort: appAbort,
          fulfill: appFulfill,
          continue: jest.fn(),
        },
        { blockTrackers: true, targetHost: new URL(server.url('/')).host },
      );
      expect(appAbort).not.toHaveBeenCalled();
      expect(appFulfill).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });
  });
});
