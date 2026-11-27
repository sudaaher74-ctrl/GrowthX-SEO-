import { AdminService } from './admin.service';

describe('AdminService.getTenants', () => {
  function build(balances: Record<string, { available: number; monthly: number }>) {
    const prisma = {
      organization: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'org-1',
            name: 'Acme Dental',
            slug: 'acme-dental',
            subscriptionTier: 'growth',
            aiMonthlyBudgetUsd: 50,
            whiteLabelEnabled: false,
            createdAt: new Date('2026-01-10T00:00:00Z'),
            projects: [{ websites: [{}, {}] }, { websites: [{}] }],
            members: [{ role: 'OWNER', user: { email: 'owner@acme.test' } }],
          },
          {
            id: 'org-2',
            name: 'Brand New Co',
            slug: 'brand-new-co',
            subscriptionTier: 'founder_free',
            aiMonthlyBudgetUsd: null,
            whiteLabelEnabled: false,
            createdAt: new Date('2026-02-01T00:00:00Z'),
            projects: [],
            members: [],
          },
        ]),
      },
      aiUsageRecord: {
        groupBy: jest.fn().mockResolvedValue([
          {
            organizationId: 'org-1',
            _sum: { estimatedCostUsd: 12.45, inputTokens: 10000, outputTokens: 2000 },
            _count: { _all: 14 },
          },
        ]),
      },
    };
    const tokens = { peek: jest.fn().mockResolvedValue(new Map(Object.entries(balances))) };
    return { service: new AdminService({} as any, prisma as any, tokens as any), tokens };
  }

  it('reports what each organization holds, from its real wallet and AI spend', async () => {
    const { service, tokens } = build({ 'org-1': { available: 4_995_208, monthly: 5_000_000 } });

    const tenants = await service.getTenants();

    expect(tokens.peek).toHaveBeenCalledWith(['org-1', 'org-2']);
    expect(tenants[0]).toMatchObject({
      id: 'org-1',
      owner: 'owner@acme.test',
      sites: 3,
      projectCount: 2,
      memberCount: 1,
      subscriptionTier: 'growth',
      aiMonthlyBudgetUsd: 50,
      mtdAiSpendUsd: 12.45,
      tokens: { available: 4_995_208, monthly: 5_000_000 },
    });
  });

  it('says nothing, rather than guessing, for an organization that has not used a metered feature', async () => {
    const { service } = build({ 'org-1': { available: 10, monthly: 20 } });

    const [, brandNew] = await service.getTenants();

    expect(brandNew).toMatchObject({ id: 'org-2', owner: null, sites: 0, tokens: null });
  });

  it('no longer invents a subscription plan for every organization', async () => {
    const { service } = build({});
    for (const tenant of await service.getTenants()) {
      expect(tenant).not.toHaveProperty('plan');
    }
  });
});

