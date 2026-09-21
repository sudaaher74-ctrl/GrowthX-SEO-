import { Test, TestingModule } from '@nestjs/testing';
import { SitemapService, SitemapResult } from './sitemap.service';
import axios from 'axios';
import { Page, Website, CrawlJob, JobStatus } from '@prisma/client';

jest.mock('axios');

describe('SitemapService', () => {
  let service: SitemapService;
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [SitemapService],
    }).compile();

    service = module.get<SitemapService>(SitemapService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should discover and parse a standard XML sitemap (<urlset>)', async () => {
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>https://example.com/</loc>
          <lastmod>2026-03-01T12:00:00Z</lastmod>
          <changefreq>daily</changefreq>
          <priority>1.0</priority>
        </url>
        <url>
          <loc>https://example.com/pricing</loc>
          <lastmod>2026-02-15T08:30:00Z</lastmod>
          <changefreq>monthly</changefreq>
          <priority>0.8</priority>
        </url>
        <url>
          <loc>https://example.com/about</loc>
        </url>
      </urlset>`;

    mockedAxios.get.mockImplementation((url: string) => {
      if (url === 'https://example.com/sitemap.xml') {
        return Promise.resolve({ data: sitemapXml } as any);
      }
      return Promise.reject(new Error('Not found'));
    });

    const result = await service.discoverAndParseSitemaps('https://example.com');

    expect(result.sitemapsDiscovered).toContain('https://example.com/sitemap.xml');
    expect(result.urls).toHaveLength(3);

    const home = result.urls.find((u) => u.loc === 'https://example.com/');
    expect(home).toBeDefined();
    expect(home?.lastmod).toBe('2026-03-01T12:00:00Z');
    expect(home?.changefreq).toBe('daily');
    expect(home?.priority).toBe(1.0);

    const pricing = result.urls.find((u) => u.loc === 'https://example.com/pricing');
    expect(pricing).toBeDefined();
    expect(pricing?.priority).toBe(0.8);

    const about = result.urls.find((u) => u.loc === 'https://example.com/about');
    expect(about).toBeDefined();
    expect(about?.priority).toBeUndefined();
  });

  it('should recursively discover and parse child sitemaps from a <sitemapindex>', async () => {
    const sitemapIndexXml = `<?xml version="1.0" encoding="UTF-8"?>
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap>
          <loc>https://example.com/pages-sitemap.xml</loc>
        </sitemap>
        <sitemap>
          <loc>https://example.com/posts-sitemap.xml</loc>
        </sitemap>
      </sitemapindex>`;

    const pagesSitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/page-1</loc></url>
        <url><loc>https://example.com/page-2</loc></url>
      </urlset>`;

    const postsSitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/post-1</loc></url>
        <url><loc>https://example.com/post-2</loc></url>
      </urlset>`;

    mockedAxios.get.mockImplementation((url: string) => {
      if (url === 'https://example.com/sitemap.xml') {
        return Promise.resolve({ data: sitemapIndexXml } as any);
      }
      if (url === 'https://example.com/pages-sitemap.xml') {
        return Promise.resolve({ data: pagesSitemapXml } as any);
      }
      if (url === 'https://example.com/posts-sitemap.xml') {
        return Promise.resolve({ data: postsSitemapXml } as any);
      }
      return Promise.reject(new Error('404 Not Found'));
    });

    const result = await service.discoverAndParseSitemaps('https://example.com');

    expect(result.sitemapsDiscovered).toEqual([
      'https://example.com/sitemap.xml',
      'https://example.com/pages-sitemap.xml',
      'https://example.com/posts-sitemap.xml',
    ]);
    expect(result.urls).toHaveLength(4);
    const locs = result.urls.map((u) => u.loc);
    expect(locs).toContain('https://example.com/page-1');
    expect(locs).toContain('https://example.com/page-2');
    expect(locs).toContain('https://example.com/post-1');
    expect(locs).toContain('https://example.com/post-2');
  });

  it('should parse Google image and video sitemap extensions', async () => {
    const richSitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
              xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
              xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
        <url>
          <loc>https://example.com/product-showcase</loc>
          <image:image>
            <image:loc>https://example.com/images/hero.webp</image:loc>
            <image:title>GrowthX Hero Image</image:title>
            <image:caption>Platform Overview</image:caption>
          </image:image>
          <image:image>
            <image:loc>https://example.com/images/badge.png</image:loc>
          </image:image>
          <video:video>
            <video:title>Product Tour Demo</video:title>
            <video:thumbnail_loc>https://example.com/thumbs/demo.jpg</video:thumbnail_loc>
            <video:description>An in-depth video tour of GrowthX features</video:description>
          </video:video>
        </url>
      </urlset>`;

    mockedAxios.get.mockImplementation((url: string) => {
      if (url === 'https://example.com/sitemap.xml') {
        return Promise.resolve({ data: richSitemapXml } as any);
      }
      return Promise.reject(new Error('Not found'));
    });

    const result = await service.discoverAndParseSitemaps('https://example.com');

    expect(result.urls).toHaveLength(1);
    const entry = result.urls[0];
    expect(entry.loc).toBe('https://example.com/product-showcase');

    expect(entry.images).toHaveLength(2);
    expect(entry.images![0]).toEqual({
      loc: 'https://example.com/images/hero.webp',
      title: 'GrowthX Hero Image',
      caption: 'Platform Overview',
    });
    expect(entry.images![1]).toEqual({
      loc: 'https://example.com/images/badge.png',
      title: undefined,
      caption: undefined,
    });

    expect(entry.videos).toHaveLength(1);
    expect(entry.videos![0]).toEqual({
      title: 'Product Tour Demo',
      thumbnail_loc: 'https://example.com/thumbs/demo.jpg',
      description: 'An in-depth video tour of GrowthX features',
    });
  });

  it('should deduplicate identical URLs discovered across multiple sitemaps', async () => {
    const sitemap1 = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/duplicate-page</loc><priority>0.5</priority></url>
        <url><loc>https://example.com/page-unique-1</loc></url>
      </urlset>`;

    const sitemap2 = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/duplicate-page</loc><priority>0.9</priority></url>
        <url><loc>https://example.com/page-unique-2</loc></url>
      </urlset>`;

    mockedAxios.get.mockImplementation((url: string) => {
      if (url === 'https://example.com/sitemap.xml') {
        return Promise.resolve({ data: sitemap1 } as any);
      }
      if (url === 'https://example.com/sitemap_index.xml') {
        return Promise.resolve({ data: sitemap2 } as any);
      }
      return Promise.reject(new Error('Not found'));
    });

    const result = await service.discoverAndParseSitemaps('https://example.com');

    expect(result.urls).toHaveLength(3);
    const dupCount = result.urls.filter((u) => u.loc === 'https://example.com/duplicate-page').length;
    expect(dupCount).toBe(1);
  });

  it('should process user-provided knownSitemapUrls along with default candidates', async () => {
    const customSitemap = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/custom-section/item-1</loc></url>
      </urlset>`;

    mockedAxios.get.mockImplementation((url: string) => {
      if (url === 'https://example.com/custom/sitemap-feed.xml') {
        return Promise.resolve({ data: customSitemap } as any);
      }
      return Promise.reject(new Error('Not found'));
    });

    const result = await service.discoverAndParseSitemaps('example.com', [
      'https://example.com/custom/sitemap-feed.xml',
    ]);

    expect(result.sitemapsDiscovered).toContain('https://example.com/custom/sitemap-feed.xml');
    expect(result.urls).toHaveLength(1);
    expect(result.urls[0].loc).toBe('https://example.com/custom-section/item-1');
  });

  it('should handle 404 or network errors gracefully without crashing or throwing', async () => {
    mockedAxios.get.mockRejectedValue(new Error('getaddrinfo ENOTFOUND sitemap-host.invalid'));

    const result = await service.discoverAndParseSitemaps('https://sitemap-host.invalid');

    expect(result.sitemapsDiscovered).toEqual([]);
    expect(result.urls).toEqual([]);
  });

  it('should ignore non-string or empty sitemap response data', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: null,
    } as any);

    const result = await service.discoverAndParseSitemaps('https://example.com');

    expect(result.sitemapsDiscovered).toEqual([]);
    expect(result.urls).toEqual([]);
  });

  it('should prevent circular loops and enforce max depth limit of 5', async () => {
    // Sitemap A points to B, B points to A (circular loop)
    const sitemapA = `<?xml version="1.0" encoding="UTF-8"?>
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>https://example.com/sitemap-b.xml</loc></sitemap>
      </sitemapindex>`;

    const sitemapB = `<?xml version="1.0" encoding="UTF-8"?>
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>https://example.com/sitemap-a.xml</loc></sitemap>
      </sitemapindex>`;

    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('sitemap.xml') || url.includes('sitemap-a.xml')) {
        return Promise.resolve({ data: sitemapA } as any);
      }
      if (url.includes('sitemap-b.xml')) {
        return Promise.resolve({ data: sitemapB } as any);
      }
      return Promise.reject(new Error('404'));
    });

    const result = await service.discoverAndParseSitemaps('https://example.com');
    expect(result.sitemapsDiscovered.length).toBeLessThanOrEqual(5);
  });

  it('should invoke and integrate with underlying Website, CrawlJob, and Page Prisma models', async () => {
    // Model invocation: simulate discovering sitemap URLs during a CrawlJob
    const mockWebsite: Partial<Website> = {
      id: 'web_sitemap_test',
      domain: 'sitemap-model.com',
      url: 'https://sitemap-model.com',
    };

    const mockJob: Partial<CrawlJob> = {
      id: 'job_sitemap_test',
      websiteId: mockWebsite.id!,
      status: JobStatus.RUNNING,
      pagesCrawled: 0,
      pagesDiscovered: 0,
    };

    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://sitemap-model.com/docs</loc><priority>0.8</priority></url>
        <url><loc>https://sitemap-model.com/blog</loc><priority>0.6</priority></url>
      </urlset>`;

    mockedAxios.get.mockResolvedValueOnce({
      data: sitemapXml,
    } as any);

    const sitemapResult: SitemapResult = await service.discoverAndParseSitemaps(mockWebsite.domain!);

    // Transform discovered entries into candidate Prisma Page models
    const candidatePages: Partial<Page>[] = sitemapResult.urls.map((entry) => ({
      id: `page_${entry.loc.split('/').pop()}`,
      crawlJobId: mockJob.id!,
      url: entry.loc,
      finalUrl: entry.loc,
      statusCode: 0,
      responseTimeMs: 0,
      discoverySource: 'sitemap',
      indexability: 'UNKNOWN',
      pageType: 'OTHER',
    }));

    mockJob.pagesDiscovered = candidatePages.length;

    expect(candidatePages).toHaveLength(2);
    expect(candidatePages[0].crawlJobId).toBe(mockJob.id);
    expect(candidatePages[0].discoverySource).toBe('sitemap');
    expect(candidatePages[0].indexability).toBe('UNKNOWN');
    expect(candidatePages[0].url).toBe('https://sitemap-model.com/docs');
    expect(mockJob.pagesDiscovered).toBe(2);
  });
});
