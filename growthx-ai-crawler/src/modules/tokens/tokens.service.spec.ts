import { BadRequestException, ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { InsufficientTokensException, INSUFFICIENT_TOKENS } from './insufficient-tokens.exception';
import { TokenAction } from './token-rates';
import { TokenReceipt, TokensService } from './tokens.service';
import { createFakePrisma, FakePrisma, LedgerRow } from './tokens.testing';

const ENV_KEYS = [
  'TOKENS_ENFORCEMENT',
  'TOKENS_MONTHLY_ALLOWANCE',
  'TOKENS_AI_INPUT_WEIGHT',
  'TOKENS_AI_OUTPUT_WEIGHT',
  'TOKENS_MIN_TO_START_AI',
  'TOKENS_COST_GEO_GRID_POINT',
];

/** Only `Date` is faked: the doubles here are promise-based and must keep running. */
const REAL_TIMERS = [
  'hrtime',
  'nextTick',
  'performance',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
] as const;

function at(iso: string) {
  jest.setSystemTime(new Date(iso));
}

function setup(organizations: string[] = ['org-1']) {
  const fake = createFakePrisma();
  organizations.forEach((id) => fake.organizations.add(id));
  const service = new TokensService(fake.prisma);
  return { fake, service };
}

/** A small allowance keeps the arithmetic in the tests readable. */
function withAllowance(tokens: number) {
  process.env.TOKENS_MONTHLY_ALLOWANCE = String(tokens);
}

const kinds = (fake: FakePrisma) => fake.ledger().map((row) => row.kind);

/** Replays the ledger from zero and checks it agrees with every balance it recorded. */
function expectLedgerToMatchWallets(fake: FakePrisma) {
  for (const wallet of fake.wallets()) {
    let allowance = 0;
    let bonus = 0;
    for (const row of fake.ledger().filter((r) => r.organizationId === wallet.organizationId)) {
      allowance += row.allowanceDelta;
      bonus += row.bonusDelta;
      expect({ id: row.id, allowanceAfter: row.allowanceAfter, bonusAfter: row.bonusAfter }).toEqual({
        id: row.id,
        allowanceAfter: allowance,
        bonusAfter: bonus,
      });
    }
    expect(wallet.allowanceBalance).toBe(allowance);
    expect(wallet.bonusBalance).toBe(bonus);
    expect(wallet.allowanceBalance).toBeGreaterThanOrEqual(0);
    expect(wallet.bonusBalance).toBeGreaterThanOrEqual(0);
  }
}

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-09-29T12:00:00Z'), doNotFake: [...REAL_TIMERS] });
  jest.spyOn(Logger.prototype, 'log').mockImplementation();
  jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  jest.spyOn(Logger.prototype, 'error').mockImplementation();
  ENV_KEYS.forEach((key) => delete process.env[key]);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  ENV_KEYS.forEach((key) => delete process.env[key]);
});

