import { HttpException, HttpStatus } from '@nestjs/common';
import { SubscriptionQuotaService, PLAN_LIMITS } from './subscription-quota.service';

describe('SubscriptionQuotaService', () => {
  let service: SubscriptionQuotaService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      organization: {
        findUnique: jest.fn(),
      },
      project: {
        findUnique: jest.fn(),
      },
      website: {
        findFirst: jest.fn(),
        count: jest.fn(),
      },
      competitorDomain: {
        count: jest.fn(),
      },
      aiVisibilityJourney: {
        count: jest.fn(),
      },
    };
    service = new SubscriptionQuotaService(prisma);
  });

  describe('server-owned tier resolution (Medium #15)', () => {
    it('resolves tier exclusively from Organization.subscriptionTier in PostgreSQL', async () => {
      prisma.organization.findUnique.mockResolvedValueOnce({ subscriptionTier: 'growth' });
      await expect(service.resolveTierForOrganization('org-1')).resolves.toBe('growth');
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        select: { subscriptionTier: true },
      });

      prisma.organization.findUnique.mockResolvedValueOnce({ subscriptionTier: 'agency' });
      await expect(service.resolveTierForOrganization('org-2')).resolves.toBe('agency');
    });

    it('defaults to founder_free when organization is missing or has an unknown tier', async () => {
      prisma.organization.findUnique.mockResolvedValueOnce(null);
      await expect(service.resolveTierForOrganization('org-missing')).resolves.toBe('founder_free');

      prisma.organization.findUnique.mockResolvedValueOnce({ subscriptionTier: 'enterprise_forged' });
      await expect(service.resolveTierForOrganization('org-weird')).resolves.toBe('founder_free');
    });

    it('resolves project tier from its owning organization record', async () => {
      prisma.project.findUnique.mockResolvedValueOnce({
        organization: { subscriptionTier: 'starter' },
      });
      await expect(service.resolveTierForProject('proj-1')).resolves.toBe('starter');
    });

    it('does not expose any header-based tier resolver', () => {
      expect((service as any).resolveTier).toBeUndefined();
    });
  });

  describe('assertWebsiteQuota', () => {
    it('allows website when under plan quota', async () => {
      prisma.website.findFirst.mockResolvedValue(null);
      prisma.website.count.mockResolvedValue(0);

      await expect(service.assertWebsiteQuota('org-1', 'founder_free')).resolves.not.toThrow();
    });

    it('allows updating an existing website without consuming additional slot', async () => {
      prisma.website.findFirst.mockResolvedValue({ id: 'existing-id' });

      await expect(
        service.assertWebsiteQuota('org-1', 'founder_free', 'example.com'),
      ).resolves.not.toThrow();
      expect(prisma.website.count).not.toHaveBeenCalled();
    });

    it('throws PAYMENT_REQUIRED when website count reaches tier limit', async () => {
      prisma.website.findFirst.mockResolvedValue(null);
      prisma.website.count.mockResolvedValue(1);

      await expect(service.assertWebsiteQuota('org-1', 'founder_free')).rejects.toThrow(
        HttpException,
      );
      try {
        await service.assertWebsiteQuota('org-1', 'founder_free');
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
        expect(err.getResponse()).toMatchObject({
          error: 'QUOTA_EXCEEDED',
          metric: 'websites',
          limit: 1,
        });
      }
    });
  });

  describe('clampCrawlPageLimit', () => {
    it('defaults to tier max crawl pages when not requested', () => {
      expect(service.clampCrawlPageLimit(undefined, 'starter')).toBe(5000);
      expect(service.clampCrawlPageLimit(undefined, 'growth')).toBe(25000);
      expect(service.clampCrawlPageLimit(undefined, 'agency')).toBe(100000);
    });

    it('clamps requested pages if exceeding tier allowance', () => {
      expect(service.clampCrawlPageLimit(50000, 'starter')).toBe(5000);
      expect(service.clampCrawlPageLimit(1000, 'starter')).toBe(1000);
    });
  });

  describe('assertCompetitorQuota', () => {
    it('allows adding competitor when under limit', async () => {
      prisma.competitorDomain.count.mockResolvedValue(2);
      await expect(service.assertCompetitorQuota('proj-1', 'founder_free')).resolves.not.toThrow();
    });

    it('throws when at competitor limit', async () => {
      prisma.competitorDomain.count.mockResolvedValue(5);
      await expect(service.assertCompetitorQuota('proj-1', 'founder_free')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('assertAiVisibilityQuota', () => {
    it('allows run when under monthly allowance', async () => {
      prisma.aiVisibilityJourney.count.mockResolvedValue(1);
      await expect(service.assertAiVisibilityQuota('proj-1', 'starter')).resolves.not.toThrow();
    });

    it('throws when monthly audit cycles are exhausted', async () => {
      prisma.aiVisibilityJourney.count.mockResolvedValue(2);
      await expect(service.assertAiVisibilityQuota('proj-1', 'starter')).rejects.toThrow(
        HttpException,
      );
    });
  });
});

