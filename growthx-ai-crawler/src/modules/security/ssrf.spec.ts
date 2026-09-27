import { blockedHostname, browserMayLoad, isPrivateAddress, publicAxios, safeLookup, SSRF_ERROR_CODE } from './ssrf';
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

  it('keeps the browser off internal hosts but lets it load public and inline resources', async () => {
    await expect(browserMayLoad('http://169.254.169.254/')).resolves.toBe(false);
    await expect(browserMayLoad('http://localhost:3000/')).resolves.toBe(false);
    await expect(browserMayLoad('https://8.8.8.8/')).resolves.toBe(true);
    await expect(browserMayLoad('data:text/plain,hi')).resolves.toBe(true);
  });
});
