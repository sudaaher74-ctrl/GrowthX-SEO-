import { PrismaService } from '../../database/prisma.service';

/**
 * An in-memory stand-in for the parts of Prisma the token ledger uses.
 *
 * It models the properties the service's correctness rests on, so a test that
 * passes here means something:
 *  - a transaction runs alone (Postgres' row lock, coarsened to the whole
 *    database) and its writes are invisible outside until it commits;
 *  - a transaction that throws leaves no trace;
 *  - unique indexes and the migration's CHECK constraints reject a bad write
 *    with an error instead of accepting it.
 *
 * It does not model everything Prisma does — only the calls the token service
 * makes, and it throws on anything else so a new query cannot pass silently.
 */

export interface WalletRow {
  id: string;
  organizationId: string;
  allowanceBalance: number;
  bonusBalance: number;
  periodAllowance: number;
  monthlyAllowance: number | null;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface LedgerRow {
  id: string;
  organizationId: string;
  kind: 'ALLOWANCE' | 'EXPIRY' | 'GRANT' | 'ADJUSTMENT' | 'SPEND' | 'REFUND';
  action: string;
  allowanceDelta: number;
  bonusDelta: number;
  shortfall: number;
  allowanceAfter: number;
  bonusAfter: number;
  projectId: string | null;
  userId: string | null;
  idempotencyKey: string | null;
  refundOfId: string | null;
  detail: unknown;
  createdAt: Date;
}

interface State {
  wallets: WalletRow[];
  ledger: LedgerRow[];
}

export interface FakePrisma {
  prisma: PrismaService;
  /** Committed state, for assertions. */
  wallets: () => WalletRow[];
  ledger: () => LedgerRow[];
  /** Registers organizations the wallet foreign key will accept. */
  organizations: Set<string>;
  /** Registers projects for organization lookups. */
  projects: Map<string, { organizationId: string }>;
  /** Makes the next `$transaction` fail, to test bookkeeping outages. */
  failNextTransaction: (error: Error) => void;
  /** How many transactions have run. */
  transactionCount: () => number;
}

let sequence = 0;
const nextId = (prefix: string) => `${prefix}-${++sequence}`;

function uniqueViolation(target: string): Error {
  return Object.assign(new Error(`Unique constraint failed on the fields: (${target})`), { code: 'P2002' });
}

function notFound(): Error {
  return Object.assign(new Error('An operation failed because it depends on one or more records that were required but not found.'), { code: 'P2025' });
}

function checkViolation(name: string): Error {
  return Object.assign(new Error(`new row violates check constraint "${name}"`), { code: 'P2010' });
}

function applyNumeric(current: number, change: unknown): number {
  if (typeof change === 'number') return change;
  const op = change as { increment?: number; decrement?: number };
  if (op && typeof op.increment === 'number') return current + op.increment;
  if (op && typeof op.decrement === 'number') return current - op.decrement;
  throw new Error(`The fake cannot apply ${JSON.stringify(change)}`);
}

function matches(row: LedgerRow, where: Record<string, any> = {}): boolean {
  for (const [key, condition] of Object.entries(where)) {
    const value = (row as any)[key];
    if (condition !== null && typeof condition === 'object' && !(condition instanceof Date)) {
      if ('in' in condition && !condition.in.includes(value)) return false;
      if ('gte' in condition && !(value >= condition.gte)) return false;
      if ('lte' in condition && !(value <= condition.lte)) return false;
    } else if (value !== condition) {
      return false;
    }
  }
  return true;
}

export function createFakePrisma(): FakePrisma {
  let committed: State = { wallets: [], ledger: [] };
  const organizations = new Set<string>();
  const projects = new Map<string, { organizationId: string }>();
  let queue: Promise<unknown> = Promise.resolve();
  let pendingFailure: Error | null = null;
  let transactions = 0;

  const clone = (s: State): State => ({
    wallets: s.wallets.map((w) => ({ ...w })),
    ledger: s.ledger.map((l) => ({ ...l })),
  });

  /** The Prisma surface, reading and writing whichever state `get` returns. */
  function client(get: () => State) {
    const findWallet = (where: { id?: string; organizationId?: string }) =>
      get().wallets.find((w) => (where.id ? w.id === where.id : w.organizationId === where.organizationId));

    return {
      tokenWallet: {
        findUnique: async ({ where, select }: any) => {
          const row = findWallet(where);
          if (!row) return null;
          return select ? Object.fromEntries(Object.keys(select).map((k) => [k, (row as any)[k]])) : { ...row };
        },
        findUniqueOrThrow: async ({ where }: any) => {
          const row = findWallet(where);
          if (!row) throw notFound();
          return { ...row };
        },
        findMany: async ({ where }: any = {}) =>
          get()
            .wallets.filter((w) => !where?.organizationId?.in || where.organizationId.in.includes(w.organizationId))
            .map((w) => ({ ...w })),
        create: async ({ data }: any) => {
          if (!organizations.has(data.organizationId)) {
            throw Object.assign(new Error('Foreign key constraint failed'), { code: 'P2003' });
          }
          if (get().wallets.some((w) => w.organizationId === data.organizationId)) {
            throw uniqueViolation('organizationId');
          }
          const now = new Date();
          const row: WalletRow = {
            id: nextId('wallet'),
            allowanceBalance: 0,
            bonusBalance: 0,
            periodAllowance: 0,
            monthlyAllowance: null,
            createdAt: now,
            updatedAt: now,
            ...data,
          };
          if (row.allowanceBalance < 0 || row.bonusBalance < 0) throw checkViolation('TokenWallet_balances_non_negative');
          get().wallets.push(row);
          return { ...row };
        },
        update: async ({ where, data }: any) => {
          const row = findWallet(where);
          if (!row) throw notFound();
          const next = {
            allowanceBalance: 'allowanceBalance' in data ? applyNumeric(row.allowanceBalance, data.allowanceBalance) : row.allowanceBalance,
            bonusBalance: 'bonusBalance' in data ? applyNumeric(row.bonusBalance, data.bonusBalance) : row.bonusBalance,
          };
          // The migration's CHECK constraint: a bad write is refused, not stored.
          if (next.allowanceBalance < 0 || next.bonusBalance < 0) throw checkViolation('TokenWallet_balances_non_negative');
          Object.assign(row, {
            ...next,
            ...('periodAllowance' in data ? { periodAllowance: data.periodAllowance } : {}),
            ...('monthlyAllowance' in data ? { monthlyAllowance: data.monthlyAllowance } : {}),
            ...('periodStart' in data ? { periodStart: data.periodStart } : {}),
            ...('periodEnd' in data ? { periodEnd: data.periodEnd } : {}),
            updatedAt: data.updatedAt ?? new Date(),
          });
          return { ...row };
        },
      },

      tokenTransaction: {
        create: async ({ data }: any) => {
          if (data.idempotencyKey && get().ledger.some((l) => l.idempotencyKey === data.idempotencyKey)) {
            throw uniqueViolation('idempotencyKey');
          }
          const row: LedgerRow = {
            id: nextId('txn'),
            shortfall: 0,
            projectId: null,
            userId: null,
            idempotencyKey: null,
            refundOfId: null,
            detail: null,
            createdAt: new Date(),
            ...data,
          };
          if (row.allowanceAfter < 0 || row.bonusAfter < 0 || row.shortfall < 0) {
            throw checkViolation('TokenTransaction_balances_non_negative');
          }
          get().ledger.push(row);
          return { ...row };
        },
        findUnique: async ({ where, select }: any) => {
          const row = get().ledger.find((l) => (where.id ? l.id === where.id : l.idempotencyKey === where.idempotencyKey));
          if (!row) return null;
          return select ? Object.fromEntries(Object.keys(select).map((k) => [k, (row as any)[k]])) : { ...row };
        },
        findMany: async ({ where, orderBy, take, cursor }: any) => {
          let rows = get().ledger.filter((l) => matches(l, where));
          if (orderBy) {
            const order = Array.isArray(orderBy) ? orderBy : [orderBy];
            rows = [...rows].sort((a, b) => {
              for (const clause of order) {
                const [field, direction] = Object.entries(clause)[0] as [string, 'asc' | 'desc'];
                const av = (a as any)[field] instanceof Date ? (a as any)[field].getTime() : (a as any)[field];
                const bv = (b as any)[field] instanceof Date ? (b as any)[field].getTime() : (b as any)[field];
                if (av === bv) continue;
                return (av < bv ? -1 : 1) * (direction === 'desc' ? -1 : 1);
              }
              return 0;
            });
          }
          if (cursor) {
            const at = rows.findIndex((r) => r.id === cursor.id);
            rows = at === -1 ? [] : rows.slice(at);
          }
          return (take ? rows.slice(0, take) : rows).map((r) => ({ ...r }));
        },
        groupBy: async ({ by, where, _sum, _count }: any) => {
          const groups = new Map<string, LedgerRow[]>();
          for (const row of get().ledger.filter((l) => matches(l, where))) {
            const key = JSON.stringify(by.map((field: string) => (row as any)[field]));
            groups.set(key, [...(groups.get(key) ?? []), row]);
          }
          return [...groups.entries()].map(([key, rows]) => {
            const out: any = Object.fromEntries(by.map((field: string, i: number) => [field, JSON.parse(key)[i]]));
            if (_sum) {
              out._sum = Object.fromEntries(
                Object.keys(_sum).map((field) => [field, rows.reduce((sum, r) => sum + ((r as any)[field] ?? 0), 0)]),
              );
            }
            if (_count) out._count = { _all: rows.length };
            return out;
          });
        },
      },

      project: {
        findUnique: async ({ where }: any) => projects.get(where.id) ?? null,
      },
    };
  }

  const base = client(() => committed);

  const prisma = {
    ...base,
    $transaction: async (work: (tx: any) => Promise<unknown>) => {
      transactions++;
      const failure = pendingFailure;
      pendingFailure = null;

      // Run alone, in arrival order: the row lock, coarsened.
      const run = queue.then(async () => {
        if (failure) throw failure;
        const working = clone(committed);
        const result = await work(client(() => working));
        committed = working; // commit; a throw above discards `working`
        return result;
      });
      queue = run.catch(() => undefined);
      return run;
    },
  } as unknown as PrismaService;

  return {
    prisma,
    wallets: () => committed.wallets.map((w) => ({ ...w })),
    ledger: () => committed.ledger.map((l) => ({ ...l })),
    organizations,
    projects,
    failNextTransaction: (error) => {
      pendingFailure = error;
    },
    transactionCount: () => transactions,
  };
}
