import { Test, TestingModule } from '@nestjs/testing';
import { RobotsService, RobotsRules } from './robots.service';

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
