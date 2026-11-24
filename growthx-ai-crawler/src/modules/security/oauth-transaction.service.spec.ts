import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { OAuthTransactionService } from './oauth-transaction.service';

function makeFakeTxTable() {
  const rows: any[] = [];
  const matches = (row: any, where: any) =>
    Object.entries(where).every(([k, cond]: [string, any]) => {
      if (cond !== null && typeof cond === 'object' && !(cond instanceof Date)) {
        if ('gt' in cond) return row[k] > cond.gt;
        if ('lt' in cond) return row[k] < cond.lt;
      }
      return (row[k] ?? null) === cond;
    });
  return {
    rows,
    create: jest.fn(async ({ data }: any) => {
      const row = { consumedAt: null, createdAt: new Date(), ...data };
      rows.push(row);
      return row;
    }),
    updateMany: jest.fn(async ({ where, data }: any) => {
      const hits = rows.filter((r) => matches(r, where));
      hits.forEach((r) => Object.assign(r, data));
      return { count: hits.length };
    }),
    findUnique: jest.fn(async ({ where }: any) => rows.find((r) => matches(r, where)) ?? null),
    deleteMany: jest.fn(async () => ({ count: 0 })),
  };
}

describe('OAuthTransactionService', () => {
  let table: ReturnType<typeof makeFakeTxTable>;
  let service: OAuthTransactionService;

  beforeEach(() => {
    table = makeFakeTxTable();
    const prisma = { oAuthTransaction: table };
    const security = {
      encryptCredentials: jest.fn((v: string) => `enc:${v}`),
      decryptCredentials: jest.fn((v: string) => v.replace(/^enc:/, '')),
    };
    service = new OAuthTransactionService(prisma as any, security as any);
  });

  it('creates an expiring single-use PKCE transaction hashed at rest and consumes it once', async () => {
    const created = await service.createTransaction({
      provider: 'google_integration',
      purpose: 'search_console',
      userId: 'user_1',
      organizationId: 'org_1',
      projectId: 'proj_1',
      usePkce: true,
    });

    // Only hashed state and nonce are stored; plaintext state/nonce never sit in DB.
    expect(table.rows[0].id).not.toBe(created.state);
    expect(table.rows[0].browserNonceHash).not.toBe(created.browserNonce);
    expect(created.codeChallengeMethod).toBe('S256');
    expect(created.codeChallenge).toBeTruthy();

    const consumed = await service.consumeTransaction({
      state: created.state,
      browserNonce: created.browserNonce,
      provider: 'google_integration',
      expectedPurpose: 'search_console',
      expectedUserId: 'user_1',
      expectedProjectId: 'proj_1',
    });

    expect(consumed.projectId).toBe('proj_1');
    expect(consumed.pkceVerifier).toBeTruthy();
    const expectedChallenge = createHash('sha256').update(consumed.pkceVerifier!, 'ascii').digest('base64url');
    expect(expectedChallenge).toBe(created.codeChallenge);

    // Replay must fail.
    await expect(
      service.consumeTransaction({
        state: created.state,
        browserNonce: created.browserNonce,
        provider: 'google_integration',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects mismatched browser session cookie, wrong project, wrong purpose, and expired transactions', async () => {
    const created = await service.createTransaction({
      provider: 'google_integration',
      purpose: 'search_console',
      userId: 'user_1',
      organizationId: 'org_1',
      projectId: 'proj_1',
    });

    await expect(
      service.consumeTransaction({
        state: created.state,
        browserNonce: 'different-browser-nonce',
        provider: 'google_integration',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    await expect(
      service.consumeTransaction({
        state: created.state,
        browserNonce: created.browserNonce,
        provider: 'google_integration',
        expectedProjectId: 'proj_other',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    await expect(
      service.consumeTransaction({
        state: created.state,
        browserNonce: created.browserNonce,
        provider: 'google_signin',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    // Expire the transaction.
    table.rows[0].expiresAt = new Date(Date.now() - 1000);
    await expect(
      service.consumeTransaction({
        state: created.state,
        browserNonce: created.browserNonce,
        provider: 'google_integration',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
