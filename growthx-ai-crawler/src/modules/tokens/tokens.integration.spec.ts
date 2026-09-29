import { randomUUID } from 'crypto';
import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { InsufficientTokensException } from './insufficient-tokens.exception';
import { TokensService } from './tokens.service';

/**
 * The token ledger against a real PostgreSQL.
 *
 * The unit spec runs against an in-memory double, which cannot prove the one
 * property the whole design leans on: that concurrent spends for one
 * organization really do queue on the wallet's row lock instead of both reading
 * the same balance. This does.
 *
 * Skipped unless TOKENS_TEST_DATABASE_URL points at a database that has had the
 * migrations applied (CI has no database, so it never runs there):
 *
 *   TOKENS_TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/scratch \
 *     npx jest src/modules/tokens/tokens.integration.spec.ts
 *
 * It creates and deletes its own organizations and touches nothing else.
 */
const url = process.env.TOKENS_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite('TokensService against PostgreSQL', () => {
  let prisma: PrismaClient;
  let service: TokensService;
  let organizationId: string;
  const created: string[] = [];

  async function newOrganization(): Promise<string> {
    const id = randomUUID();
    await prisma.organization.create({ data: { id, name: `tokens-test-${id}`, slug: `tokens-test-${id}` } });
    created.push(id);
    return id;
  }

  /** What the ledger says each bucket holds, summed from scratch. */
  async function replayed(id: string) {
    const sum = await prisma.tokenTransaction.aggregate({
      where: { organizationId: id },
      _sum: { allowanceDelta: true, bonusDelta: true },
    });
    return { allowance: sum._sum.allowanceDelta ?? 0, bonus: sum._sum.bonusDelta ?? 0 };
  }

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url } } });
    await prisma.$connect();
    service = new TokensService(prisma as unknown as PrismaService);
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterAll(async () => {
    await prisma.tokenTransaction.deleteMany({ where: { organizationId: { in: created } } });
    await prisma.organization.deleteMany({ where: { id: { in: created } } }); // wallets go with them
    await prisma.$disconnect();
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    process.env.TOKENS_MONTHLY_ALLOWANCE = '1000';
    delete process.env.TOKENS_ENFORCEMENT;
    organizationId = await newOrganization();
  });

  afterEach(() => {
    delete process.env.TOKENS_MONTHLY_ALLOWANCE;
  });

  it('opens one wallet, and grants one allowance, when many requests are first', async () => {
    await Promise.all(Array.from({ length: 12 }, () => service.getBalance(organizationId)));

    expect(await prisma.tokenWallet.count({ where: { organizationId } })).toBe(1);
    expect(await prisma.tokenTransaction.count({ where: { organizationId, kind: 'ALLOWANCE' } })).toBe(1);
  });

  it('lets exactly as many concurrent charges through as the balance can pay for', async () => {
    await service.getBalance(organizationId);

    const results = await Promise.allSettled(
      Array.from({ length: 40 }, () => service.charge({ organizationId, action: 'DEMO', tokens: 100 })),
    );

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(10);
    const refused = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(refused).toHaveLength(30);
    refused.forEach((r) => expect(r.reason).toBeInstanceOf(InsufficientTokensException));

    const wallet = await prisma.tokenWallet.findUniqueOrThrow({ where: { organizationId } });
    expect(wallet.allowanceBalance).toBe(0);
    expect(await replayed(organizationId)).toEqual({ allowance: 0, bonus: 0 });
    expect(await prisma.tokenTransaction.count({ where: { organizationId, kind: 'SPEND' } })).toBe(10);
  });

  it('keeps the ledger equal to the balance through a storm of mixed concurrent operations', async () => {
    await service.adjust({ organizationId, amount: 500 });

    const work: Array<Promise<unknown>> = [];
    for (let i = 0; i < 30; i++) {
      work.push(service.charge({ organizationId, action: 'DEMO', tokens: 60 }).catch(() => null));
      work.push(
        service.settleAiUsage({ organizationId, taskType: 'X', provider: 'P', model: 'm', inputTokens: 40, outputTokens: 10 }),
      );
      work.push(service.adjust({ organizationId, amount: 25 }));
    }
    await Promise.all(work);

    // Refund whatever was charged, concurrently, twice over.
    const spends = await prisma.tokenTransaction.findMany({ where: { organizationId, kind: 'SPEND', action: 'DEMO' } });
    await Promise.all(
      spends.flatMap((spend) => {
        const receipt = {
          transactionId: spend.id,
          organizationId,
          action: spend.action,
          tokens: -(spend.allowanceDelta + spend.bonusDelta),
          shortfall: spend.shortfall,
        };
        return [service.refund(receipt), service.refund(receipt)];
      }),
    );

    const wallet = await prisma.tokenWallet.findUniqueOrThrow({ where: { organizationId } });
    expect({ allowance: wallet.allowanceBalance, bonus: wallet.bonusBalance }).toEqual(await replayed(organizationId));
    expect(wallet.allowanceBalance).toBeGreaterThanOrEqual(0);
    expect(wallet.bonusBalance).toBeGreaterThanOrEqual(0);
    expect(await prisma.tokenTransaction.count({ where: { organizationId, kind: 'REFUND' } })).toBe(spends.length);

    // Every row's recorded balance is the running total at that point.
    const rows = await prisma.tokenTransaction.findMany({ where: { organizationId }, orderBy: { createdAt: 'asc' } });
    expect(rows.at(-1)?.allowanceAfter).toBe(wallet.allowanceBalance);
    expect(rows.at(-1)?.bonusAfter).toBe(wallet.bonusBalance);
  });

  it('rolls the month over exactly once when many requests arrive after it turns', async () => {
    await service.charge({ organizationId, action: 'DEMO', tokens: 300 });

    // Make the wallet look like it was opened in January 2020: its period, and
    // the key of the grant that opened it. (Periods only ever move forward, so
    // leaving the real grant's key behind would rightly collide when the wallet
    // rolls to this month.)
    await prisma.tokenWallet.update({
      where: { organizationId },
      data: { periodStart: new Date('2020-01-01T00:00:00Z'), periodEnd: new Date('2020-02-01T00:00:00Z') },
    });
    await prisma.tokenTransaction.updateMany({
      where: { organizationId, kind: 'ALLOWANCE' },
      data: { idempotencyKey: `allowance:${organizationId}:2020-01-01T00:00:00.000Z` },
    });

    await Promise.all(Array.from({ length: 12 }, () => service.getBalance(organizationId)));

    expect(await prisma.tokenTransaction.count({ where: { organizationId, kind: 'EXPIRY' } })).toBe(1);
    expect(await prisma.tokenTransaction.count({ where: { organizationId, kind: 'ALLOWANCE' } })).toBe(2);
    const wallet = await prisma.tokenWallet.findUniqueOrThrow({ where: { organizationId } });
    expect(wallet.allowanceBalance).toBe(1000);
    expect(await replayed(organizationId)).toEqual({ allowance: 1000, bonus: 0 });
  });

  it('applies a charge carrying the same idempotency key once, even when sent together', async () => {
    const request = { organizationId, action: 'DEMO', tokens: 100, idempotencyKey: `key-${organizationId}` };
    const receipts = await Promise.all(Array.from({ length: 8 }, () => service.charge(request)));

    expect(new Set(receipts.map((r) => r?.transactionId)).size).toBe(1);
    expect(await prisma.tokenTransaction.count({ where: { organizationId, kind: 'SPEND' } })).toBe(1);
    expect((await prisma.tokenWallet.findUniqueOrThrow({ where: { organizationId } })).allowanceBalance).toBe(900);
  });

  it('refuses, in the database, a balance that would go negative', async () => {
    await service.getBalance(organizationId);

    await expect(
      prisma.tokenWallet.update({ where: { organizationId }, data: { allowanceBalance: { decrement: 1_001 } } }),
    ).rejects.toThrow();
    await expect(
      prisma.tokenWallet.update({ where: { organizationId }, data: { bonusBalance: { decrement: 1 } } }),
    ).rejects.toThrow();
    expect((await prisma.tokenWallet.findUniqueOrThrow({ where: { organizationId } })).allowanceBalance).toBe(1000);
  });

  it('refuses a wallet for an organization that does not exist', async () => {
    await expect(service.getBalance(randomUUID())).rejects.toMatchObject({ status: 404 });
  });

  it('reports usage by feature and pages the ledger', async () => {
    await service.settleAiUsage({ organizationId, taskType: 'X', provider: 'P', model: 'm', inputTokens: 100, outputTokens: 0 });
    await service.settleAiUsage({ organizationId, taskType: 'X', provider: 'P', model: 'm', inputTokens: 50, outputTokens: 0 });
    const scan = await service.charge({ organizationId, action: 'GEO_GRID_POINT', tokens: 300 });
    await service.refund(scan);

    const usage = await service.usageByAction(organizationId, new Date('2020-01-01T00:00:00Z'));
    expect(usage).toEqual([
      { action: 'AI_USAGE', tokens: 150, shortfall: 0, count: 2 },
      { action: 'GEO_GRID_POINT', tokens: 0, shortfall: 0, count: 0 },
    ]);

    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await service.history(organizationId, { limit: 2, cursor });
      seen.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(seen).toHaveLength(await prisma.tokenTransaction.count({ where: { organizationId } }));
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('survives a work function that throws by refunding through the real database', async () => {
    await expect(
      service.withCharge({ organizationId, action: 'DEMO', tokens: 400 }, async () => {
        throw new Error('Places is down');
      }),
    ).rejects.toThrow('Places is down');

    expect((await prisma.tokenWallet.findUniqueOrThrow({ where: { organizationId } })).allowanceBalance).toBe(1000);
    expect(await replayed(organizationId)).toEqual({ allowance: 1000, bonus: 0 });
  });
});
