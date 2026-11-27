import {
  AdminCostEngineService,
  classifyProfitability,
  estimateModelCostUsd,
} from './admin-cost-engine.service';

describe('AdminCostEngineService', () => {
  it('estimates fallback LLM cost accurately when recorded cost is null and flags unpriced unknown models', () => {
    // Recorded cost wins
    expect(estimateModelCostUsd('gpt-4o', 100_000, 50_000, 0.42)).toEqual({
      costUsd: 0.42,
      priced: true,
    });
    // Gemini 2.5 Flash fallback: 1M in ($0.15) + 1M out ($0.60) = $0.75
    expect(estimateModelCostUsd('gemini-2.5-flash', 1_000_000, 1_000_000, null)).toEqual({
      costUsd: 0.75,
      priced: true,
    });
    // Unknown model stays transparently unpriced ($0, priced: false)
    expect(estimateModelCostUsd('custom-internal-v0', 10_000, 5_000, null)).toEqual({
      costUsd: 0,
      priced: false,
    });
  });

  it('classifies user profitability status cleanly across free high-burn, loss-making, watch, and profitable tiers', () => {
    expect(
      classifyProfitability({
        tier: 'founder_free',
        mrrUsd: 0,
        projectedMonthlyUsd: 4.5,
        totalUsd: 3.1,
        freeHighBurnThresholdUsd: 2.0,
      }).status,
    ).toBe('FREE_HIGH_BURN');

    expect(
      classifyProfitability({
        tier: 'starter',
        mrrUsd: 49,
        projectedMonthlyUsd: 62,
        totalUsd: 62,
        freeHighBurnThresholdUsd: 2.0,
      }).status,
    ).toBe('LOSS_MAKING');

    expect(
      classifyProfitability({
        tier: 'starter',
        mrrUsd: 49,
        projectedMonthlyUsd: 25,
        totalUsd: 25,
        freeHighBurnThresholdUsd: 2.0,
      }).status,
    ).toBe('WATCH');

    const prof = classifyProfitability({
      tier: 'agency',
      mrrUsd: 399,
      projectedMonthlyUsd: 40,
      totalUsd: 40,
      freeHighBurnThresholdUsd: 2.0,
    });
    expect(prof.status).toBe('PROFITABLE');
    expect(prof.marginPct).toBeCloseTo(90.0, 1);
  });

  it('computes 5-bucket COGS across AI, AI Visibility, Static+Chromium Crawls, Geo-Grid, and APIs without double-counting multi-member orgs', async () => {
    const now = new Date();
    const mockPrisma: any = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'u-owner',
            email: 'owner@acme.com',
            firstName: 'Asha',
            lastName: 'Patel',
            emailVerifiedAt: now,
            googleSub: 'g-1',
            passwordAuthEnabled: false,
            isPlatformAdmin: false,
            platformAdminRevokedAt: null,
            createdAt: now,
            memberships: [{ organizationId: 'org-1', role: 'OWNER' }],
            sessions: [{ id: 's-1', createdAt: now }],
          },
          {
            id: 'u-member',
            email: 'member@acme.com',
            firstName: 'Dev',
            lastName: 'Rao',
            emailVerifiedAt: now,
            googleSub: null,
            passwordAuthEnabled: true,
            isPlatformAdmin: false,
            platformAdminRevokedAt: null,
            createdAt: now,
            memberships: [{ organizationId: 'org-1', role: 'MEMBER' }],
            sessions: [],
          },
        ]),
      },
      organization: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'org-1',
            name: 'Acme Studio',
            slug: 'acme',
            subscriptionTier: 'founder_free',
            aiMonthlyBudgetUsd: 50,
            whiteLabelEnabled: false,
            createdAt: now,
            members: [
              { userId: 'u-owner', role: 'OWNER' },
              { userId: 'u-member', role: 'MEMBER' },
            ],
          },
        ]),
      },
      project: { findMany: jest.fn().mockResolvedValue([{ id: 'proj-1', name: 'Acme', organizationId: 'org-1' }]) },
      website: { findMany: jest.fn().mockResolvedValue([{ id: 'web-1', domain: 'acme.com', projectId: 'proj-1', scope: 'own', isVerified: true }]) },
      tokenWallet: { findMany: jest.fn().mockResolvedValue([{ organizationId: 'org-1', allowanceBalance: 4_500_000, periodAllowance: 5_000_000, bonusBalance: 100_000, monthlyAllowance: null, periodEnd: new Date(now.getTime() + 86_400_000) }]) },
      crawlJob: { findMany: jest.fn().mockResolvedValue([{ id: 'cj-1', websiteId: 'web-1', status: 'COMPLETED', pagesCrawled: 100, issuesFound: 12, createdAt: now }]) },
      page: { groupBy: jest.fn().mockResolvedValue([{ crawlJobId: 'cj-1', _count: { _all: 40 } }]) }, // 40 rendered + 60 static
      aiUsageRecord: { findMany: jest.fn().mockResolvedValue([{ organizationId: 'org-1', projectId: 'proj-1', taskType: 'AUDIT_REPORT', provider: 'gemini', model: 'gemini-2.5-flash', inputTokens: 200_000, outputTokens: 100_000, estimatedCostUsd: 1.0, status: 'OK', createdAt: now }]) },
      aiVisibilityProviderUsage: { findMany: jest.fn().mockResolvedValue([{ projectId: 'proj-1', provider: 'openai', model: 'gpt-4o', inputTokens: 10_000, outputTokens: 5_000, cost: 0.5, createdAt: now }]) },
      tokenTransaction: { findMany: jest.fn().mockResolvedValue([{ organizationId: 'org-1', userId: 'u-owner', kind: 'SPEND', action: 'AI_USAGE', allowanceDelta: -500_000, bonusDelta: 0, shortfall: 0, createdAt: now }]) },
      geoGridRun: { findMany: jest.fn().mockResolvedValue([{ projectId: 'proj-1', gridSize: 5, ranAt: now }]) }, // 25 points * $0.032 = $0.80
      serpSnapshot: { findMany: jest.fn().mockResolvedValue([{ projectId: 'proj-1', costUsd: 0.05, checkedAt: now }]) },
      keywordGapSnapshot: { findMany: jest.fn().mockResolvedValue([{ projectId: 'proj-1', costUsd: null, fetchedAt: now }]) }, // fallback $0.005
      backlinkDiscoveryRun: { findMany: jest.fn().mockResolvedValue([{ projectId: 'proj-1', startedAt: now }]) }, // $0.015
      fixIntervention: { groupBy: jest.fn().mockResolvedValue([]) },
      auditReportSnapshot: { groupBy: jest.fn().mockResolvedValue([]) },
      voiceSession: { groupBy: jest.fn().mockResolvedValue([]) },
      organizationMember: { findFirst: jest.fn().mockResolvedValue({ organizationId: 'org-1' }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };

    const service = new AdminCostEngineService(mockPrisma, {} as any);
    const result = await service.getUsersIntelligence('30d');

    // Expected org total:
    // AI Router: $1.00
    // AI Visibility: $0.50
    // Crawler: 60 * 0.0001 ($0.006) + 40 * 0.0015 ($0.060) = $0.066
    // Geo-Grid: 25 * 0.032 = $0.80
    // External APIs: 0.05 + 0.005 + 0.015 = $0.07
    // Grand Total = $2.436 -> INR at 85 = 207.06
    expect(result.summary.totalCostUsd).toBeCloseTo(2.436, 3);
    expect(result.summary.totalCostInr).toBeCloseTo(207.06, 1);
    expect(result.summary.buckets.crawlerComputeUsd).toBeCloseTo(0.066, 4);
    expect(result.summary.buckets.geoGridUsd).toBeCloseTo(0.8, 4);
    expect(result.summary.buckets.externalApisUsd).toBeCloseTo(0.07, 4);
    expect(result.summary.freeHighBurnUsers).toBeGreaterThanOrEqual(1);

    // Updating FX rate live recalculates INR cleanly
    const updated = await service.updateRates({ usdToInr: 90, geoGridPointCostUsd: 0.04 }, 'admin-1');
    expect(updated.usdToInr).toBe(90);
    expect(updated.geoGridPointCostUsd).toBe(0.04);
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });
});
