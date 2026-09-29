import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, TokenTransaction, TokenTransactionKind, TokenWallet } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { InsufficientTokensException } from './insufficient-tokens.exception';
import {
  MAX_BUCKET_BALANCE,
  MAX_TOKENS_PER_OPERATION,
  TokenAction,
  TokenConfig,
  TokenMode,
  aiUsageTokens,
  estimateTokensFromChars,
  periodContaining,
  readTokenConfig,
  splitDebit,
} from './token-rates';

type Tx = Prisma.TransactionClient;

/** An organization's tokens as the API reports them. */
export interface TokenBalance {
  organizationId: string;
  mode: TokenMode;
  /** Everything spendable right now: what is left of the allowance plus bonus tokens. */
  available: number;
  allowance: {
    /** Left of this period's allowance. Lapses at `periodEnd`. */
    remaining: number;
    /** What this period's allowance was when it was granted: the "of" in "remaining of granted". */
    granted: number;
    /**
     * What the next period will grant. Differs from `granted` when an operator
     * has changed the figure since the period began.
     */
    monthly: number;
    periodStart: Date;
    periodEnd: Date;
  };
  /** Tokens that do not lapse. */
  bonus: number;
}

export interface ChargeRequest {
  organizationId: string;
  /** What is being bought. */
  action: TokenAction | string;
  /** Tokens to take. Zero charges nothing. */
  tokens: number;
  projectId?: string;
  userId?: string;
  /** Stops a retried request from charging twice. */
  idempotencyKey?: string;
  /** Facts behind the number, kept on the ledger row. */
  detail?: Record<string, unknown>;
}

/** What a charge did, and what a refund needs to undo it. */
export interface TokenReceipt {
  transactionId: string;
  organizationId: string;
  action: string;
  /** Tokens actually taken. Less than asked for only when `shortfall` is nonzero. */
  tokens: number;
  shortfall: number;
}

export interface AiTokenUsage {
  organizationId?: string;
  projectId?: string;
  userId?: string;
  /** The router's `AiTask`, e.g. "SEO_ANALYSIS". */
  taskType: string;
  provider: string;
  model: string;
  /** As the provider reported them. Zero for both means it reported nothing. */
  inputTokens: number;
  outputTokens: number;
  /** Sizes of what was sent and received, used only when the provider reported no counts. */
  promptChars?: number;
  responseChars?: number;
}

export interface AdjustRequest {
  organizationId: string;
  /** Signed. Positive adds bonus tokens; negative takes bonus tokens back. */
  amount: number;
  /** Short label for the ledger, e.g. "ADMIN_GRANT". */
  reason?: string;
  note?: string;
  actorUserId?: string;
  /** Makes a retried grant (a payment webhook, say) apply once. */
  idempotencyKey?: string;
}

export interface TokenTransactionView {
  id: string;
  kind: TokenTransactionKind;
  action: string;
  /** Net change to the balance: negative when tokens left. */
  tokens: number;
  /** Tokens the work needed beyond what the wallet held. */
  shortfall: number;
  /** The balance once this row applied. */
  balanceAfter: number;
  projectId: string | null;
  createdAt: Date;
  /** Present for spends and refunds. Operator notes are not shown to customers. */
  detail: Prisma.JsonValue | null;
  /** Operators only. */
  userId?: string | null;
}

export interface TokenUsageLine {
  action: string;
  /** Tokens spent, net of refunds. */
  tokens: number;
  /** Tokens the actions needed beyond what the wallet held. */
  shortfall: number;
  /** Actions performed, net of refunds. */
  count: number;
}

/** A per-project lookup is cached this long: a project rarely moves between organizations. */
const PROJECT_ORG_TTL_MS = 10 * 60 * 1000;
const PROJECT_ORG_CACHE_MAX = 2_000;

/** Interactive transactions wait for a pooled connection and hold a row lock; give both room on a cold database. */
const TX_OPTIONS = { maxWait: 5_000, timeout: 10_000 } as const;

