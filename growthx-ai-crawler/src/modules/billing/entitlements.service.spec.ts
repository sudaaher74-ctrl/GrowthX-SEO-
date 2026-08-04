import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { PlanType, SubscriptionStatus, UsageMetric } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { EntitlementsService } from './entitlements.service';
import { Feature } from './plans.catalog';

const DAY = 24 * 60 * 60 * 1000;

function subscription(overrides: Partial<any> = {}) {
  return {
    id: 'sub_1',
    organizationId: 'org_1',
    plan: PlanType.PRO,
    status: SubscriptionStatus.ACTIVE,
    currentPeriodStart: new Date(Date.now() - DAY),
    currentPeriodEnd: new Date(Date.now() + 29 * DAY),
    ...overrides,
  };
}

describe('EntitlementsService', () => {
  let service: EntitlementsService;
  let prisma: {
    subscription: { findUnique: jest.Mock };
    usageRecord: { findUnique: jest.Mock; findMany: jest.Mock; upsert: jest.Mock };
    website: { count: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      subscription: { findUnique: jest.fn().mockResolvedValue(null) },
      usageRecord: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
      },
      website: { count: jest.fn().mockResolvedValue(0) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [EntitlementsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(EntitlementsService);
  });

  describe('plan resolution', () => {
    it('falls back to FREE when the org has never subscribed', async () => {
      const { plan, active } = await service.resolvePlan('org_1');
      expect(plan).toBe(PlanType.FREE);
      expect(active).toBe(false);
    });

    it('serves the paid plan while the subscription is active', async () => {
      prisma.subscription.findUnique.mockResolvedValue(subscription());
      await expect(service.resolvePlan('org_1')).resolves.toMatchObject({ plan: PlanType.PRO, active: true });
    });

    it('drops to FREE when a charge has failed and the subscription halted', async () => {
      prisma.subscription.findUnique.mockResolvedValue(subscription({ status: SubscriptionStatus.HALTED }));
      await expect(service.resolvePlan('org_1')).resolves.toMatchObject({ plan: PlanType.FREE, active: false });
    });

    it('honours a mid-cycle cancellation until the paid period ends', async () => {
      prisma.subscription.findUnique.mockResolvedValue(
        subscription({ status: SubscriptionStatus.CANCELLED, currentPeriodEnd: new Date(Date.now() + 5 * DAY) }),
      );
      await expect(service.resolvePlan('org_1')).resolves.toMatchObject({ plan: PlanType.PRO, active: true });
    });

    it('drops to FREE once a cancelled subscription has run out', async () => {
      prisma.subscription.findUnique.mockResolvedValue(
        subscription({ status: SubscriptionStatus.CANCELLED, currentPeriodEnd: new Date(Date.now() - DAY) }),
      );
      await expect(service.resolvePlan('org_1')).resolves.toMatchObject({ plan: PlanType.FREE, active: false });
    });
  });

  describe('feature gating', () => {
    it('lets a Starter org run Gemini analysis', async () => {
      prisma.subscription.findUnique.mockResolvedValue(subscription({ plan: PlanType.STARTER }));
      await expect(service.assertFeature('org_1', Feature.MODEL_GEMINI)).resolves.toBeUndefined();
    });

    it('blocks Claude on Starter and names the upgrade', async () => {
      prisma.subscription.findUnique.mockResolvedValue(subscription({ plan: PlanType.STARTER }));

      await expect(service.assertFeature('org_1', Feature.MODEL_CLAUDE)).rejects.toThrow(ForbiddenException);

      const error = await service.assertFeature('org_1', Feature.MODEL_CLAUDE).catch((e) => e);
      expect(error.getResponse()).toMatchObject({
        error: 'FEATURE_NOT_IN_PLAN',
        currentPlan: PlanType.STARTER,
        upgradeTo: { plan: PlanType.PRO, price: '₹5,000' },
      });
    });

    it('blocks shipping fixes on Starter but allows it on Pro', async () => {
      prisma.subscription.findUnique.mockResolvedValue(subscription({ plan: PlanType.STARTER }));
      await expect(service.assertFeature('org_1', Feature.AUTO_FIX_DEPLOY)).rejects.toThrow(ForbiddenException);

      prisma.subscription.findUnique.mockResolvedValue(subscription({ plan: PlanType.PRO }));
      await expect(service.assertFeature('org_1', Feature.AUTO_FIX_DEPLOY)).resolves.toBeUndefined();
    });
  });

  describe('quotas', () => {
    it('allows work while under the allowance', async () => {
      prisma.subscription.findUnique.mockResolvedValue(subscription({ plan: PlanType.STARTER }));
      prisma.usageRecord.findUnique.mockResolvedValue({ used: 199 });

      await expect(service.checkQuota('org_1', UsageMetric.AI_ANALYSES)).resolves.toMatchObject({
        allowed: true,
        limit: 200,
        used: 199,
        remaining: 1,
      });
    });

    it('rejects the request that would exceed the allowance', async () => {
      prisma.subscription.findUnique.mockResolvedValue(subscription({ plan: PlanType.STARTER }));
      prisma.usageRecord.findUnique.mockResolvedValue({ used: 200 });

      const error = await service.assertQuota('org_1', UsageMetric.AI_ANALYSES).catch((e) => e);
      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error.getResponse()).toMatchObject({
        error: 'QUOTA_EXCEEDED',
        metric: UsageMetric.AI_ANALYSES,
        limit: 200,
        used: 200,
        upgradeTo: { plan: PlanType.PRO, limit: 1000 },
      });
    });

    it('never blocks an unlimited plan', async () => {
      prisma.subscription.findUnique.mockResolvedValue(subscription({ plan: PlanType.ENTERPRISE }));
      await expect(service.checkQuota('org_1', UsageMetric.CRAWL_PAGES, 1_000_000)).resolves.toMatchObject({
        allowed: true,
        limit: null,
      });
    });

    it('increments usage against the current billing period', async () => {
      const sub = subscription();
      prisma.subscription.findUnique.mockResolvedValue(sub);

      await service.recordUsage('org_1', UsageMetric.CRAWL_PAGES, 412);

      expect(prisma.usageRecord.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId_metric_periodStart: {
              organizationId: 'org_1',
              metric: UsageMetric.CRAWL_PAGES,
              periodStart: sub.currentPeriodStart,
            },
          },
          update: { used: { increment: 412 } },
        }),
      );
    });

    it('ignores non-positive usage', async () => {
      await service.recordUsage('org_1', UsageMetric.CRAWL_PAGES, 0);
      expect(prisma.usageRecord.upsert).not.toHaveBeenCalled();
    });
  });

  describe('billing period', () => {
    it('follows the Razorpay cycle when one is running', () => {
      const sub = subscription() as any;
      expect(service.billingPeriod(sub)).toEqual({
        periodStart: sub.currentPeriodStart,
        periodEnd: sub.currentPeriodEnd,
      });
    });

    it('falls back to the calendar month with no subscription', () => {
      const now = new Date('2026-08-04T12:00:00Z');
      expect(service.billingPeriod(null, now)).toEqual({
        periodStart: new Date('2026-08-01T00:00:00Z'),
        periodEnd: new Date('2026-09-01T00:00:00Z'),
      });
    });
  });

  describe('site limits', () => {
    it('blocks a second site on Starter', async () => {
      prisma.subscription.findUnique.mockResolvedValue(subscription({ plan: PlanType.STARTER }));
      prisma.website.count.mockResolvedValue(1);

      const error = await service.assertCanAddSite('org_1').catch((e) => e);
      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error.getResponse()).toMatchObject({ error: 'SITE_LIMIT_REACHED', limit: 1 });
    });

    it('allows up to three sites on Pro', async () => {
      prisma.subscription.findUnique.mockResolvedValue(subscription({ plan: PlanType.PRO }));
      prisma.website.count.mockResolvedValue(2);
      await expect(service.assertCanAddSite('org_1')).resolves.toBeUndefined();
    });
  });

  describe('getEntitlements', () => {
    it('reports plan, features, and remaining allowance together', async () => {
      prisma.subscription.findUnique.mockResolvedValue(subscription({ plan: PlanType.PRO }));
      prisma.usageRecord.findMany.mockResolvedValue([{ metric: UsageMetric.AI_ANALYSES, used: 40 }]);

      const result = await service.getEntitlements('org_1');

      expect(result.plan).toBe(PlanType.PRO);
      expect(result.subscriptionActive).toBe(true);
      expect(result.features).toContain(Feature.MODEL_CLAUDE);
      expect(result.quotas).toContainEqual({
        metric: UsageMetric.AI_ANALYSES,
        limit: 1000,
        used: 40,
        remaining: 960,
      });
    });
  });
});
