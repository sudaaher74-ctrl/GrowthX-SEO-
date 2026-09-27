import { Test, TestingModule } from '@nestjs/testing';
import { RobotsService, RobotsRules } from './robots.service';
import { startFixtureServer, FixtureServer } from '../crawler/testing/fixture-server';

describe('RobotsService', () => {
  let service: RobotsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RobotsService],
    }).compile();

    service = module.get<RobotsService>(RobotsService);
  });

  it('should evaluate allowed and disallowed paths correctly', async () => {
    const mockRules: RobotsRules = {
      exists: true,
      allowedPaths: ['/public/'],
      disallowedPaths: ['/admin/', '/private/'],
      sitemapLocations: ['https://example.com/sitemap.xml'],
      crawlDelayMs: 1000,
    };

    jest.spyOn(service, 'fetchRobotsRules').mockResolvedValue(mockRules);

    const allowedAdmin = await service.isUrlAllowed('https://example.com/admin/dashboard');
    expect(allowedAdmin).toBe(false);

    const allowedPublic = await service.isUrlAllowed('https://example.com/public/article');
    expect(allowedPublic).toBe(true);
  });
});

/**
 * A site that answers every path with a page answers /robots.txt with one too.
 * Its markup is not a set of directives, and reading it as one could only
 * produce rules nobody wrote.
 */
describe('RobotsService — an HTML page at /robots.txt', () => {
  let server: FixtureServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it('is treated as no robots.txt', async () => {
    server = await startFixtureServer({
      '*': { body: '<!doctype html><html><body><p>Disallow: /</p></body></html>' },
    });
    const robots = new RobotsService();

    const rules = await robots.fetchRobotsRules(server.origin);

    expect(rules.exists).toBe(false);
    expect(rules.disallowedPaths).toEqual([]);
    await expect(robots.isUrlAllowed(server.url('/anything'))).resolves.toBe(true);
  });

  it('does not stop a real robots.txt from being read', async () => {
    server = await startFixtureServer({
      '/robots.txt': { headers: { 'content-type': 'text/plain' }, body: 'User-agent: *\nDisallow: /admin\n' },
    });

    const rules = await new RobotsService().fetchRobotsRules(server.origin);

    expect(rules.exists).toBe(true);
    expect(rules.disallowedPaths).toContain('/admin');
  });
});
