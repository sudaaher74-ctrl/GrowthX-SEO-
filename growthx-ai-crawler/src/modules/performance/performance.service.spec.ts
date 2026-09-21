import { Test, TestingModule } from '@nestjs/testing';
import { PerformanceService, PerformanceMetrics } from './performance.service';
import { PrismaService } from '../../database/prisma.service';
import axios from 'axios';
import { Page, Performance } from '@prisma/client';

jest.mock('axios');

describe('PerformanceService', () => {
  let service: PerformanceService;
  let mockPrisma: {
    performance: {
      upsert: jest.Mock;
    };
  };
  const mockedAxios = axios as jest.Mocked<typeof axios>;
  const originalApiKey = process.env.PAGESPEED_API_KEY;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.PAGESPEED_API_KEY = '';

    mockPrisma = {
      performance: {
        upsert: jest.fn().mockResolvedValue({}),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerformanceService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<PerformanceService>(PerformanceService);
  });

  afterEach(() => {
    process.env.PAGESPEED_API_KEY = originalApiKey;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should fetch and parse Google PageSpeed metrics and persist to database via upsert', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: {
        lighthouseResult: {
          categories: {
            performance: { score: 0.884 },
            accessibility: { score: 0.941 },
            'best-practices': { score: 0.908 },
            seo: { score: 0.976 },
          },
          audits: {
            'largest-contentful-paint': { numericValue: 1420.34 },
            'interaction-to-next-paint': { numericValue: 85.67 },
            'cumulative-layout-shift': { numericValue: 0.0234 },
          },
        },
      },
    } as any);

    const metrics: PerformanceMetrics = await service.fetchPageSpeedMetrics(
      'page_perf_123',
      'https://example.com/blog',
      'MOBILE',
    );

    expect(metrics.performanceScore).toBe(88);
    expect(metrics.accessibilityScore).toBe(94);
    expect(metrics.bestPracticesScore).toBe(91);
    expect(metrics.seoScore).toBe(98);
    expect(metrics.lcpMs).toBe(1420.3);
    expect(metrics.inpMs).toBe(85.7);
    expect(metrics.clsScore).toBe(0.023);
    expect(metrics.isSimulated).toBe(false);

    expect(mockPrisma.performance.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.performance.upsert).toHaveBeenCalledWith({
      where: { pageId: 'page_perf_123' },
      update: expect.objectContaining({
        performanceScore: 88,
        accessibilityScore: 94,
        bestPracticesScore: 91,
        seoScore: 98,
        lcpMs: 1420.3,
        inpMs: 85.7,
        clsScore: 0.023,
      }),
      create: expect.objectContaining({
        pageId: 'page_perf_123',
        performanceScore: 88,
        accessibilityScore: 94,
        bestPracticesScore: 91,
        seoScore: 98,
        lcpMs: 1420.3,
        inpMs: 85.7,
        clsScore: 0.023,
      }),
    });
  });

  it('should pass DESKTOP strategy parameter in API request', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: {
        lighthouseResult: {
          categories: { performance: { score: 0.95 } },
          audits: { 'largest-contentful-paint': { numericValue: 980.0 } },
        },
      },
    } as any);

    await service.fetchPageSpeedMetrics('page_1', 'https://example.com', 'DESKTOP');

    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('strategy=DESKTOP'),
      expect.any(Object),
    );
  });

  it('should include key parameter in request when PAGESPEED_API_KEY is configured', async () => {
    process.env.PAGESPEED_API_KEY = 'real_google_api_key_xyz';
    const keyedService = new PerformanceService(mockPrisma as any);

    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: {
        lighthouseResult: {
          categories: { performance: { score: 0.85 } },
          audits: { 'largest-contentful-paint': { numericValue: 1200 } },
        },
      },
    } as any);

    await keyedService.fetchPageSpeedMetrics('page_1', 'https://example.com');

    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('key=real_google_api_key_xyz'),
      expect.objectContaining({ timeout: 20000 }),
    );
  });

  it('should handle HTTP 429 quota exhaustion gracefully and record nothing', async () => {
    mockedAxios.get.mockRejectedValueOnce({
      response: { status: 429 },
    });

    const metrics = await service.fetchPageSpeedMetrics('page_123', 'https://example.com');

    expect(metrics).toEqual({});
    expect(mockPrisma.performance.upsert).not.toHaveBeenCalled();
  });

  it('should handle network errors gracefully without crashing or throwing', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('ETIMEDOUT connecting to googleapis.com'));

    const metrics = await service.fetchPageSpeedMetrics('page_123', 'https://example.com');

    expect(metrics).toEqual({});
    expect(mockPrisma.performance.upsert).not.toHaveBeenCalled();
  });

  it('should return empty metrics and skip database write when PageSpeed returns no usable categories or audits', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: {
        lighthouseResult: {
          categories: {},
          audits: {},
        },
      },
    } as any);

    const metrics = await service.fetchPageSpeedMetrics('page_123', 'https://example.com');

    expect(metrics).toEqual({});
    expect(mockPrisma.performance.upsert).not.toHaveBeenCalled();
  });

  it('should catch database upsert errors gracefully and still return the computed metrics', async () => {
    mockPrisma.performance.upsert.mockRejectedValueOnce(new Error('Postgres connection pool timeout'));

    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: {
        lighthouseResult: {
          categories: { performance: { score: 0.79 } },
          audits: { 'largest-contentful-paint': { numericValue: 2100.5 } },
        },
      },
    } as any);

    const metrics = await service.fetchPageSpeedMetrics('page_123', 'https://example.com');

    expect(metrics.performanceScore).toBe(79);
    expect(metrics.lcpMs).toBe(2100.5);
    expect(mockPrisma.performance.upsert).toHaveBeenCalled();
  });

  it('should invoke and integrate with underlying Performance and Page Prisma models', async () => {
    // Model invocation: verify relation between Page and Performance model structures
    const mockPage: Partial<Page> = {
      id: 'page_audit_perf_001',
      crawlJobId: 'job_perf_001',
      url: 'https://example.com/checkout',
      finalUrl: 'https://example.com/checkout',
      statusCode: 200,
    };

    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: {
        lighthouseResult: {
          categories: {
            performance: { score: 0.92 },
            accessibility: { score: 0.98 },
            'best-practices': { score: 0.95 },
            seo: { score: 1.0 },
          },
          audits: {
            'largest-contentful-paint': { numericValue: 1100.2 },
            'interaction-to-next-paint': { numericValue: 45.0 },
            'cumulative-layout-shift': { numericValue: 0.005 },
          },
        },
      },
    } as any);

    mockPrisma.performance.upsert.mockImplementation(({ create }: any) => {
      const persistedRecord: Partial<Performance> = {
        id: 'perf_record_001',
        pageId: create.pageId,
        performanceScore: create.performanceScore,
        accessibilityScore: create.accessibilityScore,
        bestPracticesScore: create.bestPracticesScore,
        seoScore: create.seoScore,
        lcpMs: create.lcpMs,
        inpMs: create.inpMs,
        clsScore: create.clsScore,
        fetchedAt: new Date(),
      };
      return Promise.resolve(persistedRecord);
    });

    const metrics = await service.fetchPageSpeedMetrics(mockPage.id!, mockPage.url!);

    expect(metrics.performanceScore).toBe(92);
    expect(metrics.seoScore).toBe(100);
    expect(metrics.lcpMs).toBe(1100.2);

    expect(mockPrisma.performance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pageId: mockPage.id },
        create: expect.objectContaining({
          pageId: mockPage.id,
          performanceScore: 92,
          seoScore: 100,
        }),
      }),
    );
  });
});