describe('AdminService.getStats and getUsers', () => {
  it('counts logged in users based on unexpired non-revoked refresh sessions', async () => {
    const prisma = {
      organization: { count: jest.fn().mockResolvedValue(5) },
      user: { count: jest.fn().mockResolvedValue(12) },
      project: { count: jest.fn().mockResolvedValue(8) },
      refreshSession: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'user-1' },
          { userId: 'user-1' },
          { userId: 'user-2' },
        ]),
      },
    };
    const service = new AdminService({} as any, prisma as any, {} as any);

    const stats = await service.getStats();

    expect(stats).toEqual({
      tenants: 5,
      users: 12,
      projects: 8,
      loggedInUsers: 2,
      activeSessions: 3,
    });
  });

  it('reports online status, verification, operator badge, and attributed models for users', async () => {
    const future = new Date(Date.now() + 100_000);
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'user-1',
            email: 'alice@test.com',
            firstName: 'Alice',
            lastName: 'Smith',
            emailVerifiedAt: new Date('2026-01-01'),
            isPlatformAdmin: true,
            platformAdminRevokedAt: null,
            googleSub: 'google-sub-1',
            passwordAuthEnabled: true,
            createdAt: new Date('2026-01-01'),
            memberships: [{ role: 'OWNER', organizationId: 'org-1', organization: { name: 'Acme Inc' } }],
            sessions: [
              { id: 's-1', expiresAt: future, revokedAt: null, createdAt: new Date('2026-10-29T10:00:00Z') },
            ],
          },
          {
            id: 'user-2',
            email: 'bob@test.com',
            firstName: 'Bob',
            lastName: null,
            emailVerifiedAt: null,
            isPlatformAdmin: false,
            platformAdminRevokedAt: null,
            googleSub: null,
            passwordAuthEnabled: true,
            createdAt: new Date('2026-01-02'),
            memberships: [{ role: 'MEMBER', organizationId: 'org-2', organization: { name: 'Beta LLC' } }],
            sessions: [],
          },
        ]),
      },
      tokenTransaction: {
        findMany: jest.fn().mockResolvedValue([
          {
            userId: 'user-1',
            organizationId: 'org-1',
            detail: { provider: 'google', model: 'gemini-2.5-flash' },
            createdAt: new Date('2026-10-29T11:00:00Z'),
          },
        ]),
      },
      aiUsageRecord: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new AdminService({} as any, prisma as any, {} as any);

    const users = await service.getUsers();

    expect(users).toHaveLength(2);
    expect(users[0]).toMatchObject({
      id: 'user-1',
      name: 'Alice Smith',
      emailVerified: true,
      isPlatformAdmin: true,
      authProvider: 'both',
      isLoggedIn: true,
      status: 'ONLINE',
      activeSessionsCount: 1,
      modelsUsed: ['gemini-2.5-flash'],
      aiCallsCount: 1,
    });
    expect(users[1]).toMatchObject({
      id: 'user-2',
      name: 'Bob',
      emailVerified: false,
      isPlatformAdmin: false,
      authProvider: 'password',
      isLoggedIn: false,
      status: 'OFFLINE',
      activeSessionsCount: 0,
      modelsUsed: [],
      aiCallsCount: 0,
    });
  });

  it('breaks down AI model usage without double-counting multi-member organizations', async () => {
    const prisma = {
      aiUsageRecord: {
        findMany: jest.fn().mockResolvedValue([
          {
            organizationId: 'org-1',
            provider: 'anthropic',
            model: 'claude-3-5-sonnet',
            inputTokens: 1000,
            outputTokens: 500,
            estimatedCostUsd: 0.015,
            createdAt: new Date('2026-10-29T12:00:00Z'),
          },
          {
            organizationId: 'org-multi',
            provider: 'openai',
            model: 'gpt-4o',
            inputTokens: 2000,
            outputTokens: 1000,
            estimatedCostUsd: 0.05,
            createdAt: new Date('2026-10-29T13:00:00Z'),
          },
        ]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'u-1',
            email: 'claire@test.com',
            firstName: 'Claire',
            lastName: null,
            memberships: [{ organizationId: 'org-1', role: 'OWNER', organization: { name: 'Acme Corp' } }],
          },
          {
            id: 'u-2',
            email: 'dan@team.test',
            firstName: 'Dan',
            lastName: null,
            memberships: [{ organizationId: 'org-multi', role: 'OWNER', organization: { name: 'Team Org' } }],
          },
          {
            id: 'u-3',
            email: 'eva@team.test',
            firstName: 'Eva',
            lastName: null,
            memberships: [{ organizationId: 'org-multi', role: 'MEMBER', organization: { name: 'Team Org' } }],
          },
        ]),
      },
      tokenTransaction: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new AdminService({} as any, prisma as any, {} as any);

    const breakdown = await service.getUserModelBreakdown();

    expect(breakdown).toHaveLength(2);
    expect(breakdown[0]).toMatchObject({
      userId: 'org:org-multi',
      organizationName: 'Team Org',
      totalTokens: 3000,
      cost: 0.05,
      calls: 1,
    });
    expect(breakdown[1]).toMatchObject({
      userId: 'u-1',
      userName: 'Claire',
      userEmail: 'claire@test.com',
      organizationName: 'Acme Corp',
      provider: 'anthropic',
      model: 'claude-3-5-sonnet',
      totalTokens: 1500,
      cost: 0.015,
      calls: 1,
    });
  });
});

