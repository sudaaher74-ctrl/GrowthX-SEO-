import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from '../admin/platform-admin.guard';
import { AdjustTokensDto, SetAllowanceDto, TokensAdminController, TokensController } from './tokens.controller';
import { readTokenConfig } from './token-rates';

function build(mode: 'enforce' | 'shadow' | 'off' = 'enforce') {
  const balance = {
    organizationId: 'org-1',
    mode,
    available: 1_200,
    allowance: {
      remaining: 1_000,
      granted: 5_000,
      monthly: 5_000,
      periodStart: new Date('2026-09-01T00:00:00Z'),
      periodEnd: new Date('2026-10-01T00:00:00Z'),
    },
    bonus: 200,
  };
  const tokens = {
    config: jest.fn().mockReturnValue({ ...readTokenConfig({} as NodeJS.ProcessEnv), mode }),
    getBalance: jest.fn().mockResolvedValue(balance),
    usageByAction: jest.fn().mockResolvedValue([
      { action: 'AI_USAGE', tokens: 700, shortfall: 0, count: 12 },
      { action: 'GEO_GRID_POINT', tokens: 45_000, shortfall: 0, count: 1 },
    ]),
    history: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
    adjust: jest.fn().mockResolvedValue(balance),
    setMonthlyAllowance: jest.fn().mockResolvedValue(balance),
  };
  const orgContext = { assertMembership: jest.fn().mockResolvedValue(undefined) };
  const req = { user: { userId: 'user-1' } };
  return {
    tokens,
    orgContext,
    req,
    controller: new TokensController(tokens as any, orgContext as any),
    admin: new TokensAdminController(tokens as any),
  };
}

describe('TokensController', () => {
  describe('overview', () => {
    it('checks the caller belongs to the organization before reading anything', async () => {
      const { controller, orgContext, tokens, req } = build();
      orgContext.assertMembership.mockRejectedValue(new ForbiddenException('You do not have access to this organization.'));

      await expect(controller.overview(req, 'someone-elses-org')).rejects.toBeInstanceOf(ForbiddenException);

      expect(orgContext.assertMembership).toHaveBeenCalledWith('user-1', 'someone-elses-org');
      expect(tokens.getBalance).not.toHaveBeenCalled();
      expect(tokens.usageByAction).not.toHaveBeenCalled();
    });

    it('reports the balance, this month’s usage and what things cost', async () => {
      const { controller, req, tokens } = build();

      const result: any = await controller.overview(req, 'org-1');

      expect(result).toMatchObject({
        enabled: true,
        mode: 'enforce',
        available: 1_200,
        bonus: 200,
        allowance: { remaining: 1_000, granted: 5_000, monthly: 5_000 },
        usage: { totalTokens: 45_700 },
        rates: {
          ai: { inputWeight: 1, outputWeight: 4 },
          actions: [{ action: 'GEO_GRID_POINT', tokensPerUnit: 5_000, unit: 'grid point' }],
        },
      });
      expect(result.usage.lines).toHaveLength(2);
      // Usage is counted from the start of the current allowance period.
      expect(tokens.usageByAction).toHaveBeenCalledWith('org-1', new Date('2026-09-01T00:00:00Z'));
    });

    it('says the system is off, without opening a wallet, when tokens are switched off', async () => {
      const { controller, req, tokens } = build('off');

      await expect(controller.overview(req, 'org-1')).resolves.toEqual({ enabled: false, mode: 'off' });

      expect(tokens.getBalance).not.toHaveBeenCalled();
    });

    it('still reports in shadow mode, so the screen can say nothing is limited yet', async () => {
      const { controller, req } = build('shadow');
      await expect(controller.overview(req, 'org-1')).resolves.toMatchObject({ enabled: true, mode: 'shadow' });
    });
  });

  describe('transactions', () => {
    it('checks membership, then pages the ledger', async () => {
      const { controller, req, orgContext, tokens } = build();

      await controller.transactions(req, 'org-1', '25', 'cursor-1');

      expect(orgContext.assertMembership).toHaveBeenCalledWith('user-1', 'org-1');
      expect(tokens.history).toHaveBeenCalledWith('org-1', { limit: 25, cursor: 'cursor-1' });
    });

    it('never shows operator notes to a customer', async () => {
      const { controller, req, tokens } = build();
      await controller.transactions(req, 'org-1');
      expect(tokens.history.mock.calls[0][1]).not.toHaveProperty('includeInternal');
    });

    it('ignores a limit that is not a number', async () => {
      const { controller, req, tokens } = build();
      await controller.transactions(req, 'org-1', 'lots');
      expect(tokens.history).toHaveBeenCalledWith('org-1', { limit: undefined, cursor: undefined });
    });

    it('refuses a non-member without reading the ledger', async () => {
      const { controller, req, orgContext, tokens } = build();
      orgContext.assertMembership.mockRejectedValue(new ForbiddenException());
      await expect(controller.transactions(req, 'org-2')).rejects.toBeInstanceOf(ForbiddenException);
      expect(tokens.history).not.toHaveBeenCalled();
    });

    it('returns an empty statement when tokens are off', async () => {
      const { controller, req, tokens } = build('off');
      await expect(controller.transactions(req, 'org-1')).resolves.toEqual({ items: [], nextCursor: null });
      expect(tokens.history).not.toHaveBeenCalled();
    });
  });

  it('is behind the login guard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, TokensController)).toContain(JwtAuthGuard);
  });
});