describe('TokensService', () => {
  describe('getBalance', () => {
    it('opens a wallet holding the month’s allowance the first time an organization is seen', async () => {
      const { fake, service } = setup();
      withAllowance(1_000);

      const balance = await service.getBalance('org-1');

      expect(balance).toMatchObject({
        organizationId: 'org-1',
        mode: 'enforce',
        available: 1_000,
        bonus: 0,
        allowance: { remaining: 1_000, granted: 1_000, monthly: 1_000 },
      });
      expect(balance.allowance.periodStart.toISOString()).toBe('2026-09-01T00:00:00.000Z');
      expect(balance.allowance.periodEnd.toISOString()).toBe('2026-10-01T00:00:00.000Z');
      expect(fake.ledger()).toHaveLength(1);
      expect(fake.ledger()[0]).toMatchObject({ kind: 'ALLOWANCE', action: 'MONTHLY_ALLOWANCE', allowanceDelta: 1_000, allowanceAfter: 1_000 });
    });

    it('uses the platform default allowance when none is configured', async () => {
      const { service } = setup();
      await expect(service.getBalance('org-1')).resolves.toMatchObject({ available: 5_000_000 });
    });

    it('does not open a second wallet or grant a second allowance on later reads', async () => {
      const { fake, service } = setup();
      await service.getBalance('org-1');
      await service.getBalance('org-1');
      await service.getBalance('org-1');

      expect(fake.wallets()).toHaveLength(1);
      expect(kinds(fake)).toEqual(['ALLOWANCE']);
    });

    it('opens exactly one wallet when many requests are the first to see an organization', async () => {
      const { fake, service } = setup();
      withAllowance(1_000);

      const balances = await Promise.all(Array.from({ length: 8 }, () => service.getBalance('org-1')));

      expect(fake.wallets()).toHaveLength(1);
      expect(kinds(fake)).toEqual(['ALLOWANCE']);
      balances.forEach((balance) => expect(balance.available).toBe(1_000));
    });

    it('answers 404 for an organization that does not exist', async () => {
      const { fake, service } = setup();
      await expect(service.getBalance('ghost')).rejects.toBeInstanceOf(NotFoundException);
      expect(fake.wallets()).toHaveLength(0);
    });

    it('opens an empty wallet, with no zero-token ledger row, when the allowance is zero', async () => {
      const { fake, service } = setup();
      withAllowance(0);

      await expect(service.getBalance('org-1')).resolves.toMatchObject({ available: 0 });
      expect(fake.ledger()).toHaveLength(0);
    });
  });

  describe('charge', () => {
    it('takes from the allowance first and only then from bonus tokens', async () => {
      const { fake, service } = setup();
      withAllowance(100);
      await service.adjust({ organizationId: 'org-1', amount: 50 });

      const receipt = await service.charge({ organizationId: 'org-1', action: 'DEMO', tokens: 120 });

      expect(receipt).toMatchObject({ tokens: 120, shortfall: 0, action: 'DEMO' });
      expect(fake.wallets()[0]).toMatchObject({ allowanceBalance: 0, bonusBalance: 30 });
      expect(fake.ledger().at(-1)).toMatchObject({
        kind: 'SPEND',
        allowanceDelta: -100,
        bonusDelta: -20,
        allowanceAfter: 0,
        bonusAfter: 30,
      });
    });

    it('refuses with a 402 the dashboard can read, and changes nothing', async () => {
      const { fake, service } = setup();
      withAllowance(100);
      await service.getBalance('org-1');
      const ledgerBefore = fake.ledger().length;

      const attempt = service.charge({ organizationId: 'org-1', action: 'DEMO', tokens: 101 });

      await expect(attempt).rejects.toBeInstanceOf(InsufficientTokensException);
      await expect(attempt).rejects.toMatchObject({
        status: 402,
        response: { error: INSUFFICIENT_TOKENS, required: 101, available: 100, resetsAt: '2026-10-01T00:00:00.000Z' },
      });
      expect(fake.wallets()[0].allowanceBalance).toBe(100);
      expect(fake.ledger()).toHaveLength(ledgerBefore);
    });

    it('lets a charge of exactly the balance through', async () => {
      const { fake, service } = setup();
      withAllowance(100);
      await expect(service.charge({ organizationId: 'org-1', action: 'DEMO', tokens: 100 })).resolves.toMatchObject({ tokens: 100 });
      expect(fake.wallets()[0].allowanceBalance).toBe(0);
    });

    it('charges nothing, and writes nothing, for a price of zero', async () => {
      const { fake, service } = setup();
      await expect(service.charge({ organizationId: 'org-1', action: 'DEMO', tokens: 0 })).resolves.toBeNull();
      expect(fake.wallets()).toHaveLength(0);
    });

    it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rejects the nonsense amount %p instead of guessing', async (tokens) => {
      const { fake, service } = setup();
      await expect(service.charge({ organizationId: 'org-1', action: 'DEMO', tokens })).rejects.toBeInstanceOf(BadRequestException);
      expect(fake.wallets()).toHaveLength(0);
    });

    it('rounds a fractional amount up rather than under-charging', async () => {
      const { service } = setup();
      withAllowance(100);
      await expect(service.charge({ organizationId: 'org-1', action: 'DEMO', tokens: 2.2 })).resolves.toMatchObject({ tokens: 3 });
    });

    it('applies a retried request once when it carries an idempotency key', async () => {
      const { fake, service } = setup();
      withAllowance(100);
      const request = { organizationId: 'org-1', action: 'DEMO', tokens: 30, idempotencyKey: 'req-1' };

      const first = await service.charge(request);
      const second = await service.charge(request);

      expect(second).toEqual(first);
      expect(fake.wallets()[0].allowanceBalance).toBe(70);
      expect(fake.ledger().filter((row) => row.kind === 'SPEND')).toHaveLength(1);
    });

    it('records who and what it was for', async () => {
      const { fake, service } = setup();
      await service.charge({
        organizationId: 'org-1',
        action: TokenAction.GEO_GRID_POINT,
        tokens: 45_000,
        projectId: 'proj-1',
        userId: 'user-1',
        detail: { gridSize: 3 },
      });
      expect(fake.ledger().at(-1)).toMatchObject({
        action: 'GEO_GRID_POINT',
        projectId: 'proj-1',
        userId: 'user-1',
        detail: { gridSize: 3 },
      });
    });

    it('answers 404 for an organization that does not exist', async () => {
      const { service } = setup();
      await expect(service.charge({ organizationId: 'ghost', action: 'DEMO', tokens: 5 })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lets exactly as many concurrent charges through as the balance can pay for', async () => {
      const { fake, service } = setup();
      withAllowance(1_000);
      await service.getBalance('org-1');

      const results = await Promise.allSettled(
        Array.from({ length: 25 }, () => service.charge({ organizationId: 'org-1', action: 'DEMO', tokens: 100 })),
      );

      const paid = results.filter((r) => r.status === 'fulfilled');
      const refused = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(paid).toHaveLength(10);
      expect(refused).toHaveLength(15);
      refused.forEach((r) => expect(r.reason).toBeInstanceOf(InsufficientTokensException));
      expect(fake.wallets()[0].allowanceBalance).toBe(0);
      expect(fake.ledger().filter((row) => row.kind === 'SPEND')).toHaveLength(10);
      expectLedgerToMatchWallets(fake);
    });
  });

  describe('when the token system cannot do its bookkeeping', () => {
    it('lets the work go ahead uncharged rather than failing it', async () => {
      const { fake, service } = setup();
      await service.getBalance('org-1');
      fake.failNextTransaction(new Error('connection reset'));

      await expect(service.charge({ organizationId: 'org-1', action: 'DEMO', tokens: 10 })).resolves.toBeNull();
      expect(Logger.prototype.error).toHaveBeenCalledWith(expect.stringContaining('the work goes ahead uncharged'));
    });

    it('still says no when the answer is a definite no', async () => {
      const { service } = setup();
      withAllowance(5);
      await expect(service.charge({ organizationId: 'org-1', action: 'DEMO', tokens: 6 })).rejects.toBeInstanceOf(
        InsufficientTokensException,
      );
    });
  });

  describe('withCharge', () => {
    it('keeps the charge when the work succeeds', async () => {
      const { fake, service } = setup();
      withAllowance(1_000);

      const result = await service.withCharge({ organizationId: 'org-1', action: 'DEMO', tokens: 400 }, async () => 'done');

      expect(result).toBe('done');
      expect(fake.wallets()[0].allowanceBalance).toBe(600);
    });

    it('gives the tokens back and rethrows the original error when the work fails', async () => {
      const { fake, service } = setup();
      withAllowance(1_000);
      const failure = new Error('Places is down');

      await expect(
        service.withCharge({ organizationId: 'org-1', action: 'DEMO', tokens: 400 }, async () => {
          throw failure;
        }),
      ).rejects.toBe(failure);

      expect(fake.wallets()[0].allowanceBalance).toBe(1_000);
      expect(kinds(fake)).toEqual(['ALLOWANCE', 'SPEND', 'REFUND']);
      expectLedgerToMatchWallets(fake);
    });

    it('does not run the work at all when the tokens are not there', async () => {
      const { service } = setup();
      withAllowance(10);
      const work = jest.fn();

      await expect(service.withCharge({ organizationId: 'org-1', action: 'DEMO', tokens: 11 }, work)).rejects.toBeInstanceOf(
        InsufficientTokensException,
      );
      expect(work).not.toHaveBeenCalled();
    });

    it('surfaces the work’s error, not the refund’s, when both fail', async () => {
      const { fake, service } = setup();
      withAllowance(1_000);
      const failure = new Error('Places is down');

      await expect(
        service.withCharge({ organizationId: 'org-1', action: 'DEMO', tokens: 400 }, async () => {
          fake.failNextTransaction(new Error('database went away')); // the refund's transaction
          throw failure;
        }),
      ).rejects.toBe(failure);

      expect(Logger.prototype.error).toHaveBeenCalledWith(expect.stringContaining('refund it by hand'));
      expect(fake.wallets()[0].allowanceBalance).toBe(600);
    });

    it('runs the work without a charge when tokens are off', async () => {
      const { fake, service } = setup();
      process.env.TOKENS_ENFORCEMENT = 'off';
      const work = jest.fn().mockResolvedValue('ran');

      await expect(service.withCharge({ organizationId: 'org-1', action: 'DEMO', tokens: 400 }, work)).resolves.toBe('ran');
      expect(fake.wallets()).toHaveLength(0);
    });
  });

  describe('refund', () => {
    it('puts back exactly what each bucket gave', async () => {
      const { fake, service } = setup();
      withAllowance(100);
      await service.adjust({ organizationId: 'org-1', amount: 50 });
      const receipt = await service.charge({ organizationId: 'org-1', action: 'DEMO', tokens: 120 });

      await service.refund(receipt);

      expect(fake.wallets()[0]).toMatchObject({ allowanceBalance: 100, bonusBalance: 50 });
      const spend = fake.ledger().find((row) => row.kind === 'SPEND') as LedgerRow;
      expect(fake.ledger().at(-1)).toMatchObject({
        kind: 'REFUND',
        allowanceDelta: 100,
        bonusDelta: 20,
        refundOfId: spend.id,
        idempotencyKey: `refund:${spend.id}`,
      });
      expectLedgerToMatchWallets(fake);
    });

    it('refunds once however many times it is asked', async () => {
      const { fake, service } = setup();
      withAllowance(100);
      const receipt = await service.charge({ organizationId: 'org-1', action: 'DEMO', tokens: 60 });

      await service.refund(receipt);
      await service.refund(receipt);
      await Promise.all([service.refund(receipt), service.refund(receipt)]);

      expect(fake.wallets()[0].allowanceBalance).toBe(100);
      expect(fake.ledger().filter((row) => row.kind === 'REFUND')).toHaveLength(1);
    });

    it('hands a lapsed month’s allowance back as tokens that do not lapse', async () => {
      const { fake, service } = setup();
      withAllowance(1_000);
      const receipt = await service.charge({ organizationId: 'org-1', action: 'DEMO', tokens: 300 });

      at('2026-10-02T09:00:00Z');
      await service.getBalance('org-1'); // the month turns: 700 lapses, 1,000 is granted
      await service.refund(receipt);

      // Refunding into October's allowance would put more there than it was granted.
      expect(fake.wallets()[0]).toMatchObject({ allowanceBalance: 1_000, bonusBalance: 300 });
      expectLedgerToMatchWallets(fake);
    });

    it('does nothing for a charge that never happened', async () => {
      const { fake, service } = setup();
      await service.refund(null);
      await service.refund({ transactionId: 'x', organizationId: 'org-1', action: 'DEMO', tokens: 0, shortfall: 5 });
      expect(fake.ledger()).toHaveLength(0);
    });

    it('will not refund a spend that belongs to another organization', async () => {
      const { fake, service } = setup(['org-1', 'org-2']);
      withAllowance(100);
      const receipt = (await service.charge({ organizationId: 'org-1', action: 'DEMO', tokens: 40 })) as TokenReceipt;

      await expect(service.refund({ ...receipt, organizationId: 'org-2' })).rejects.toThrow(/is not a spend by org-2/);

      expect(fake.wallets().find((w) => w.organizationId === 'org-1')?.allowanceBalance).toBe(60);
      expect(fake.wallets().find((w) => w.organizationId === 'org-2')?.allowanceBalance).toBe(100);
    });
  });

  describe('settleAiUsage', () => {
    const usage = {
      organizationId: 'org-1',
      projectId: 'proj-1',
      taskType: 'SEO_ANALYSIS',
      provider: 'ANTHROPIC',
      model: 'claude-opus-5',
      inputTokens: 1_000,
      outputTokens: 250,
    };

    it('charges what the model used, output weighted above input, and keeps the counts', async () => {
      const { fake, service } = setup();
      withAllowance(10_000);

      const receipt = await service.settleAiUsage(usage);

      expect(receipt).toMatchObject({ tokens: 1_000 + 250 * 4, shortfall: 0, action: 'AI_USAGE' });
      expect(fake.wallets()[0].allowanceBalance).toBe(8_000);
      expect(fake.ledger().at(-1)).toMatchObject({
        kind: 'SPEND',
        action: 'AI_USAGE',
        projectId: 'proj-1',
        detail: { task: 'SEO_ANALYSIS', provider: 'ANTHROPIC', model: 'claude-opus-5', inputTokens: 1_000, outputTokens: 250 },
      });
    });

    it('follows the weights an operator configured', async () => {
      const { service } = setup();
      withAllowance(10_000);
      process.env.TOKENS_AI_OUTPUT_WEIGHT = '2';
      await expect(service.settleAiUsage(usage)).resolves.toMatchObject({ tokens: 1_000 + 250 * 2 });
    });

    it('estimates from the text when the provider reported no counts, and says so', async () => {
      const { fake, service } = setup();
      withAllowance(10_000);

      const receipt = await service.settleAiUsage({
        ...usage,
        inputTokens: 0,
        outputTokens: 0,
        promptChars: 4_000,
        responseChars: 800,
      });

      // 4,000 chars ~ 1,000 in; 800 chars ~ 200 out.
      expect(receipt?.tokens).toBe(1_000 + 200 * 4);
      expect(fake.ledger().at(-1)?.detail).toMatchObject({ inputTokens: 1_000, outputTokens: 200, estimated: true });
    });

    it('charges nothing for a call that used nothing', async () => {
      const { fake, service } = setup();
      await expect(service.settleAiUsage({ ...usage, inputTokens: 0, outputTokens: 0 })).resolves.toBeNull();
      expect(fake.ledger()).toHaveLength(0);
    });

    it('takes what is left, records the rest as shortfall, and never refuses a call that has already happened', async () => {
      const { fake, service } = setup();
      withAllowance(500);

      const receipt = await service.settleAiUsage(usage); // costs 2,000

      expect(receipt).toMatchObject({ tokens: 500, shortfall: 1_500 });
      expect(fake.wallets()[0]).toMatchObject({ allowanceBalance: 0, bonusBalance: 0 });
      expect(fake.ledger().at(-1)).toMatchObject({ kind: 'SPEND', shortfall: 1_500, allowanceAfter: 0 });
      expectLedgerToMatchWallets(fake);
    });

    it('finds the organization from the project when the caller has only that', async () => {
      const { fake, service } = setup();
      withAllowance(10_000);
      fake.projects.set('proj-1', { organizationId: 'org-1' });

      await service.settleAiUsage({ ...usage, organizationId: undefined });

      expect(fake.wallets()[0].allowanceBalance).toBe(8_000);
    });

    it('does nothing for a call that belongs to no organization', async () => {
      const { fake, service } = setup();
      await expect(service.settleAiUsage({ ...usage, organizationId: undefined, projectId: undefined })).resolves.toBeNull();
      await expect(service.settleAiUsage({ ...usage, organizationId: undefined, projectId: 'unknown' })).resolves.toBeNull();
      expect(fake.wallets()).toHaveLength(0);
    });

    it('never throws, even if the ledger is down', async () => {
      const { fake, service } = setup();
      await service.getBalance('org-1');
      fake.failNextTransaction(new Error('database went away'));

      await expect(service.settleAiUsage(usage)).resolves.toBeNull();
      expect(Logger.prototype.error).toHaveBeenCalled();
    });

    it('does nothing when tokens are off', async () => {
      const { fake, service } = setup();
      process.env.TOKENS_ENFORCEMENT = 'off';
      await expect(service.settleAiUsage(usage)).resolves.toBeNull();
      expect(fake.wallets()).toHaveLength(0);
    });
  });

  describe('assertCanStart', () => {
    it('lets a call start while there is anything to pay for it', async () => {
      const { service } = setup();
      withAllowance(1);
      await expect(service.assertCanStart('org-1')).resolves.toBeUndefined();
    });

    it('stops the next call once the tokens are gone, with the 402 body', async () => {
      const { service } = setup();
      withAllowance(10);
      await service.settleAiUsage({ organizationId: 'org-1', taskType: 'X', provider: 'P', model: 'm', inputTokens: 10, outputTokens: 0 });

      const attempt = service.assertCanStart('org-1');
      await expect(attempt).rejects.toBeInstanceOf(InsufficientTokensException);
      await expect(attempt).rejects.toMatchObject({
        status: 402,
        response: {
          error: INSUFFICIENT_TOKENS,
          available: 0,
          message: expect.stringContaining('used all of its tokens for this month'),
        },
      });
    });

    it('holds a call back when there is less than the operator’s minimum', async () => {
      const { service } = setup();
      withAllowance(1_500);
      process.env.TOKENS_MIN_TO_START_AI = '2000';
      await expect(service.assertCanStart('org-1')).rejects.toMatchObject({
        response: { required: 2_000, available: 1_500 },
      });
    });

    it('lets bonus tokens start a call when the allowance is spent', async () => {
      const { service } = setup();
      withAllowance(0);
      await service.adjust({ organizationId: 'org-1', amount: 5 });
      await expect(service.assertCanStart('org-1')).resolves.toBeUndefined();
    });

    it('never blocks a request with no organization', async () => {
      const { service } = setup();
      await expect(service.assertCanStart(undefined)).resolves.toBeUndefined();
    });

    it('does not block in shadow mode, however empty the wallet', async () => {
      const { service } = setup();
      withAllowance(0);
      process.env.TOKENS_ENFORCEMENT = 'shadow';
      await expect(service.assertCanStart('org-1')).resolves.toBeUndefined();
    });

    it('does not even look at the database when tokens are off', async () => {
      const { fake, service } = setup();
      process.env.TOKENS_ENFORCEMENT = 'off';
      await service.assertCanStart('org-1');
      expect(fake.wallets()).toHaveLength(0);
    });

    it('lets the call through if the balance cannot be read, rather than turning a database blip into an outage', async () => {
      const { fake, service } = setup();
      jest.spyOn(fake.prisma.tokenWallet, 'findUnique').mockRejectedValue(new Error('database went away'));

      await expect(service.assertCanStart('org-1')).resolves.toBeUndefined();
      expect(Logger.prototype.warn).toHaveBeenCalledWith(expect.stringContaining('letting the request through'));
    });
  });

  describe('modes', () => {
    it('shadow records everything and refuses nothing, noting what the wallet could not cover', async () => {
      const { fake, service } = setup();
      withAllowance(100);
      process.env.TOKENS_ENFORCEMENT = 'shadow';

      const receipt = await service.charge({ organizationId: 'org-1', action: 'DEMO', tokens: 250 });

      expect(receipt).toMatchObject({ tokens: 100, shortfall: 150 });
      expect(fake.wallets()[0]).toMatchObject({ allowanceBalance: 0, bonusBalance: 0 });

      const usage = await service.usageByAction('org-1', new Date('2026-09-01T00:00:00Z'));
      expect(usage).toEqual([{ action: 'DEMO', tokens: 100, shortfall: 150, count: 1 }]);
    });

    it('off touches nothing', async () => {
      const { fake, service } = setup();
      process.env.TOKENS_ENFORCEMENT = 'off';

      await expect(service.charge({ organizationId: 'org-1', action: 'DEMO', tokens: 250 })).resolves.toBeNull();

      expect(fake.wallets()).toHaveLength(0);
      expect(fake.ledger()).toHaveLength(0);
    });
  });

  describe('the monthly allowance', () => {
    it('lapses what was left and grants a fresh month’s when the month turns, leaving bonus tokens alone', async () => {
      const { fake, service } = setup();
      withAllowance(1_000);
      await service.adjust({ organizationId: 'org-1', amount: 400 });
      await service.charge({ organizationId: 'org-1', action: 'DEMO', tokens: 300 }); // 700 allowance left

      at('2026-10-01T00:00:00Z');
      const balance = await service.getBalance('org-1');

      expect(balance).toMatchObject({ available: 1_400, bonus: 400, allowance: { remaining: 1_000 } });
      expect(balance.allowance.periodStart.toISOString()).toBe('2026-10-01T00:00:00.000Z');
      expect(balance.allowance.periodEnd.toISOString()).toBe('2026-11-01T00:00:00.000Z');
      expect(fake.ledger().slice(-2)).toMatchObject([
        { kind: 'EXPIRY', action: 'ALLOWANCE_EXPIRED', allowanceDelta: -700, allowanceAfter: 0, bonusAfter: 400 },
        { kind: 'ALLOWANCE', action: 'MONTHLY_ALLOWANCE', allowanceDelta: 1_000, allowanceAfter: 1_000, bonusAfter: 400 },
      ]);
      expectLedgerToMatchWallets(fake);
    });

    it('lists the lapse before the grant on a statement', async () => {
      const { fake, service } = setup();
      withAllowance(1_000);
      await service.getBalance('org-1');

      at('2026-10-05T00:00:00Z');
      await service.getBalance('org-1');

      const [expiry, grant] = fake.ledger().filter((row) => row.kind === 'EXPIRY' || (row.kind === 'ALLOWANCE' && row.createdAt.getMonth() === 9));
      expect(expiry.createdAt.getTime()).toBeLessThan(grant.createdAt.getTime());
    });

    it('rolls the month over on a plain balance read, before anything has been spent', async () => {
      const { service } = setup();
      withAllowance(1_000);
      await service.charge({ organizationId: 'org-1', action: 'DEMO', tokens: 1_000 });

      at('2026-10-15T00:00:00Z');
      await expect(service.getBalance('org-1')).resolves.toMatchObject({ available: 1_000 });
    });

    it('does not bank allowances for months nobody used the product', async () => {
      const { fake, service } = setup();
      withAllowance(1_000);
      await service.getBalance('org-1');

      at('2026-12-15T00:00:00Z');
      await expect(service.getBalance('org-1')).resolves.toMatchObject({ available: 1_000 });

      expect(fake.ledger().filter((row) => row.kind === 'ALLOWANCE')).toHaveLength(2); // September's and December's
      expectLedgerToMatchWallets(fake);
    });

    it('rolls over inside a charge too, so the first spend of a month sees the new allowance', async () => {
      const { fake, service } = setup();
      withAllowance(1_000);
      await service.charge({ organizationId: 'org-1', action: 'DEMO', tokens: 1_000 });

      at('2026-10-02T00:00:00Z');
      await expect(service.charge({ organizationId: 'org-1', action: 'DEMO', tokens: 400 })).resolves.toMatchObject({ tokens: 400 });

      expect(fake.wallets()[0].allowanceBalance).toBe(600);
      expectLedgerToMatchWallets(fake);
    });

    it('gives an organization its own allowance from the next month, and back to the default on null', async () => {
      const { service } = setup();
      withAllowance(1_000);
      await service.getBalance('org-1');

      const set = await service.setMonthlyAllowance('org-1', 2_500);
      // This month is unchanged: what it was granted stays 1,000, and 2,500 is what comes next.
      expect(set.allowance).toMatchObject({ granted: 1_000, remaining: 1_000, monthly: 2_500 });

      at('2026-10-02T00:00:00Z');
      await expect(service.getBalance('org-1')).resolves.toMatchObject({
        allowance: { remaining: 2_500, granted: 2_500, monthly: 2_500 },
      });

      const reset = await service.setMonthlyAllowance('org-1', null);
      expect(reset.allowance.monthly).toBe(1_000);
    });

    it('lets a change to the platform default reach organizations that never had their own', async () => {
      const { service } = setup();
      withAllowance(1_000);
      await service.getBalance('org-1');

      withAllowance(4_000);
      at('2026-10-02T00:00:00Z');

      await expect(service.getBalance('org-1')).resolves.toMatchObject({
        allowance: { remaining: 4_000, granted: 4_000, monthly: 4_000 },
      });
    });

    it('does not pretend a mid-month change to the default altered what this month was granted', async () => {
      // Found in the browser: with the default lowered after a wallet existed, the
      // screen read "4.9M of 0" — the balance from the old figure, over the new one.
      const { service } = setup();
      withAllowance(1_000);
      await service.charge({ organizationId: 'org-1', action: 'DEMO', tokens: 100 });

      withAllowance(0);
      const balance = await service.getBalance('org-1');

      expect(balance.allowance).toMatchObject({ remaining: 900, granted: 1_000, monthly: 0 });
    });

    it('records the allowance each new period was granted', async () => {
      const { fake, service } = setup();
      withAllowance(1_000);
      await service.getBalance('org-1');
      expect(fake.wallets()[0].periodAllowance).toBe(1_000);

      withAllowance(3_000);
      at('2026-10-02T00:00:00Z');
      await service.getBalance('org-1');
      expect(fake.wallets()[0].periodAllowance).toBe(3_000);
    });

    it.each([-1, 1.5, Number.NaN, 2_000_000_000])('refuses the allowance %p', async (bad) => {
      const { service } = setup();
      await expect(service.setMonthlyAllowance('org-1', bad)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('adjust', () => {
    it('adds bonus tokens, recording who did it and why', async () => {
      const { fake, service } = setup();
      withAllowance(100);

      const balance = await service.adjust({
        organizationId: 'org-1',
        amount: 5_000,
        note: 'Goodwill after the outage',
        actorUserId: 'operator-1',
      });

      expect(balance).toMatchObject({ available: 5_100, bonus: 5_000 });
      expect(fake.ledger().at(-1)).toMatchObject({
        kind: 'GRANT',
        action: 'ADMIN_GRANT',
        bonusDelta: 5_000,
        bonusAfter: 5_000,
        userId: 'operator-1',
        detail: { note: 'Goodwill after the outage' },
      });
    });

    it('takes tokens back as an adjustment, but never more than the bonus bucket holds', async () => {
      const { fake, service } = setup();
      withAllowance(100);
      await service.adjust({ organizationId: 'org-1', amount: 300 });

      await expect(service.adjust({ organizationId: 'org-1', amount: -100 })).resolves.toMatchObject({ bonus: 200 });
      expect(fake.ledger().at(-1)).toMatchObject({ kind: 'ADJUSTMENT', action: 'ADMIN_ADJUSTMENT', bonusDelta: -100 });

      await expect(service.adjust({ organizationId: 'org-1', amount: -201 })).rejects.toBeInstanceOf(ConflictException);
      expect(fake.wallets()[0].bonusBalance).toBe(200);
      expect(fake.wallets()[0].allowanceBalance).toBe(100); // the allowance is never touched
    });

    it('applies a retried grant once', async () => {
      const { fake, service } = setup();
      const grant = { organizationId: 'org-1', amount: 1_000, idempotencyKey: 'payment-77' };

      await service.adjust(grant);
      await service.adjust(grant);

      expect(fake.wallets()[0].bonusBalance).toBe(1_000);
      expect(fake.ledger().filter((row) => row.kind === 'GRANT')).toHaveLength(1);
    });

    it.each([0, 1.5, Number.NaN, 2_000_000_000, -2_000_000_000])('refuses the amount %p', async (amount) => {
      const { service } = setup();
      await expect(service.adjust({ organizationId: 'org-1', amount })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a grant that would overflow the bucket', async () => {
      const { service } = setup();
      await service.adjust({ organizationId: 'org-1', amount: 1_000_000_000 });
      await service.adjust({ organizationId: 'org-1', amount: 1_000_000_000 });
      await expect(service.adjust({ organizationId: 'org-1', amount: 1 })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('answers 404 for an organization that does not exist', async () => {
      const { service } = setup();
      await expect(service.adjust({ organizationId: 'ghost', amount: 10 })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('history', () => {
    async function withActivity() {
      const ctx = setup();
      withAllowance(10_000);
      await ctx.service.adjust({ organizationId: 'org-1', amount: 500, note: 'internal remark', actorUserId: 'operator-1' });
      for (let i = 0; i < 5; i++) {
        at(`2026-09-29T12:0${i + 1}:00Z`);
        await ctx.service.charge({ organizationId: 'org-1', action: 'DEMO', tokens: 100 + i, detail: { n: i } });
      }
      return ctx;
    }

    it('lists newest first with the balance after each row', async () => {
      const { service } = await withActivity();
      const { items, nextCursor } = await service.history('org-1', { limit: 3 });

      expect(items.map((item) => item.tokens)).toEqual([-104, -103, -102]);
      expect(items[0]).toMatchObject({ kind: 'SPEND', action: 'DEMO', balanceAfter: 10_500 - 100 - 101 - 102 - 103 - 104 });
      expect(nextCursor).not.toBeNull();
    });

    it('pages through everything exactly once', async () => {
      const { fake, service } = await withActivity();
      const seen: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await service.history('org-1', { limit: 2, cursor });
        seen.push(...page.items.map((item) => item.id));
        cursor = page.nextCursor ?? undefined;
      } while (cursor);

      expect(seen).toHaveLength(fake.ledger().length);
      expect(new Set(seen).size).toBe(seen.length);
    });

    it('keeps operator notes and user ids from customers', async () => {
      const { service } = await withActivity();
      const { items } = await service.history('org-1', { limit: 200 });

      const grant = items.find((item) => item.kind === 'GRANT');
      expect(grant?.detail).toBeNull();
      expect(grant).not.toHaveProperty('userId');
      expect(items.find((item) => item.kind === 'SPEND')?.detail).toMatchObject({ n: expect.any(Number) });
    });

    it('shows operators the notes and who acted', async () => {
      const { service } = await withActivity();
      const { items } = await service.history('org-1', { limit: 200, includeInternal: true });

      const grant = items.find((item) => item.kind === 'GRANT');
      expect(grant?.detail).toEqual({ note: 'internal remark' });
      expect(grant?.userId).toBe('operator-1');
    });

    it('caps a page at 200 and floors it at 1', async () => {
      const { service } = await withActivity();
      await expect(service.history('org-1', { limit: 0 })).resolves.toMatchObject({ items: expect.any(Array) });
      const one = await service.history('org-1', { limit: -5 });
      expect(one.items).toHaveLength(1);
    });
  });

  describe('usageByAction', () => {
    it('nets refunds against spends and reports what each feature used', async () => {
      const { service } = setup();
      withAllowance(100_000);
      await service.settleAiUsage({ organizationId: 'org-1', taskType: 'X', provider: 'P', model: 'm', inputTokens: 1_000, outputTokens: 0 });
      await service.settleAiUsage({ organizationId: 'org-1', taskType: 'X', provider: 'P', model: 'm', inputTokens: 500, outputTokens: 0 });
      const scan = await service.charge({ organizationId: 'org-1', action: TokenAction.GEO_GRID_POINT, tokens: 45_000 });
      const failed = await service.charge({ organizationId: 'org-1', action: TokenAction.GEO_GRID_POINT, tokens: 20_000 });
      await service.refund(failed);

      const usage = await service.usageByAction('org-1', new Date('2026-09-01T00:00:00Z'));

      expect(scan).not.toBeNull();
      expect(usage).toEqual([
        { action: 'GEO_GRID_POINT', tokens: 45_000, shortfall: 0, count: 1 },
        { action: 'AI_USAGE', tokens: 1_500, shortfall: 0, count: 2 },
      ]);
    });

    it('ignores anything before the window and anything that is not usage', async () => {
      const { service } = setup();
      withAllowance(100_000);
      await service.settleAiUsage({ organizationId: 'org-1', taskType: 'X', provider: 'P', model: 'm', inputTokens: 1_000, outputTokens: 0 });

      at('2026-10-05T00:00:00Z');
      await service.settleAiUsage({ organizationId: 'org-1', taskType: 'X', provider: 'P', model: 'm', inputTokens: 200, outputTokens: 0 });

      await expect(service.usageByAction('org-1', new Date('2026-10-01T00:00:00Z'))).resolves.toEqual([
        { action: 'AI_USAGE', tokens: 200, shortfall: 0, count: 1 },
      ]);
    });
  });

  describe('peek', () => {
    it('reports what each organization holds without opening a wallet for the ones that have none', async () => {
      const { fake, service } = setup(['org-1', 'org-2', 'org-3']);
      withAllowance(1_000);
      await service.adjust({ organizationId: 'org-1', amount: 250 });
      await service.charge({ organizationId: 'org-2', action: 'DEMO', tokens: 300 });

      const seen = await service.peek(['org-1', 'org-2', 'org-3']);

      expect(seen.get('org-1')).toEqual({ available: 1_250, monthly: 1_000 });
      expect(seen.get('org-2')).toEqual({ available: 700, monthly: 1_000 });
      expect(seen.has('org-3')).toBe(false);
      expect(fake.wallets().map((w) => w.organizationId).sort()).toEqual(['org-1', 'org-2']);
    });

    it('reports what a lapsed month will hold, not its leftovers, and does not roll the wallet', async () => {
      const { fake, service } = setup();
      withAllowance(1_000);
      await service.adjust({ organizationId: 'org-1', amount: 200 });
      await service.charge({ organizationId: 'org-1', action: 'DEMO', tokens: 900 }); // 100 allowance + 200 bonus left

      at('2026-10-10T00:00:00Z');
      const seen = await service.peek(['org-1']);

      expect(seen.get('org-1')).toEqual({ available: 1_200, monthly: 1_000 }); // a fresh 1,000 plus the bonus
      expect(fake.ledger().filter((row) => row.kind === 'EXPIRY')).toHaveLength(0);
    });

    it('answers for an empty list without a query', async () => {
      const { fake, service } = setup();
      await expect(service.peek([])).resolves.toEqual(new Map());
      expect(fake.transactionCount()).toBe(0);
    });
  });

  describe('resolveOrganization', () => {
    it('trusts an organization it is given without a lookup', async () => {
      const { fake, service } = setup();
      const lookup = jest.spyOn(fake.prisma.project, 'findUnique');
      await expect(service.resolveOrganization({ organizationId: 'org-1', projectId: 'proj-1' })).resolves.toBe('org-1');
      expect(lookup).not.toHaveBeenCalled();
    });

    it('finds the organization from the project, once', async () => {
      const { fake, service } = setup();
      fake.projects.set('proj-1', { organizationId: 'org-1' });
      const lookup = jest.spyOn(fake.prisma.project, 'findUnique');

      await expect(service.resolveOrganization({ projectId: 'proj-1' })).resolves.toBe('org-1');
      await expect(service.resolveOrganization({ projectId: 'proj-1' })).resolves.toBe('org-1');

      expect(lookup).toHaveBeenCalledTimes(1);
    });

    it('asks again once a project’s cached organization is stale', async () => {
      const { fake, service } = setup();
      fake.projects.set('proj-1', { organizationId: 'org-1' });
      await service.resolveOrganization({ projectId: 'proj-1' });

      fake.projects.set('proj-1', { organizationId: 'org-2' });
      at('2026-09-29T12:11:00Z'); // past the 10-minute cache
      await expect(service.resolveOrganization({ projectId: 'proj-1' })).resolves.toBe('org-2');
    });

    it('returns nothing for an unknown project or no reference at all', async () => {
      const { service } = setup();
      await expect(service.resolveOrganization({ projectId: 'ghost' })).resolves.toBeUndefined();
      await expect(service.resolveOrganization({})).resolves.toBeUndefined();
    });
  });

  describe('the ledger', () => {
    /** A small deterministic generator, so a failure can be replayed from its seed. */
    function random(seed: number) {
      let state = seed;
      return () => {
        state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
        return state / 4_294_967_296;
      };
    }

    it.each([1, 7, 42, 2026])(
      'always agrees with the balance after a long run of mixed operations (seed %p)',
      async (seed) => {
        const next = random(seed);
        const pick = (n: number) => Math.floor(next() * n);
        const { fake, service } = setup(['org-1', 'org-2']);
        withAllowance(5_000);

        const receipts: TokenReceipt[] = [];
        let clock = new Date('2026-09-01T00:00:00Z').getTime();

        for (let step = 0; step < 300; step++) {
          const organizationId = pick(2) === 0 ? 'org-1' : 'org-2';
          clock += pick(4) === 0 ? pick(20) * 24 * 60 * 60 * 1000 : pick(60_000); // sometimes jump days
          jest.setSystemTime(clock);

          try {
            switch (pick(7)) {
              case 0:
              case 1: {
                const receipt = await service.charge({ organizationId, action: 'DEMO', tokens: pick(1_500) });
                if (receipt) receipts.push(receipt);
                break;
              }
              case 2: {
                const receipt = await service.settleAiUsage({
                  organizationId,
                  taskType: 'X',
                  provider: 'P',
                  model: 'm',
                  inputTokens: pick(3_000),
                  outputTokens: pick(600),
                });
                if (receipt) receipts.push(receipt);
                break;
              }
              case 3:
                if (receipts.length) await service.refund(receipts[pick(receipts.length)]);
                break;
              case 4:
                await service.adjust({ organizationId, amount: pick(2_000) + 1 });
                break;
              case 5:
                await service.adjust({ organizationId, amount: -(pick(800) + 1) });
                break;
              default:
                await service.getBalance(organizationId);
            }
          } catch (error) {
            // Refusals are part of the run; anything else is a bug.
            if (
              !(error instanceof InsufficientTokensException) &&
              !(error instanceof ConflictException) &&
              !(error instanceof BadRequestException)
            ) {
              throw error;
            }
          }
        }

        expect(fake.ledger().length).toBeGreaterThan(50);
        expectLedgerToMatchWallets(fake);
      },
    );
  });
});