/**
 * Organizations' token balances and the ledger behind them.
 *
 * Three rules everything here follows:
 *
 * 1. **Every balance change happens under the wallet's row lock.** Taking the
 *    lock is an `UPDATE` at the top of the transaction, so concurrent spends for
 *    one organization queue and each reads the balance the last one left. There
 *    is no read-then-write window for two requests to both spend the same tokens.
 * 2. **Every change has exactly one ledger row**, written in the same
 *    transaction, so the balance can always be replayed from the ledger.
 * 3. **Bookkeeping never takes the product down.** Only a definitive "not enough
 *    tokens" stops work. A database hiccup while charging is logged and the work
 *    proceeds — the same call the AI usage ledger makes, for the same reason.
 */
@Injectable()
export class TokensService implements OnModuleInit {
  private readonly logger = new Logger(TokensService.name);
  private readonly projectOrganizations = new Map<string, { organizationId: string; cachedAt: number }>();

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    const config = readTokenConfig();
    this.logger.log(
      config.mode === 'off'
        ? 'Tokens are switched off (TOKENS_ENFORCEMENT=off): nothing is metered or limited.'
        : `Tokens ${config.mode === 'enforce' ? 'enforced' : 'in shadow mode (metered, never blocking)'}: ` +
            `${config.monthlyAllowance.toLocaleString('en-US')} a month by default.`,
    );
  }

  config(): TokenConfig {
    return readTokenConfig();
  }

  // ------------------------------------------------------------------ reading

  /**
   * The organization's tokens. Creates the wallet on first use and rolls it into
   * the current month if the last period has ended, so the figure is right even
   * for someone who opens the screen before spending anything this month.
   */
  async getBalance(organizationId: string): Promise<TokenBalance> {
    let wallet = await this.prisma.tokenWallet.findUnique({ where: { organizationId } });
    if (!wallet) {
      await this.ensureWallet(organizationId);
      wallet = await this.prisma.tokenWallet.findUniqueOrThrow({ where: { organizationId } });
    }
    if (new Date() >= wallet.periodEnd) {
      wallet = await this.underLock(organizationId, async (_tx, locked) => locked);
    }
    return this.toBalance(wallet);
  }

  /**
   * What each of these organizations holds, for a directory screen. Read-only:
   * looking must not open a wallet, so an organization that has never used a
   * metered feature is simply absent from the result.
   *
   * A wallet whose month has ended has not been rolled yet — that happens on its
   * next use — but what it will hold then is known, so that is what is reported
   * rather than a lapsed month's leftovers.
   */
  async peek(organizationIds: string[]): Promise<Map<string, { available: number; monthly: number }>> {
    if (organizationIds.length === 0) return new Map();
    const config = readTokenConfig();
    const now = new Date();
    const wallets = await this.prisma.tokenWallet.findMany({ where: { organizationId: { in: organizationIds } } });
    return new Map(
      wallets.map((wallet) => {
        const monthly = wallet.monthlyAllowance ?? config.monthlyAllowance;
        const allowance = now >= wallet.periodEnd ? monthly : wallet.allowanceBalance;
        return [wallet.organizationId, { available: allowance + wallet.bonusBalance, monthly }] as const;
      }),
    );
  }

  /** Tokens used since `since`, by feature, net of refunds. */
  async usageByAction(organizationId: string, since: Date): Promise<TokenUsageLine[]> {
    const rows = await this.prisma.tokenTransaction.groupBy({
      by: ['action', 'kind'],
      where: { organizationId, createdAt: { gte: since }, kind: { in: ['SPEND', 'REFUND'] } },
      _sum: { allowanceDelta: true, bonusDelta: true, shortfall: true },
      _count: { _all: true },
    });

    const lines = new Map<string, TokenUsageLine>();
    for (const row of rows) {
      const line = lines.get(row.action) ?? { action: row.action, tokens: 0, shortfall: 0, count: 0 };
      const moved = (row._sum?.allowanceDelta ?? 0) + (row._sum?.bonusDelta ?? 0);
      // Deltas are negative for a spend and positive for a refund, so negating
      // the sum nets the two.
      line.tokens -= moved;
      if (row.kind === 'SPEND') {
        line.shortfall += row._sum?.shortfall ?? 0;
        line.count += row._count?._all ?? 0;
      } else {
        line.count -= row._count?._all ?? 0;
      }
      lines.set(row.action, line);
    }
    return [...lines.values()].sort((a, b) => b.tokens - a.tokens);
  }

  /** The ledger, newest first. `cursor` is the `nextCursor` of the previous page. */
  async history(
    organizationId: string,
    options: { limit?: number; cursor?: string; includeInternal?: boolean } = {},
  ): Promise<{ items: TokenTransactionView[]; nextCursor: string | null }> {
    const limit = Math.min(200, Math.max(1, Math.floor(options.limit ?? 50)));
    const rows = await this.prisma.tokenTransaction.findMany({
      where: { organizationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor } } : {}),
    });

    const page = rows.slice(0, limit);
    return {
      items: page.map((row) => this.toView(row, options.includeInternal === true)),
      nextCursor: rows.length > limit ? rows[limit].id : null,
    };
  }

  /**
   * The organization a piece of work belongs to. Callers that hold only a
   * project (a background job, a service several layers below the request) can
   * still be charged to the right wallet.
   */
  async resolveOrganization(ref: { organizationId?: string | null; projectId?: string | null }): Promise<string | undefined> {
    if (ref.organizationId) return ref.organizationId;
    if (!ref.projectId) return undefined;

    const cached = this.projectOrganizations.get(ref.projectId);
    if (cached && Date.now() - cached.cachedAt < PROJECT_ORG_TTL_MS) return cached.organizationId;

    const project = await this.prisma.project.findUnique({
      where: { id: ref.projectId },
      select: { organizationId: true },
    });
    if (!project) return undefined;

    if (this.projectOrganizations.size >= PROJECT_ORG_CACHE_MAX) {
      const oldest = this.projectOrganizations.keys().next().value;
      if (oldest !== undefined) this.projectOrganizations.delete(oldest);
    }
    this.projectOrganizations.set(ref.projectId, { organizationId: project.organizationId, cachedAt: Date.now() });
    return project.organizationId;
  }

  // ---------------------------------------------------------------- the gate

  /**
   * Refuses to start work for an organization with (almost) no tokens left.
   *
   * For metered work whose price is only known afterwards — a model call — this
   * is the ceiling: it stops the next call, and the one that crosses zero is
   * settled by whatever the wallet still holds. A request with no organization,
   * or a deployment that is not enforcing, is never blocked.
   */
  async assertCanStart(organizationId: string | undefined, minimum?: number): Promise<void> {
    const config = readTokenConfig();
    if (config.mode !== 'enforce' || !organizationId) return;

    const required = Math.max(1, Math.floor(minimum ?? config.minimumToStartAi));

    let balance: TokenBalance;
    try {
      balance = await this.getBalance(organizationId);
    } catch (error) {
      this.logger.warn(`Could not read the token balance for ${organizationId}; letting the request through: ${describe(error)}`);
      return;
    }

    if (balance.available < required) {
      throw new InsufficientTokensException({
        required,
        available: balance.available,
        resetsAt: balance.allowance.periodEnd,
      });
    }
  }

  // ---------------------------------------------------------------- spending

  /**
   * Takes exactly `tokens`, or refuses.
   *
   * For work whose price is known before it starts. Returns a receipt for
   * `refund`, or null when nothing was charged (tokens off, a zero price, or a
   * bookkeeping failure that must not stop the work).
   */
  async charge(request: ChargeRequest): Promise<TokenReceipt | null> {
    return this.debit(request, { strict: true });
  }

  /**
   * Charges `work`'s price, runs it, and gives the tokens back if it throws.
   * A caller's failure is never billed to the customer.
   */
  async withCharge<T>(request: ChargeRequest, work: () => Promise<T>): Promise<T> {
    const receipt = await this.charge(request);
    try {
      return await work();
    } catch (error) {
      await this.refundQuietly(receipt);
      throw error;
    }
  }

  /**
   * Charges a finished model call from the tokens it used.
   *
   * Settled after the fact and clamped to what the wallet holds, because the
   * customer already has their answer and the provider has already billed us:
   * refusing now would punish the customer for our arithmetic. Never throws.
   */
  async settleAiUsage(usage: AiTokenUsage): Promise<TokenReceipt | null> {
    const config = readTokenConfig();
    if (config.mode === 'off') return null;

    try {
      const organizationId = await this.resolveOrganization(usage);
      if (!organizationId) return null;

      const reported = usage.inputTokens > 0 || usage.outputTokens > 0;
      const inputTokens = reported ? usage.inputTokens : estimateTokensFromChars(usage.promptChars ?? 0);
      const outputTokens = reported ? usage.outputTokens : estimateTokensFromChars(usage.responseChars ?? 0);
      const tokens = aiUsageTokens(inputTokens, outputTokens, config);
      if (tokens <= 0) return null;

      return await this.debit(
        {
          organizationId,
          action: TokenAction.AI_USAGE,
          tokens,
          projectId: usage.projectId,
          userId: usage.userId,
          detail: {
            task: usage.taskType,
            provider: usage.provider,
            model: usage.model,
            inputTokens,
            outputTokens,
            ...(reported ? {} : { estimated: true }),
          },
        },
        { strict: false },
      );
    } catch (error) {
      this.logger.error(`Could not charge tokens for an AI call (${usage.provider}/${usage.model}): ${describe(error)}`);
      return null;
    }
  }

  private async debit(request: ChargeRequest, options: { strict: boolean }): Promise<TokenReceipt | null> {
    const config = readTokenConfig();
    if (config.mode === 'off' || !request.organizationId) return null;

    const tokens = wholeTokens(request.tokens);
    if (tokens === 0) return null;

    try {
      return await this.underLock(request.organizationId, async (tx, wallet) => {
        if (request.idempotencyKey) {
          const done = await tx.tokenTransaction.findUnique({ where: { idempotencyKey: request.idempotencyKey } });
          if (done) return receiptOf(done);
        }

        const available = wallet.allowanceBalance + wallet.bonusBalance;
        // Shadow mode records the spend and never refuses it: whatever the
        // wallet cannot cover becomes shortfall instead.
        if (options.strict && config.mode === 'enforce' && available < tokens) {
          throw new InsufficientTokensException({ required: tokens, available, resetsAt: wallet.periodEnd });
        }

        const { fromAllowance, fromBonus, shortfall } = splitDebit(wallet.allowanceBalance, wallet.bonusBalance, tokens);
        const after =
          fromAllowance + fromBonus > 0
            ? await tx.tokenWallet.update({
                where: { id: wallet.id },
                data: {
                  allowanceBalance: { decrement: fromAllowance },
                  bonusBalance: { decrement: fromBonus },
                },
              })
            : wallet;

        const row = await tx.tokenTransaction.create({
          data: {
            organizationId: request.organizationId,
            kind: 'SPEND',
            action: request.action,
            allowanceDelta: -fromAllowance,
            bonusDelta: -fromBonus,
            shortfall,
            allowanceAfter: after.allowanceBalance,
            bonusAfter: after.bonusBalance,
            projectId: request.projectId ?? null,
            userId: request.userId ?? null,
            idempotencyKey: request.idempotencyKey ?? null,
            detail: (request.detail as Prisma.InputJsonObject | undefined) ?? undefined,
          },
        });
        return receiptOf(row);
      });
    } catch (error) {
      // A definitive answer — not enough tokens, no such organization — goes to
      // the caller. Anything else is our bookkeeping failing, which is not the
      // customer's problem and must not cost them their work.
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Could not charge ${tokens.toLocaleString('en-US')} tokens for ${request.action} to ${request.organizationId}; ` +
          `the work goes ahead uncharged: ${describe(error)}`,
      );
      return null;
    }
  }

  /**
   * Returns what a spend took. Safe to call twice: the second call finds the
   * first one's ledger row and does nothing.
   */
  async refund(receipt: TokenReceipt | null): Promise<void> {
    if (!receipt || receipt.tokens <= 0) return;

    await this.underLock(receipt.organizationId, async (tx, wallet) => {
      const key = `refund:${receipt.transactionId}`;
      const already = await tx.tokenTransaction.findUnique({ where: { idempotencyKey: key }, select: { id: true } });
      if (already) return;

      // Read the amounts off the ledger, not off the receipt: the ledger is the
      // record, and a receipt is only a pointer to it.
      const spend = await tx.tokenTransaction.findUnique({ where: { id: receipt.transactionId } });
      if (!spend || spend.kind !== 'SPEND' || spend.organizationId !== receipt.organizationId) {
        throw new Error(`Transaction ${receipt.transactionId} is not a spend by ${receipt.organizationId}.`);
      }

      const tookAllowance = -spend.allowanceDelta;
      const tookBonus = -spend.bonusDelta;
      // An allowance that has since lapsed cannot be handed back into the new
      // month's, which would put more there than it was granted. The customer
      // still gets the value back, as tokens that do not lapse.
      const samePeriod = spend.createdAt >= wallet.periodStart;
      const toAllowance = samePeriod ? tookAllowance : 0;
      const toBonus = tookBonus + (samePeriod ? 0 : tookAllowance);

      const after = await tx.tokenWallet.update({
        where: { id: wallet.id },
        data: { allowanceBalance: { increment: toAllowance }, bonusBalance: { increment: toBonus } },
      });
      await tx.tokenTransaction.create({
        data: {
          organizationId: spend.organizationId,
          kind: 'REFUND',
          action: spend.action,
          allowanceDelta: toAllowance,
          bonusDelta: toBonus,
          allowanceAfter: after.allowanceBalance,
          bonusAfter: after.bonusBalance,
          projectId: spend.projectId,
          userId: spend.userId,
          refundOfId: spend.id,
          idempotencyKey: key,
        },
      });
    });
  }

  private async refundQuietly(receipt: TokenReceipt | null): Promise<void> {
    try {
      await this.refund(receipt);
    } catch (error) {
      // The caller is already failing; the refund failing too must not replace
      // the real error. Logged with the ids needed to put it right by hand.
      this.logger.error(
        `Could not refund ${receipt?.tokens ?? 0} tokens (transaction ${receipt?.transactionId}, ` +
          `organization ${receipt?.organizationId}); refund it by hand: ${describe(error)}`,
      );
    }
  }

  // ------------------------------------------------------- operator controls

  /**
   * Adds or removes bonus tokens. Positive is a grant; negative is a
   * correction, and cannot take back more than the wallet holds in bonus
   * tokens (the allowance is changed with `setMonthlyAllowance`, not here).
   */
  async adjust(request: AdjustRequest): Promise<TokenBalance> {
    const amount = request.amount;
    if (!Number.isInteger(amount) || amount === 0) {
      throw new BadRequestException('The amount must be a whole number of tokens, other than zero.');
    }
    if (Math.abs(amount) > MAX_TOKENS_PER_OPERATION) {
      throw new BadRequestException(`One adjustment can move at most ${MAX_TOKENS_PER_OPERATION.toLocaleString('en-US')} tokens.`);
    }

    await this.underLock(request.organizationId, async (tx, wallet) => {
      if (request.idempotencyKey) {
        const done = await tx.tokenTransaction.findUnique({
          where: { idempotencyKey: request.idempotencyKey },
          select: { id: true },
        });
        if (done) return;
      }

      const nextBonus = wallet.bonusBalance + amount;
      if (nextBonus < 0) {
        throw new ConflictException(
          `This workspace holds only ${wallet.bonusBalance.toLocaleString('en-US')} bonus tokens, so that many cannot be taken back.`,
        );
      }
      if (nextBonus > MAX_BUCKET_BALANCE) {
        throw new BadRequestException(`A workspace cannot hold more than ${MAX_BUCKET_BALANCE.toLocaleString('en-US')} bonus tokens.`);
      }

      const after = await tx.tokenWallet.update({ where: { id: wallet.id }, data: { bonusBalance: nextBonus } });
      await tx.tokenTransaction.create({
        data: {
          organizationId: request.organizationId,
          kind: amount > 0 ? 'GRANT' : 'ADJUSTMENT',
          action: request.reason ?? (amount > 0 ? 'ADMIN_GRANT' : 'ADMIN_ADJUSTMENT'),
          allowanceDelta: 0,
          bonusDelta: amount,
          allowanceAfter: after.allowanceBalance,
          bonusAfter: after.bonusBalance,
          userId: request.actorUserId ?? null,
          idempotencyKey: request.idempotencyKey ?? null,
          detail: request.note ? { note: request.note } : undefined,
        },
      });
    });

    return this.getBalance(request.organizationId);
  }

  /**
   * Sets the organization's own monthly allowance, or clears it (null) to follow
   * the platform default again. Takes effect when the next period starts; to
   * give tokens now, grant them.
   */
  async setMonthlyAllowance(organizationId: string, monthlyAllowance: number | null): Promise<TokenBalance> {
    if (monthlyAllowance !== null && (!Number.isInteger(monthlyAllowance) || monthlyAllowance < 0 || monthlyAllowance > MAX_TOKENS_PER_OPERATION)) {
      throw new BadRequestException(
        `The monthly allowance must be a whole number from 0 to ${MAX_TOKENS_PER_OPERATION.toLocaleString('en-US')}, or null for the default.`,
      );
    }
    await this.underLock(organizationId, async (tx, wallet) => {
      await tx.tokenWallet.update({ where: { id: wallet.id }, data: { monthlyAllowance } });
    });
    return this.getBalance(organizationId);
  }

  // ---------------------------------------------------------------- internals

  /**
   * Creates the wallet with this month's allowance if there is none. Safe to
   * race: the unique index lets exactly one creator win and the others carry on.
   */
  private async ensureWallet(organizationId: string): Promise<void> {
    const config = readTokenConfig();
    const now = new Date();
    const { start, end } = periodContaining(now);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.tokenWallet.create({
          data: {
            organizationId,
            allowanceBalance: config.monthlyAllowance,
            periodAllowance: config.monthlyAllowance,
            bonusBalance: 0,
            monthlyAllowance: null,
            periodStart: start,
            periodEnd: end,
          },
        });
        if (config.monthlyAllowance > 0) {
          await tx.tokenTransaction.create({
            data: {
              organizationId,
              kind: 'ALLOWANCE',
              action: 'MONTHLY_ALLOWANCE',
              allowanceDelta: config.monthlyAllowance,
              bonusDelta: 0,
              allowanceAfter: config.monthlyAllowance,
              bonusAfter: 0,
              idempotencyKey: `allowance:${organizationId}:${start.toISOString()}`,
              detail: { periodStart: start.toISOString(), periodEnd: end.toISOString() },
            },
          });
        }
      }, TX_OPTIONS);
    } catch (error) {
      if (errorCode(error) === 'P2002') return; // another request created it first
      if (errorCode(error) === 'P2003') throw new NotFoundException('Organization not found.');
      throw error;
    }
  }

  /**
   * Runs `work` with the wallet locked and brought into the current period.
   *
   * The `UPDATE` at the top is the lock: it is held until the transaction ends,
   * so a concurrent spend waits here and then sees this one's result. Its
   * `RETURNING` row is the balance as of after that wait, which is why `work`
   * is handed it rather than a value read earlier.
   */
  private async underLock<T>(organizationId: string, work: (tx: Tx, wallet: TokenWallet) => Promise<T>): Promise<T> {
    if (!(await this.prisma.tokenWallet.findUnique({ where: { organizationId }, select: { id: true } }))) {
      await this.ensureWallet(organizationId);
    }

    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.tokenWallet.update({ where: { organizationId }, data: { updatedAt: new Date() } });
      const wallet = await this.rollPeriodIfDue(tx, locked, new Date());
      return work(tx, wallet);
    }, TX_OPTIONS);
  }

  /**
   * If the wallet's month is over: lapses what is left of its allowance and
   * grants the new one, each as its own ledger row. Nothing is granted for
   * months skipped while nobody used the product — a quiet account does not
   * bank allowances.
   */
  private async rollPeriodIfDue(tx: Tx, wallet: TokenWallet, now: Date): Promise<TokenWallet> {
    if (now < wallet.periodEnd) return wallet;

    const next = periodContaining(now);
    const monthly = wallet.monthlyAllowance ?? readTokenConfig().monthlyAllowance;
    // Stamped explicitly so a statement lists the lapse before the grant, which
    // rows written in one transaction would otherwise tie on.
    const lapsedAt = now;
    const grantedAt = new Date(now.getTime() + 1);

    if (wallet.allowanceBalance > 0) {
      await tx.tokenTransaction.create({
        data: {
          organizationId: wallet.organizationId,
          kind: 'EXPIRY',
          action: 'ALLOWANCE_EXPIRED',
          allowanceDelta: -wallet.allowanceBalance,
          bonusDelta: 0,
          allowanceAfter: 0,
          bonusAfter: wallet.bonusBalance,
          idempotencyKey: `expiry:${wallet.organizationId}:${wallet.periodStart.toISOString()}`,
          detail: { periodStart: wallet.periodStart.toISOString(), periodEnd: wallet.periodEnd.toISOString() },
          createdAt: lapsedAt,
        },
      });
    }
    if (monthly > 0) {
      await tx.tokenTransaction.create({
        data: {
          organizationId: wallet.organizationId,
          kind: 'ALLOWANCE',
          action: 'MONTHLY_ALLOWANCE',
          allowanceDelta: monthly,
          bonusDelta: 0,
          allowanceAfter: monthly,
          bonusAfter: wallet.bonusBalance,
          idempotencyKey: `allowance:${wallet.organizationId}:${next.start.toISOString()}`,
          detail: { periodStart: next.start.toISOString(), periodEnd: next.end.toISOString() },
          createdAt: grantedAt,
        },
      });
    }

    return tx.tokenWallet.update({
      where: { id: wallet.id },
      data: { allowanceBalance: monthly, periodAllowance: monthly, periodStart: next.start, periodEnd: next.end },
    });
  }

  private toBalance(wallet: TokenWallet): TokenBalance {
    const config = readTokenConfig();
    return {
      organizationId: wallet.organizationId,
      mode: config.mode,
      available: wallet.allowanceBalance + wallet.bonusBalance,
      allowance: {
        remaining: wallet.allowanceBalance,
        granted: wallet.periodAllowance,
        monthly: wallet.monthlyAllowance ?? config.monthlyAllowance,
        periodStart: wallet.periodStart,
        periodEnd: wallet.periodEnd,
      },
      bonus: wallet.bonusBalance,
    };
  }

  private toView(row: TokenTransaction, includeInternal: boolean): TokenTransactionView {
    // Facts about the work (which model, how many tokens in and out) are the
    // customer's own usage and are shown. An operator's note on a grant is
    // internal and is not.
    const showDetail = includeInternal || row.kind === 'SPEND' || row.kind === 'REFUND';
    return {
      id: row.id,
      kind: row.kind,
      action: row.action,
      tokens: row.allowanceDelta + row.bonusDelta,
      shortfall: row.shortfall,
      balanceAfter: row.allowanceAfter + row.bonusAfter,
      projectId: row.projectId,
      createdAt: row.createdAt,
      detail: showDetail ? row.detail : null,
      ...(includeInternal ? { userId: row.userId } : {}),
    };
  }
}

/** A whole, non-negative token count, or a clear refusal to guess what was meant. */
function wholeTokens(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new BadRequestException('A token amount must be a number of zero or more.');
  }
  return Math.min(Math.ceil(value), MAX_TOKENS_PER_OPERATION);
}

function receiptOf(row: TokenTransaction): TokenReceipt {
  return {
    transactionId: row.id,
    organizationId: row.organizationId,
    action: row.action,
    tokens: -(row.allowanceDelta + row.bonusDelta),
    shortfall: row.shortfall,
  };
}

function errorCode(error: unknown): string | undefined {
  return (error as { code?: string } | null)?.code;
}

function describe(error: unknown): string {
  return (error as Error)?.message ?? String(error);
}
