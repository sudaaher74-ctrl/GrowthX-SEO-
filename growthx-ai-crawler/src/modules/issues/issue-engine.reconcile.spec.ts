import { Test, TestingModule } from '@nestjs/testing';
import { IssueEngineService } from './issue-engine.service';
import { PrismaService } from '../../database/prisma.service';
import { fingerprintFor } from './fingerprint.util';

/**
 * Reconciliation is what turns per-crawl rows into a history. These are the
 * three transitions that have to be right, because each one is a different
 * conversation with the client: still broken, fixed, and broken again.
 */
describe('IssueEngineService.reconcileAgainstPreviousCrawl', () => {
  let service: IssueEngineService;

  const CURRENT = 'job_2';
  const PREVIOUS = 'job_1';
  const SCOPE = 'proj_1';

  const fp = (type: string, url: string) => fingerprintFor(SCOPE, type, url);

  /** Rows the fake database will return, keyed by crawl job. */
  let issuesByJob: Record<string, any[]>;
  let updateManyCalls: Array<{ where: any; data: any }>;
  let previousJob: any;

  /**
   * Carry-forward writes target rows by id; resolution writes target the
   * previous crawl by job. Splitting them here keeps each test reading as what
   * it is about rather than as an index into a call log.
   */
  const carries = () => updateManyCalls.filter((c) => c.where.id !== undefined);
  const resolutions = () => updateManyCalls.filter((c) => c.where.crawlJobId !== undefined);
  /** The data written for one specific issue id. */
  const carryFor = (id: string) =>
    carries().find((c) => c.where.id.in.includes(id))?.data;

  const mockPrisma = {
    crawlJob: {
      findUnique: jest.fn(async () => ({
        id: CURRENT,
        websiteId: 'site_1',
        createdAt: new Date('2026-02-01'),
      })),
      findFirst: jest.fn(async () => previousJob),
      update: jest.fn(async () => ({})),
    },
    issue: {
      findMany: jest.fn(async ({ where }: any) => {
        // The service scopes by project as well as by crawl; the fixtures are
        // all one project, so this only has to not throw when it is passed.
        expect(where).toHaveProperty('projectId');
        return issuesByJob[where.crawlJobId] ?? [];
      }),
      update: jest.fn(async () => ({})),
      updateMany: jest.fn(async ({ where, data }: any) => {
        updateManyCalls.push({ where, data });
        if (where.crawlJobId === undefined) return { count: where.id.in.length };
        const rows = (issuesByJob[where.crawlJobId] ?? []).filter(
          (r) => where.fingerprint.in.includes(r.fingerprint) && r.status === where.status,
        );
        return { count: rows.length };
      }),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    updateManyCalls = [];
    previousJob = { id: PREVIOUS };
    issuesByJob = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [IssueEngineService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(IssueEngineService);
  });

  it('carries everything forward when two crawls agree', async () => {
    const a = fp('MISSING_TITLE', 'https://x.com/a');
    const b = fp('MISSING_H1', 'https://x.com/b');
    issuesByJob[PREVIOUS] = [
      { fingerprint: a, status: 'OPEN', firstDetectedAt: new Date('2026-01-01'), regressionCount: 0 },
      { fingerprint: b, status: 'OPEN', firstDetectedAt: new Date('2026-01-01'), regressionCount: 0 },
    ];
    issuesByJob[CURRENT] = [
      { id: 'i1', fingerprint: a },
      { id: 'i2', fingerprint: b },
    ];

    const result = await service.reconcileAgainstPreviousCrawl(SCOPE, CURRENT);

    expect(result).toEqual({ resolved: 0, regressed: 0, carried: 2 });
  });

  it('preserves the original first-seen date rather than restarting the clock', async () => {
    const a = fp('MISSING_TITLE', 'https://x.com/a');
    const firstEver = new Date('2025-11-03');
    issuesByJob[PREVIOUS] = [
      { fingerprint: a, status: 'OPEN', firstDetectedAt: firstEver, regressionCount: 0 },
    ];
    issuesByJob[CURRENT] = [{ id: 'i1', fingerprint: a }];

    await service.reconcileAgainstPreviousCrawl(SCOPE, CURRENT);

    expect(carryFor('i1').firstDetectedAt).toEqual(firstEver);
    // "How long has this been open" is the question the column exists for.
    expect(carryFor('i1').lastSeenAt).toBeInstanceOf(Date);
  });

  it('resolves a finding the site no longer has', async () => {
    const gone = fp('MISSING_TITLE', 'https://x.com/a');
    const stillThere = fp('MISSING_H1', 'https://x.com/b');
    issuesByJob[PREVIOUS] = [
      { fingerprint: gone, status: 'OPEN', firstDetectedAt: new Date('2026-01-01'), regressionCount: 0 },
      { fingerprint: stillThere, status: 'OPEN', firstDetectedAt: new Date('2026-01-01'), regressionCount: 0 },
    ];
    issuesByJob[CURRENT] = [{ id: 'i2', fingerprint: stillThere }];

    const result = await service.reconcileAgainstPreviousCrawl(SCOPE, CURRENT);

    expect(result.resolved).toBe(1);
    expect(result.carried).toBe(1);
    // Only the one that disappeared, and it is marked with a date.
    expect(resolutions()[0].where.fingerprint.in).toEqual([gone]);
    expect(resolutions()[0].data.status).toBe('RESOLVED');
    expect(resolutions()[0].data.resolvedAt).toBeInstanceOf(Date);
  });

  it('leaves an IGNORED finding alone when it disappears', async () => {
    // Somebody decided to live with this one. Us confirming it is gone is a
    // different statement from them choosing to leave it, and overwriting the
    // second with the first loses the decision.
    const ignored = fp('LONG_TITLE', 'https://x.com/a');
    issuesByJob[PREVIOUS] = [
      { fingerprint: ignored, status: 'IGNORED', firstDetectedAt: new Date('2026-01-01'), regressionCount: 0 },
    ];
    issuesByJob[CURRENT] = [];

    const result = await service.reconcileAgainstPreviousCrawl(SCOPE, CURRENT);

    expect(result.resolved).toBe(0);
    expect(resolutions()[0].where.status).toBe('OPEN');
  });

  it('reopens a resolved finding as a regression, keeping its original first-seen date', async () => {
    const a = fp('MISSING_TITLE', 'https://x.com/a');
    const firstEver = new Date('2025-09-01');
    issuesByJob[PREVIOUS] = [
      { fingerprint: a, status: 'RESOLVED', firstDetectedAt: firstEver, regressionCount: 0 },
    ];
    issuesByJob[CURRENT] = [{ id: 'i1', fingerprint: a }];

    const result = await service.reconcileAgainstPreviousCrawl(SCOPE, CURRENT);

    expect(result).toEqual({ resolved: 0, regressed: 1, carried: 0 });
    expect(carryFor('i1').regressionCount).toBe(1);
    expect(carryFor('i1').status).toBe('OPEN');
    expect(carryFor('i1').resolvedAt).toBeNull();
    // A regression that forgot when the problem started would be reported as
    // a brand new finding, which is the opposite of what it is.
    expect(carryFor('i1').firstDetectedAt).toEqual(firstEver);
  });

  it('counts a second regression on top of the first', async () => {
    const a = fp('MISSING_TITLE', 'https://x.com/a');
    issuesByJob[PREVIOUS] = [
      { fingerprint: a, status: 'RESOLVED', firstDetectedAt: new Date('2025-09-01'), regressionCount: 1 },
    ];
    issuesByJob[CURRENT] = [{ id: 'i1', fingerprint: a }];

    await service.reconcileAgainstPreviousCrawl(SCOPE, CURRENT);

    expect(carryFor('i1').regressionCount).toBe(2);
  });

  it('writes carried findings in groups rather than one query each', async () => {
    // The reason this matters: a 10,000-page site produces findings in the
    // thousands, and a query per finding at the end of every crawl is the
    // difference between reconciliation being free and being the slowest part
    // of the job. Findings first seen in the same crawl share their values.
    const shared = new Date('2026-01-01');
    issuesByJob[PREVIOUS] = [];
    issuesByJob[CURRENT] = [];
    for (let i = 0; i < 50; i++) {
      const f = fp('MISSING_TITLE', `https://x.com/page-${i}`);
      issuesByJob[PREVIOUS].push({
        fingerprint: f,
        status: 'OPEN',
        firstDetectedAt: shared,
        regressionCount: 0,
      });
      issuesByJob[CURRENT].push({ id: `i${i}`, fingerprint: f });
    }

    const result = await service.reconcileAgainstPreviousCrawl(SCOPE, CURRENT);

    expect(result.carried).toBe(50);
    expect(carries()).toHaveLength(1);
    expect(carries()[0].where.id.in).toHaveLength(50);
  });

  it('does nothing on a first crawl, which has no history to compare against', async () => {
    previousJob = null;
    issuesByJob[CURRENT] = [{ id: 'i1', fingerprint: fp('MISSING_TITLE', 'https://x.com/a') }];

    const result = await service.reconcileAgainstPreviousCrawl(SCOPE, CURRENT);

    expect(result).toEqual({ resolved: 0, regressed: 0, carried: 0 });
    expect(updateManyCalls).toHaveLength(0);
  });

  it('ignores rows with no fingerprint so un-backfilled history cannot resolve live findings', async () => {
    // Rows written before the backfill have a null fingerprint. If they were
    // treated as one group, every one of them would look like the same absent
    // finding and mass-resolve real work.
    await service.reconcileAgainstPreviousCrawl(SCOPE, CURRENT);

    for (const call of mockPrisma.issue.findMany.mock.calls) {
      expect((call[0] as any).where.fingerprint).toEqual({ not: null });
    }
  });
});
