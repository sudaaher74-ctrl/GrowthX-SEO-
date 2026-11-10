import { HttpException, HttpStatus } from '@nestjs/common';
import { SubscriptionQuotaService, PLAN_LIMITS } from './subscription-quota.service';

describe('SubscriptionQuotaService', () => {
  let service: SubscriptionQuotaService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
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

  describe('resolveTier', () => {
    it('defaults to founder_free when header is missing', () => {
      expect(service.resolveTier({})).toBe('founder_free');
      expect(service.resolveTier({ headers: {} })).toBe('founder_free');
    });

    it('resolves valid tiers correctly', () => {
      expect(service.resolveTier({ headers: { 'x-subscription-tier': 'growth' } })).toBe('growth');
      expect(service.resolveTier({ headers: { 'x-subscription-tier': 'agency' } })).toBe('agency');
      expect(service.resolveTier({ headers: { 'x-subscription-tier': 'starter' } })).toBe('starter');
      expect(service.resolveTier({ headers: { 'x-subscription-tier': 'founder_free' } })).toBe('founder_free');
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

