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
