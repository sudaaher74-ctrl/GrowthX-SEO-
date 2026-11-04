import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WordPressCmsService } from './wordpress-cms.service';

describe('WordPressCmsService', () => {
  let service: WordPressCmsService;
  let prisma: any;
  let security: any;

  beforeEach(() => {
    prisma = {
      integration: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      integrationAuditEvent: {
        create: jest.fn(),
      },
      siteRepository: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      automationRun: {
        create: jest.fn(),
      },
      fixSnapshot: {
        createMany: jest.fn(),
      },
      fixImpactLedgerEvent: {
        create: jest.fn(),
      },
      growthOpportunity: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    security = {
      encryptCredentials: jest.fn((val: string) => `enc_${val}`),
      decryptCredentials: jest.fn((val: string) => val.replace(/^enc_/, '')),
    };

    service = new WordPressCmsService(prisma, security);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getConnection', () => {
    it('returns disconnected when no integration row exists', async () => {
      prisma.integration.findUnique.mockResolvedValue(null);
      const res = await service.getConnection('proj_1');
      expect(res.connected).toBe(false);
      expect(res.status).toBe('DISCONNECTED');
    });

    it('returns connection metadata without exposing the application password', async () => {
      prisma.integration.findUnique.mockResolvedValue({
        id: 'int_1',
        projectId: 'proj_1',
        provider: 'wordpress',
        accessToken: 'enc_secret_app_pass',
        googleAccountEmail: 'editor_user',
        grantedScopes: ['rankmath'],
        selectedResourceId: 'https://example-wp.com',
        selectedResourceName: 'Editor (editor_user)',
        status: 'CONNECTED',
        statusMessage: null,
        lastSyncedAt: new Date('2026-11-04T12:00:00Z'),
      });

      const res = await service.getConnection('proj_1');
      expect(res).toEqual({
        connected: true,
        siteUrl: 'https://example-wp.com',
        username: 'editor_user',
        displayName: 'Editor (editor_user)',
        seoPlugin: 'rankmath',
        status: 'CONNECTED',
        statusMessage: null,
        lastSyncedAt: '2026-11-04T12:00:00.000Z',
      });
      expect(JSON.stringify(res)).not.toContain('secret_app_pass');
    });
  });

  describe('connectWordPress', () => {
    it('verifies credentials against /wp-json/wp/v2/users/me and stores encrypted password', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch' as any).mockImplementation(async (url: any) => {
        if (String(url).includes('/users/me')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: 1, name: 'Site Admin', slug: 'admin' }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ namespaces: ['wp/v2', 'yoast/v1'] }),
        };
      });

      prisma.integration.upsert.mockResolvedValue({ id: 'int_wp_1' });

      const result = await service.connectWordPress('proj_1', {
        siteUrl: 'https://example-wp.com/wp-admin/',
        username: 'admin',
        appPassword: 'abcd efgh ijkl mnop',
      });

      expect(fetchSpy).toHaveBeenCalled();
      expect(result.connected).toBe(true);
      expect(result.siteUrl).toBe('https://example-wp.com');
      expect(result.seoPlugin).toBe('yoast');
      expect(security.encryptCredentials).toHaveBeenCalledWith('abcd efgh ijkl mnop');
      expect(prisma.integration.upsert).toHaveBeenCalled();
      expect(prisma.integrationAuditEvent.create).toHaveBeenCalled();
    });

    it('throws BadRequestException when WordPress returns 401', async () => {
      jest.spyOn(global, 'fetch' as any).mockResolvedValue({
        ok: false,
        status: 401,
      });

      await expect(
        service.connectWordPress('proj_1', {
          siteUrl: 'https://example-wp.com',
          username: 'admin',
          appPassword: 'wrong',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('stageWordPressFix', () => {
    it('stages a draft revision in WordPress and logs run, snapshots, and impact ledger event', async () => {
      prisma.integration.findUnique.mockResolvedValue({
        id: 'int_wp_1',
        projectId: 'proj_1',
        provider: 'wordpress',
        accessToken: 'enc_app_pass',
        googleAccountEmail: 'admin',
        selectedResourceId: 'https://example-wp.com',
        status: 'CONNECTED',
      });
      prisma.siteRepository.findUnique.mockResolvedValue({
        id: 'repo_wp_1',
        projectId: 'proj_1',
      });
      prisma.automationRun.create.mockResolvedValue({ id: 'run_wp_1' });

      jest.spyOn(global, 'fetch' as any).mockImplementation(async (url: any, init: any) => {
        if (init?.method === 'POST') {
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: 99, title: { raw: 'New SEO Title' } }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              id: 42,
              slug: 'services',
              title: { raw: 'Old Title' },
              excerpt: { raw: 'Old Excerpt' },
            },
          ],
        };
      });

      const res = await service.stageWordPressFix('proj_1', {
        findingId: 'finding_1',
        targetUrl: 'https://example-wp.com/services',
        field: 'META_TITLE',
        afterValue: 'New SEO Title',
        findingTitle: 'Improve Services Page Title',
        publishMode: 'draft',
      });

      expect(res.success).toBe(true);
      expect(res.wpPostId).toBe(42);
      expect(res.status).toBe('STAGED_IN_WORDPRESS');
      expect(prisma.automationRun.create).toHaveBeenCalled();
      expect(prisma.fixSnapshot.createMany).toHaveBeenCalled();
      expect(prisma.fixImpactLedgerEvent.create).toHaveBeenCalled();
    });

    it('throws NotFoundException when matching page is not found in WordPress', async () => {
      prisma.integration.findUnique.mockResolvedValue({
        id: 'int_wp_1',
        projectId: 'proj_1',
        provider: 'wordpress',
        accessToken: 'enc_app_pass',
        googleAccountEmail: 'admin',
        selectedResourceId: 'https://example-wp.com',
        status: 'CONNECTED',
      });

      jest.spyOn(global, 'fetch' as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      });

      await expect(
        service.stageWordPressFix('proj_1', {
          targetUrl: 'https://example-wp.com/non-existent',
          field: 'META_TITLE',
          afterValue: 'Title',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('verifyManualCmsFix', () => {
    it('verifies live HTML and records verified proof when expected text is present', async () => {
      prisma.siteRepository.findUnique.mockResolvedValue({
        id: 'repo_cms_1',
        projectId: 'proj_1',
      });
      prisma.automationRun.create.mockResolvedValue({ id: 'run_cms_1' });

      jest.spyOn(global, 'fetch' as any).mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          '<html><head><title>Updated Organic Title</title><meta name="description" content="Updated Meta Desc"></head><body></body></html>',
      });

      const res = await service.verifyManualCmsFix('proj_1', {
        findingId: 'finding_2',
        targetUrl: 'https://example-wp.com/about',
        field: 'META_TITLE',
        beforeValue: 'Old Title',
        expectedAfterValue: 'Updated Organic Title',
        platform: 'WordPress',
      });

      expect(res.verified).toBe(true);
      expect(res.detectedLiveValue).toBe('Updated Organic Title');
      expect(prisma.fixImpactLedgerEvent.create).toHaveBeenCalled();
    });
  });
});
