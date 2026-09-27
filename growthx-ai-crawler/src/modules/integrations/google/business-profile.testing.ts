/**
 * A small in-memory stand-in for the Prisma tables the Business Profile
 * connector writes.
 *
 * Written because the property that matters most about a sync — running it
 * twice leaves one copy of everything — cannot be tested against a mock that
 * records calls. `expect(upsert).toHaveBeenCalled()` passes just as happily
 * when the upsert is keyed on something that is not unique, which is the exact
 * bug it would need to catch. This enforces the unique constraints from the
 * schema, so a second sync either updates the same row or the test fails.
 *
 * Only the operations the connector actually uses are implemented, and
 * anything unsupported throws rather than silently returning nothing.
 */

type Row = Record<string, any>;

/** Prisma's compound-unique `where` is `{ a_b: { a, b } }`; flatten it. */
function flattenWhere(where: Row): Row {
  const entries = Object.entries(where ?? {});
  if (entries.length === 1) {
    const [, value] = entries[0];
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      return value as Row;
    }
  }
  return where ?? {};
}

/**
 * PostgreSQL refuses a NUL byte in any text parameter ("invalid byte sequence
 * for encoding UTF8: 0x00"), so the fake does too. Without this, a query that
 * fails on every real database passed here.
 */
function rejectNulBytes(value: unknown): void {
  if (typeof value === 'string' && value.includes('\u0000')) {
    throw new Error('invalid byte sequence for encoding "UTF8": 0x00');
  }
  if (Array.isArray(value)) value.forEach(rejectNulBytes);
  else if (value && typeof value === 'object' && !(value instanceof Date)) Object.values(value).forEach(rejectNulBytes);
}

function matches(row: Row, where: Row): boolean {
  rejectNulBytes(where);
  return Object.entries(where ?? {}).every(([field, condition]) => {
    if (condition && typeof condition === 'object' && !(condition instanceof Date) && !Array.isArray(condition)) {
      const clause = condition as Row;
      if ('gte' in clause && !(row[field] >= clause.gte)) return false;
      if ('lte' in clause && !(row[field] <= clause.lte)) return false;
      if ('not' in clause && row[field] === clause.not) return false;
      if ('notIn' in clause && (clause.notIn as any[]).includes(row[field])) return false;
      if ('in' in clause && !(clause.in as any[]).includes(row[field])) return false;
      return true;
    }
    return row[field] === condition;
  });
}

function compare(a: any, b: any): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  return a < b ? -1 : 1;
}

export class FakeTable {
  rows: Row[] = [];
  private sequence = 0;

  /** The fields that make a row unique, mirroring the schema's @@unique. */
  constructor(private readonly uniqueBy: string[]) {}

  private key(row: Row): string {
    return this.uniqueBy.map((field) => String(row[field])).join('\u0000');
  }

  private index(where: Row): number {
    const flat = flattenWhere(where);
    if (flat.id !== undefined && this.uniqueBy.includes('id') === false) {
      return this.rows.findIndex((row) => row.id === flat.id);
    }
    const target = this.uniqueBy.map((field) => String(flat[field])).join('\u0000');
    return this.rows.findIndex((row) => this.key(row) === target);
  }

  findUnique = async ({ where }: { where: Row }) => {
    const at = this.index(where);
    return at === -1 ? null : { ...this.rows[at] };
  };

  findFirst = async ({ where, orderBy }: { where?: Row; orderBy?: Row } = {}) => {
    const found = await this.findMany({ where, orderBy });
    return found[0] ?? null;
  };

  findMany = async ({ where, orderBy }: { where?: Row; orderBy?: Row | Row[] } = {}) => {
    let found = this.rows.filter((row) => matches(row, where ?? {}));
    const orders = orderBy ? (Array.isArray(orderBy) ? orderBy : [orderBy]) : [];
    for (const order of [...orders].reverse()) {
      const [field, direction] = Object.entries(order)[0];
      found = [...found].sort((a, b) => (direction === 'desc' ? -1 : 1) * compare(a[field], b[field]));
    }
    return found.map((row) => ({ ...row }));
  };

  count = async ({ where }: { where?: Row } = {}) => this.rows.filter((row) => matches(row, where ?? {})).length;

  upsert = async ({ where, update, create }: { where: Row; update: Row; create: Row }) => {
    const at = this.index(where);
    if (at === -1) {
      const row = { id: `row-${++this.sequence}`, ...create };
      this.rows.push(row);
      return { ...row };
    }
    this.rows[at] = { ...this.rows[at], ...update };
    return { ...this.rows[at] };
  };

  update = async ({ where, data }: { where: Row; data: Row }) => {
    const at = this.index(where);
    if (at === -1) throw new Error('Record to update not found.');
    this.rows[at] = { ...this.rows[at], ...data };
    return { ...this.rows[at] };
  };

  createMany = async ({ data, skipDuplicates }: { data: Row[]; skipDuplicates?: boolean }) => {
    let count = 0;
    for (const row of data) {
      const existing = this.rows.findIndex((held) => this.key(held) === this.key(row));
      if (existing !== -1) {
        // Exactly what Postgres does with ON CONFLICT DO NOTHING, and what
        // makes a re-sync that forgot to clear its window visibly wrong.
        if (skipDuplicates) continue;
        throw new Error('Unique constraint violation.');
      }
      this.rows.push({ id: `row-${++this.sequence}`, ...row });
      count += 1;
    }
    return { count };
  };

  deleteMany = async ({ where }: { where?: Row } = {}) => {
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => !matches(row, where ?? {}));
    return { count: before - this.rows.length };
  };

  create = async ({ data }: { data: Row }) => {
    const row = { id: `row-${++this.sequence}`, ...data };
    this.rows.push(row);
    return { ...row };
  };
}

export function fakePrisma() {
  return {
    integration: new FakeTable(['projectId', 'provider']),
    gbpLocationProfile: new FakeTable(['projectId', 'locationName']),
    gbpServiceItem: new FakeTable(['projectId', 'locationName', 'serviceKey']),
    gbpDailyMetric: new FakeTable(['locationName', 'date', 'metric']),
    gbpMedia: new FakeTable(['projectId', 'mediaName']),
    gbpLocalPost: new FakeTable(['projectId', 'postName']),
    gbpSourceStatus: new FakeTable(['projectId', 'locationName', 'source']),
    localReview: new FakeTable(['projectId', 'googleReviewId']),
    dataSyncJob: new FakeTable(['id']),
  };
}
