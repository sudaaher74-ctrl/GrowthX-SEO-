import { AdminService } from './admin.service';

describe('AdminService.getTenants', () => {
  function build(balances: Record<string, { available: number; monthly: number }>) {
    const prisma = {
      organization: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'org-1',
            name: 'Acme Dental',
            projects: [{ websites: [{}, {}] }, { websites: [{}] }],
            members: [{ user: { email: 'owner@acme.test' } }],
          },
          { id: 'org-2', name: 'Brand New Co', projects: [], members: [] },
        ]),
      },
    };
    const tokens = { peek: jest.fn().mockResolvedValue(new Map(Object.entries(balances))) };
    return { service: new AdminService({} as any, prisma as any, tokens as any), tokens };
  }

  it('reports what each organization holds, from its real wallet', async () => {
    const { service, tokens } = build({ 'org-1': { available: 4_995_208, monthly: 5_000_000 } });

    const tenants = await service.getTenants();

    expect(tokens.peek).toHaveBeenCalledWith(['org-1', 'org-2']);
    expect(tenants[0]).toMatchObject({
      id: 'org-1',
      owner: 'owner@acme.test',
      sites: 3,
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
          { userId: 'user-1' }, // multiple sessions for same user
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
      loggedInUsers: 2, // distinct user-1 and user-2
      activeSessions: 3,
    });
  });

  it('reports online status and attributed models for users', async () => {
    const future = new Date(Date.now() + 100_000);
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'user-1',
            email: 'alice@test.com',
            firstName: 'Alice',
            lastName: 'Smith',
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
      isLoggedIn: true,
      status: 'ONLINE',
      activeSessionsCount: 1,
      modelsUsed: ['gemini-2.5-flash'],
      aiCallsCount: 1,
    });
    expect(users[1]).toMatchObject({
      id: 'user-2',
      name: 'Bob',
      isLoggedIn: false,
      status: 'OFFLINE',
      activeSessionsCount: 0,
      modelsUsed: [],
      aiCallsCount: 0,
    });
  });

  it('breaks down AI model usage by user and organization', async () => {
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
        ]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'u-1',
            email: 'claire@test.com',
            firstName: 'Claire',
            lastName: null,
            memberships: [{ organizationId: 'org-1', organization: { name: 'Acme Corp' } }],
          },
        ]),
      },
      tokenTransaction: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new AdminService({} as any, prisma as any, {} as any);

    const breakdown = await service.getUserModelBreakdown();

    expect(breakdown).toHaveLength(1);
    expect(breakdown[0]).toMatchObject({
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
