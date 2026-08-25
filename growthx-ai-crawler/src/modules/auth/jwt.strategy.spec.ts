import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

process.env.JWT_SECRET ??= 'a'.repeat(64);

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let users: { findById: jest.Mock };
  let prisma: any;

  const ALICE = 'user_alice';

  beforeEach(() => {
    users = { findById: jest.fn().mockResolvedValue({ id: ALICE, email: 'alice@example.com' }) };
    prisma = {
      organizationMember: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([{ organizationId: 'org_alice' }]),
      },
    };
    strategy = new JwtStrategy({ get: () => undefined } as any, users as any, prisma);
  });

  it('rejects a refresh token used as an access token', async () => {
    await expect(strategy.validate({ sub: ALICE, type: 'refresh' })).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token for a user that no longer exists', async () => {
    users.findById.mockResolvedValue(null);
    await expect(strategy.validate({ sub: ALICE })).rejects.toThrow(UnauthorizedException);
  });

  // The bug this guards: tokens are issued with no organization claim, so
  // every `organizationId` in the API came back undefined.
  it('resolves the organization from membership when the token carries no claim', async () => {
    const principal = await strategy.validate({ sub: ALICE, email: 'alice@example.com' });
    expect(principal.organizationId).toBe('org_alice');
  });

  it('honours a token claim the user is genuinely a member of', async () => {
    prisma.organizationMember.findUnique.mockResolvedValue({ organizationId: 'org_second' });
    const principal = await strategy.validate({ sub: ALICE, organizationId: 'org_second' });
    expect(principal.organizationId).toBe('org_second');
  });

  // A token outliving a membership must not keep the access it was minted with.
  it('ignores a claimed organization the user is not a member of', async () => {
    prisma.organizationMember.findUnique.mockResolvedValue(null);
    const principal = await strategy.validate({ sub: ALICE, organizationId: 'org_someone_else' });
    expect(principal.organizationId).toBe('org_alice');
    expect(principal.organizationId).not.toBe('org_someone_else');
  });

  it('leaves the organization undefined when the user belongs to none', async () => {
    prisma.organizationMember.findMany.mockResolvedValue([]);
    const principal = await strategy.validate({ sub: ALICE });
    expect(principal.organizationId).toBeUndefined();
  });
});