describe('TokensAdminController', () => {
  it('is behind both the login guard and the platform-operator allowlist', () => {
    // A customer who could reach these routes could give themselves tokens.
    const guards = Reflect.getMetadata(GUARDS_METADATA, TokensAdminController);
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(PlatformAdminGuard);
  });

  it('grants tokens on behalf of the signed-in operator', async () => {
    const { admin, tokens } = build();

    await admin.adjust({ user: { userId: 'operator-1' } }, 'org-1', { amount: 5_000, note: 'Goodwill' });

    expect(tokens.adjust).toHaveBeenCalledWith({
      organizationId: 'org-1',
      amount: 5_000,
      note: 'Goodwill',
      actorUserId: 'operator-1',
    });
  });

  it('sets, and clears, an organization’s own allowance', async () => {
    const { admin, tokens } = build();

    await admin.setAllowance('org-1', { monthlyAllowance: 2_000_000 });
    await admin.setAllowance('org-1', { monthlyAllowance: null });

    expect(tokens.setMonthlyAllowance).toHaveBeenNthCalledWith(1, 'org-1', 2_000_000);
    expect(tokens.setMonthlyAllowance).toHaveBeenNthCalledWith(2, 'org-1', null);
  });

  it('shows operators the full ledger, notes included', async () => {
    const { admin, tokens } = build();

    const result = await admin.overview('org-1', '10');

    expect(tokens.history).toHaveBeenCalledWith('org-1', { limit: 10, cursor: undefined, includeInternal: true });
    expect(result).toMatchObject({ available: 1_200, items: [], nextCursor: null });
  });
});

describe('the request bodies', () => {
  const adjust = (body: unknown) => validate(plainToInstance(AdjustTokensDto, body));
  const allowance = (body: unknown) => validate(plainToInstance(SetAllowanceDto, body));

  it('accepts a grant and a take-back', async () => {
    expect(await adjust({ amount: 5_000, note: 'Goodwill' })).toHaveLength(0);
    expect(await adjust({ amount: -100 })).toHaveLength(0);
  });

  it.each([{}, { amount: 'lots' }, { amount: 1.5 }, { amount: 2_000_000_000 }, { amount: -2_000_000_000 }, { amount: 5, note: 'x'.repeat(501) }])(
    'refuses the grant %j',
    async (body) => {
      expect((await adjust(body)).length).toBeGreaterThan(0);
    },
  );

  it('accepts an allowance, zero, or null for "the default"', async () => {
    expect(await allowance({ monthlyAllowance: 2_000_000 })).toHaveLength(0);
    expect(await allowance({ monthlyAllowance: 0 })).toHaveLength(0);
    expect(await allowance({ monthlyAllowance: null })).toHaveLength(0);
  });

  it.each([{}, { monthlyAllowance: -1 }, { monthlyAllowance: 1.5 }, { monthlyAllowance: '5' }, { monthlyAllowance: 2_000_000_000 }])(
    'refuses the allowance %j',
    async (body) => {
      expect((await allowance(body)).length).toBeGreaterThan(0);
    },
  );
});
