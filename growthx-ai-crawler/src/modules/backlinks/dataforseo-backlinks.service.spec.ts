import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  DataForSeoBacklinksError,
  DataForSeoBacklinksService,
  DATAFORSEO_NOT_CONFIGURED_MSG,
} from './dataforseo-backlinks.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('DataForSeoBacklinksService', () => {
  let service: DataForSeoBacklinksService;
  let configService: any;

  beforeEach(async () => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'DATAFORSEO_LOGIN') return 'test_dfs_login';
        if (key === 'DATAFORSEO_PASSWORD') return 'test_dfs_password';
        if (key === 'DATAFORSEO_AUTH_HEADER') return 'Basic dGVzdF9kZnNfbG9naW46dGVzdF9kZnNfcGFzc3dvcmQ=';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataForSeoBacklinksService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<DataForSeoBacklinksService>(DataForSeoBacklinksService);
    jest.clearAllMocks();
  });

  describe('Authentication & Configuration', () => {
    it('returns true for isConfigured when auth header is provided', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('returns true when login and password are provided without auth header', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'DATAFORSEO_LOGIN') return 'valid_user';
        if (key === 'DATAFORSEO_PASSWORD') return 'valid_pass';
        return undefined;
      });
      expect(service.isConfigured()).toBe(true);
    });

    it('throws DataForSeoBacklinksError when not configured', async () => {
      configService.get.mockReturnValue(undefined);
      expect(service.isConfigured()).toBe(false);

      await expect(service.getDomainSummary('example.com')).rejects.toThrow(
        DATAFORSEO_NOT_CONFIGURED_MSG,
      );
    });
  });

  describe('Error Handling', () => {
    it('handles 40104 account verification error with helpful guidance', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          status_code: 40104,
          status_message: 'Please verify your account before using the API.',
        },
      });

      await expect(service.getDomainSummary('example.com')).rejects.toThrow(
        /DataForSEO account verification required/,
      );
    });

    it('handles 401 authentication rejection error', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        status: 401,
        data: {
          status_code: 40100,
          status_message: 'Invalid credentials',
        },
      });

      await expect(service.getDomainSummary('example.com')).rejects.toThrow(
        /DataForSEO authentication rejected/,
      );
    });

    it('handles 402 out of balance error', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        status: 402,
        data: {
          status_code: 40200,
          status_message: 'Insufficient balance',
        },
      });

      await expect(service.getDomainSummary('example.com')).rejects.toThrow(
        /DataForSEO account has insufficient balance/,
      );
    });

    it('handles task level failure error', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          status_code: 20000,
          tasks: [
            {
              status_code: 40500,
              status_message: 'Target domain not valid',
            },
          ],
        },
      });

      await expect(service.getDomainSummary('example.com')).rejects.toThrow(
        /DataForSEO task failed \(40500\)/,
      );
    });
  });

  describe('Core API Endpoints', () => {
    it('fetches target domain summary overview successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          status_code: 20000,
          cost: 0.02,
          tasks: [
            {
              status_code: 20000,
              cost: 0.02,
              result: [
                {
                  target: 'example.com',
                  rank: 450,
                  backlinks: 12500,
                  crawled_pages: 820,
                  referring_domains: 340,
                  referring_main_domains: 310,
                  referring_ips: 280,
                  referring_subnets: 190,
                  referring_pages: 5600,
                  broken_backlinks: 12,
                  broken_pages: 3,
                  backlinks_spam_score: 8,
                  referring_links_attributes: {
                    dofollow: 9800,
                    nofollow: 2700,
                  },
                  referring_links_tld: {
                    com: 8500,
                    org: 2100,
                    in: 1900,
                  },
                },
              ],
            },
          ],
        },
      });

      const summary = await service.getDomainSummary('example.com');
      expect(summary.target).toBe('example.com');
      expect(summary.rank).toBe(450);
      expect(summary.backlinks).toBe(12500);
      expect(summary.referringDomains).toBe(340);
      expect(summary.dofollow).toBe(9800);
      expect(summary.nofollow).toBe(2700);
      expect(summary.referringLinksTld.com).toBe(8500);
      expect(summary.costUsd).toBe(0.02);
    });

    it('fetches backlinks list with anchor texts and attributes', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          status_code: 20000,
          tasks: [
            {
              status_code: 20000,
              result: [
                {
                  total_count: 1,
                  items: [
                    {
                      url_from: 'https://techblog.com/review',
                      url_to: 'https://example.com/product',
                      domain_from: 'techblog.com',
                      tld_from: 'com',
                      anchor: 'Organic Milk Delivery',
                      dofollow: true,
                      rank: 512,
                      page_from_rank: 42,
                      domain_from_rank: 68,
                      backlink_spam_score: 5,
                      first_seen: '2026-01-15T10:00:00Z',
                      last_seen: '2026-10-25T14:00:00Z',
                      is_broken: false,
                      is_new: false,
                      is_lost: false,
                      type: 'anchor',
                    },
                  ],
                },
              ],
            },
          ],
        },
      });

      const res = await service.getBacklinks('example.com', { limit: 10 });
      expect(res.items).toHaveLength(1);
      const link = res.items[0];
      expect(link.urlFrom).toBe('https://techblog.com/review');
      expect(link.anchor).toBe('Organic Milk Delivery');
      expect(link.dofollow).toBe(true);
      expect(link.rank).toBe(512);
      expect(link.firstSeen).toBe('2026-01-15T10:00:00Z');
    });

    it('fetches referring domains list', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          status_code: 20000,
          tasks: [
            {
              status_code: 20000,
              result: [
                {
                  total_count: 2,
                  items: [
                    {
                      domain: 'dairyportal.in',
                      rank: 610,
                      backlinks: 85,
                      referring_links_attributes: { dofollow: 70 },
                      first_seen: '2026-02-01T00:00:00Z',
                      backlinks_spam_score: 3,
                      broken_backlinks: 0,
                    },
                  ],
                },
              ],
            },
          ],
        },
      });

      const res = await service.getReferringDomains('example.com');
      expect(res.items).toHaveLength(1);
      expect(res.items[0].domain).toBe('dairyportal.in');
      expect(res.items[0].rank).toBe(610);
      expect(res.items[0].dofollowBacklinks).toBe(70);
    });

    it('fetches anchor text analysis', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          status_code: 20000,
          tasks: [
            {
              status_code: 20000,
              result: [
                {
                  total_count: 2,
                  items: [
                    {
                      anchor: 'fresh milk farm',
                      backlinks: 140,
                      referring_domains: 25,
                      referring_pages: 90,
                      first_seen: '2026-01-10T00:00:00Z',
                      last_seen: '2026-10-30T00:00:00Z',
                    },
                  ],
                },
              ],
            },
          ],
        },
      });

      const res = await service.getAnchors('example.com');
      expect(res.items).toHaveLength(1);
      expect(res.items[0].anchor).toBe('fresh milk farm');
      expect(res.items[0].backlinks).toBe(140);
      expect(res.items[0].referringDomains).toBe(25);
    });

    it('supports task queue post and get patterns', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          status_code: 20000,
          tasks: [{ id: 'task_xyz_123', status_code: 20000 }],
        },
      });

      const postRes = await service.postTask('/backlinks/summary', [{ target: 'example.com' }]);
      expect(postRes.taskId).toBe('task_xyz_123');

      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          status_code: 20000,
          tasks: [{ id: 'task_xyz_123', status_code: 20000, result: [{ target: 'example.com' }] }],
        },
      });

      const getRes = await service.getTaskResult('/backlinks/summary', 'task_xyz_123');
      expect(getRes.result.target).toBe('example.com');
    });
  });
});