describe('AdminService queues, operator updates, and session revocation', () => {
  it('inspects all three BullMQ queues including page-render and real paused state', async () => {
    const mkQueue = (active: number, failed: number, paused: boolean) => ({
      getActiveCount: jest.fn().mockResolvedValue(active),
      getWaitingCount: jest.fn().mockResolvedValue(2),
      getDelayedCount: jest.fn().mockResolvedValue(1),
      getCompletedCount: jest.fn().mockResolvedValue(50),
      getFailedCount: jest.fn().mockResolvedValue(failed),
      isPaused: jest.fn().mockResolvedValue(paused),
    });

    const queueService = {
      crawlJobsQueue: mkQueue(1, 0, false),
      pageFetchQueue: mkQueue(3, 2, true),
      pageRenderQueue: mkQueue(2, 1, false),
    };
    const service = new AdminService(queueService as any, {} as any, {} as any);

    const stats = await service.getQueueStats();

    expect(stats.map((q) => q.name)).toEqual(['crawl-jobs', 'page-fetch', 'page-render']);
    expect(stats[1]).toMatchObject({ name: 'page-fetch', paused: true, status: 'paused', failed: 2, delayed: 1 });
    expect(stats[2]).toMatchObject({ name: 'page-render', paused: false, status: 'active', active: 2 });
  });

  it('updates tenant tier and monthly AI budget and records an audit log', async () => {
    const prisma = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'org-1',
          name: 'Acme',
          subscriptionTier: 'founder_free',
          aiMonthlyBudgetUsd: null,
          whiteLabelEnabled: false,
        }),
        update: jest.fn().mockResolvedValue({
          id: 'org-1',
          name: 'Acme',
          subscriptionTier: 'agency',
          aiMonthlyBudgetUsd: 250,
          whiteLabelEnabled: true,
          updatedAt: new Date('2026-11-26T00:00:00Z'),
        }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
      },
    };
    const service = new AdminService({} as any, prisma as any, {} as any);

    const updated = await service.updateTenant(
      'org-1',
      { subscriptionTier: 'agency', aiMonthlyBudgetUsd: 250, whiteLabelEnabled: true },
      'admin-1',
    );

    expect(updated.subscriptionTier).toBe('agency');
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          userId: 'admin-1',
          action: 'ADMIN_TENANT_UPDATED',
        }),
      }),
    );
  });

  it('revokes all active sessions for a user and logs the operator action', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-9',
          email: 'target@example.com',
          memberships: [{ organizationId: 'org-9' }],
        }),
        update: jest.fn().mockResolvedValue({ id: 'user-9' }),
      },
      refreshSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-2' }),
      },
    };
    const service = new AdminService({} as any, prisma as any, {} as any);

    const res = await service.revokeUserSessions('user-9', 'admin-1');

    expect(res).toMatchObject({ success: true, userId: 'user-9', revokedSessions: 3 });
    expect(prisma.user.update).toHaveBeenCalled();
    expect(prisma.refreshSession.updateMany).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-9',
          action: 'ADMIN_USER_SESSIONS_REVOKED',
        }),
      }),
    );
  });

  it('updates website crawl settings and force-fails stuck crawl jobs', async () => {
    const prisma = {
      website: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'web-1',
          domain: 'example.test',
          isVerified: false,
          verifiedAt: null,
          project: { organizationId: 'org-1' },
        }),
        update: jest.fn().mockResolvedValue({
          id: 'web-1',
          domain: 'example.test',
          isVerified: true,
          maxConcurrency: 8,
          maxDepth: 6,
          rateLimitDelayMs: 250,
        }),
      },
      crawlJob: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'crawl-stuck-1',
          finishedAt: null,
          website: { domain: 'example.test', project: { organizationId: 'org-1' } },
        }),
        update: jest.fn().mockResolvedValue({
          id: 'crawl-stuck-1',
          status: 'FAILED',
          errorMessage: 'Stuck in queue',
          finishedAt: new Date(),
        }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-3' }),
      },
    };
    const queueService = { forgetJobTasks: jest.fn().mockResolvedValue(undefined) };
    const service = new AdminService(queueService as any, prisma as any, {} as any);

    const updated = await service.updateWebsite(
      'web-1',
      { isVerified: true, maxConcurrency: 8, maxDepth: 6, rateLimitDelayMs: 250 },
      'admin-1',
    );
    expect(updated.isVerified).toBe(true);
    expect(prisma.website.update).toHaveBeenCalled();

    const closed = await service.forceFailCrawl('crawl-stuck-1', 'Stuck in queue', 'admin-1');
    expect(closed).toMatchObject({ success: true, crawl: { id: 'crawl-stuck-1', status: 'FAILED' } });
    expect(queueService.forgetJobTasks).toHaveBeenCalledWith('crawl-stuck-1');
  });

  it('controls MultiAiRouterService runtime circuit breakers and caches', () => {
    const aiRouter = {
      getAdminDiagnostics: jest.fn().mockReturnValue({
        providers: [],
        taskMatrix: [],
        allowlist: null,
        fastRouteTiers: ['founder_free'],
        serverSideFallbackEnabled: true,
        caches: { responseCacheEntries: 3, responseCacheMaxEntries: 500, responseCacheTtlMs: 600000, orgTierCacheEntries: 2 },
      }),
      setProviderRuntimeEnabled: jest.fn(),
      setProviderModelOverride: jest.fn(),
      setServerSideFallbackEnabled: jest.fn(),
      clearRuntimeCaches: jest.fn().mockReturnValue({ clearedResponses: 3, clearedOrgTiers: 2 }),
    };
    const service = new AdminService({} as any, {} as any, {} as any, undefined, undefined, aiRouter as any);

    service.updateAiRouterConfig({
      provider: 'GROQ' as any,
      enabled: false,
      modelOverride: 'llama-3.3-70b-versatile',
      serverSideFallbackEnabled: false,
    });
    expect(aiRouter.setProviderRuntimeEnabled).toHaveBeenCalledWith('GROQ', false);
    expect(aiRouter.setProviderModelOverride).toHaveBeenCalledWith('GROQ', 'llama-3.3-70b-versatile');
    expect(aiRouter.setServerSideFallbackEnabled).toHaveBeenCalledWith(false);

    const cleared = service.clearAiRouterCaches();
    expect(cleared).toEqual({ success: true, clearedResponses: 3, clearedOrgTiers: 2 });
  });
});
