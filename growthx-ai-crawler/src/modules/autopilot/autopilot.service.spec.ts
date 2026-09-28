import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { CrawlerService } from '../crawler/crawler.service';
import { FetcherService } from '../crawler/fetcher.service';
import { IssueCountService } from '../issues/issue-count.service';
import { IssueGroupService } from '../issues/issue-group.service';
import { AutopilotModule } from './autopilot.module';
import { AutopilotScheduler } from './autopilot.scheduler';
import { AutopilotService } from './autopilot.service';
import { filterCandidates, summariseHomepage } from './competitor-finder';

/** An in-memory AutopilotRun table, enough for the state machine. */
function fakePrisma() {
  const runs: any[] = [];
  const competitors: any[] = [];
  const jobs: Record<string, { status: string; pagesCrawled: number; finishedAt?: Date }> = {};
  const prisma = {
    runs,
    competitors,
    jobs,
    website: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn(({ create }) => Promise.resolve({ id: 'w-own', ...create })),
    },
    project: {
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'p-new' }),
    },
    crawlJob: {
      findFirst: jest.fn(({ where }) => {
        const domain = where?.website?.domain;
        if (domain && jobs[domain]) return Promise.resolve({ id: `job-${domain}`, ...jobs[domain] });
        return Promise.resolve(null);
      }),
      // The site list reads a site's recent crawls; each fixture site has one.
      findMany: jest.fn(({ where }) => {
        const domain = where?.website?.domain;
        return Promise.resolve(domain && jobs[domain] ? [{ id: `job-${domain}`, ...jobs[domain] }] : []);
      }),
    },
    page: { findMany: jest.fn().mockResolvedValue([]) },
    organizationMember: {
      findFirst: jest.fn(({ where }) => Promise.resolve(where.role === 'OWNER' ? { userId: 'owner1' } : { userId: 'member1' })),
    },
    competitorDomain: {
      findMany: jest.fn(() => Promise.resolve(competitors)),
      upsert: jest.fn(({ create }) => {
        const row = { id: `c-${create.domain}`, ...create };
        competitors.push(row);
        return Promise.resolve(row);
      }),
    },
    autopilotRun: {
      findFirst: jest.fn(({ where }) =>
        Promise.resolve(runs.find((r) => r.projectId === where.projectId && (!where.status || where.status.in.includes(r.status))) ?? null),
      ),
      findUnique: jest.fn(({ where }) => Promise.resolve(runs.find((r) => r.id === where.id) ?? null)),
      findMany: jest.fn(({ where }) => Promise.resolve(runs.filter((r) => where.status.in.includes(r.status)))),
      create: jest.fn(({ data }) => {
        const row = { id: `run${runs.length + 1}`, suggestions: [], competitors: [], log: [], error: null, finishedAt: null, startedAt: new Date(), updatedAt: new Date(), ...data };
        runs.push(row);
        return Promise.resolve(row);
      }),
      update: jest.fn(({ where, data }) => {
        const row = runs.find((r) => r.id === where.id);
        Object.assign(row, data, { updatedAt: new Date() });
        return Promise.resolve(row);
      }),
    },
  };
  return prisma;
}

function setup(modelJson: string) {
  const prisma = fakePrisma();
  const crawler = { startCrawlJob: jest.fn().mockResolvedValue('job-own') };
  const fetcher = {
    fetchPage: jest.fn((url: string) =>
      Promise.resolve(
        url.includes('dead.in')
          ? { statusCode: 0, html: '' }
          : { statusCode: 200, html: '<title>Brand Kettle | Premium Assam tea</title><meta name="description" content="Tea from Assam"><h1>Assam tea</h1>' },
      ),
    ),
  };
  const router = { generate: jest.fn().mockResolvedValue({ text: modelJson, refused: false }) };
  const competitorCrawl = { startCrawl: jest.fn().mockResolvedValue({ jobId: 'j' }) };
  const report = { generate: jest.fn().mockResolvedValue({ analysis: {}, analysisError: null, snapshotId: 'snap1' }) };
  const auditReport = { generate: jest.fn().mockResolvedValue({ analysis: {}, analysisError: null }) };
  const orgContext = { assertMembership: jest.fn().mockResolvedValue(undefined) };
  const service = new AutopilotService(
    prisma as any,
    orgContext as any,
    crawler as any,
    fetcher as any,
    router as any,
    competitorCrawl as any,
    report as any,
    auditReport as any,
  );
  return { service, prisma, crawler, fetcher, router, competitorCrawl, report, auditReport };
}

const MODEL = JSON.stringify({
  business: 'Assam tea brand in India',
  competitors: [
    { domain: 'https://www.teabox.com/', name: 'Teabox', reason: 'Sells Assam tea online in India' },
    { domain: 'amazon.in', name: 'Amazon' },
    { domain: 'dead.in', name: 'Dead' },
    { domain: 'brandkettle.co.in', name: 'Self' },
    { domain: 'vahdamteas.com', name: 'Vahdam', reason: 'Premium Indian teas' },
  ],
});

describe('AutopilotService', () => {
  it('sets up a new customer, starts their crawl and offers only real competitors', async () => {
    const { service, prisma, crawler, router } = setup(MODEL);
    const view = await service.start({ userId: 'u1', organizationId: 'o1', domain: 'https://BrandKettle.co.in/' });

    expect(prisma.project.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: 'brandkettle.co.in' }) }));
    // Their own site's record, never a competitor record of the same domain.
    expect(prisma.website.findUnique.mock.calls[0][0].where).toEqual({ domain_scope: { domain: 'brandkettle.co.in', scope: 'own' } });
    expect(prisma.website.upsert.mock.calls[0][0]).toMatchObject({
      where: { domain_scope: { domain: 'brandkettle.co.in', scope: 'own' } },
      create: { domain: 'brandkettle.co.in', scope: 'own', projectId: 'p-new' },
    });
    expect(crawler.startCrawlJob).toHaveBeenCalledWith('w-own', expect.any(Object));
    expect(view).toMatchObject({ projectId: 'p-new', domain: 'brandkettle.co.in', status: 'DISCOVERING' });

    await service.discover(view.id);
    const run = prisma.runs[0];
    expect(run.status).toBe('AWAITING_CONFIRMATION');
    expect(run.suggestions.map((s: any) => s.domain)).toEqual(['teabox.com', 'vahdamteas.com']);
    expect(router.generate.mock.calls[0][0].prompt).toContain('Premium Assam tea');
  });

  it('refuses a website another account owns', async () => {
    const { service, prisma } = setup(MODEL);
    prisma.website.findUnique.mockResolvedValue({ id: 'w', projectId: 'px', project: { organizationId: 'other' } });
    await expect(service.start({ userId: 'u1', organizationId: 'o1', domain: 'brandkettle.co.in' })).rejects.toThrow('another account');
  });

  it('adds and crawls the confirmed competitors, then writes the report once every crawl is done', async () => {
    const { service, prisma, competitorCrawl, report, auditReport } = setup(MODEL);
    const view = await service.start({ userId: 'u1', organizationId: 'o1', domain: 'brandkettle.co.in' });
    await service.discover(view.id);

    const confirmed = await service.confirm(view.id, 'u1', ['teabox.com', 'typhoo.in']);
    expect(confirmed.status).toBe('RUNNING');
    expect(confirmed.competitors.map((c) => c.name)).toEqual(['Teabox', 'typhoo.in']);
    expect(competitorCrawl.startCrawl).toHaveBeenCalledTimes(2);

    prisma.jobs['brandkettle.co.in'] = { status: 'COMPLETED', pagesCrawled: 30 };
    prisma.jobs['teabox.com'] = { status: 'RUNNING', pagesCrawled: 12 };
    prisma.jobs['typhoo.in'] = { status: 'COMPLETED', pagesCrawled: 40 };
    await service.tick();
    expect(report.generate).not.toHaveBeenCalled();

    prisma.jobs['teabox.com'] = { status: 'FAILED', pagesCrawled: 0 };
    await service.tick();
    expect(report.generate).toHaveBeenCalledWith(view.projectId, 'o1');
    expect(auditReport.generate).toHaveBeenCalledWith(view.projectId, 'o1');
    const done = await service.get(view.id, 'u1');
    expect(done).toMatchObject({ status: 'DONE', reportReady: true });
    expect(done.log.map((l) => l.message).join(' ')).toContain("Couldn't read Teabox's website");
    expect(done.log.map((l) => l.message).join(' ')).toContain('Your website audit report is ready.');
  });

  it('asks Sarvam first, and the next model when Sarvam cannot answer', async () => {
    const { service, prisma, router } = setup(MODEL);
    router.generate
      .mockRejectedValueOnce(new Error('SARVAM_API_KEY is not configured.'))
      .mockResolvedValueOnce({ text: MODEL, refused: false, model: 'claude-sonnet-5' });
    const view = await service.start({ userId: 'u1', organizationId: 'o1', domain: 'brandkettle.co.in' });
    await service.discover(view.id);

    expect(router.generate.mock.calls[0][0]).toMatchObject({ provider: 'SARVAM', jsonSchema: expect.any(Object) });
    expect(router.generate.mock.calls[1][0].provider).toBeUndefined();
    const run = prisma.runs[0];
    expect(run.suggestions.map((s: any) => s.domain)).toEqual(['teabox.com', 'vahdamteas.com']);
    expect(run.suggestions[0].foundBy).toBe('claude-sonnet-5');
  });

  it('says which model found the competitors when Sarvam answers', async () => {
    const { service, prisma, router } = setup(MODEL);
    router.generate.mockResolvedValue({ text: MODEL, refused: false, model: 'sarvam-105b' });
    const view = await service.start({ userId: 'u1', organizationId: 'o1', domain: 'brandkettle.co.in' });
    await service.discover(view.id);

    expect(router.generate).toHaveBeenCalledTimes(1);
    const run = prisma.runs[0];
    expect(run.suggestions.every((s: any) => s.foundBy === 'sarvam-105b')).toBe(true);
    expect(run.log.map((l: any) => l.message).join(' ')).toContain('with sarvam-105b');
  });

  it('keeps the first three when more are confirmed, as a spoken "yes" confirms all five', async () => {
    const { service, competitorCrawl } = setup(MODEL);
    const run = await service.offerSuggestions({
      projectId: 'p1',
      organizationId: 'o1',
      domain: 'brandkettle.co.in',
      suggestions: ['a.in', 'b.in', 'c.in', 'd.in', 'e.in'].map((domain) => ({ domain, name: domain.toUpperCase(), reason: '' })),
    });

    const confirmed = await service.confirm(run!.id, 'u1', ['a.in', 'b.in', 'c.in', 'd.in', 'e.in']);

    expect(confirmed.competitors.map((c) => c.domain)).toEqual(['a.in', 'b.in', 'c.in']);
    expect(competitorCrawl.startCrawl).toHaveBeenCalledTimes(3);
    expect(confirmed.log.map((l) => l.message).join(' ')).toContain('Kept your first 3. Skipped d.in, e.in');
  });

  it("crawls a confirmed competitor for this customer even when another customer read it recently", async () => {
    const { service, prisma, competitorCrawl } = setup(MODEL);
    const view = await service.start({ userId: 'u1', organizationId: 'o1', domain: 'brandkettle.co.in' });
    await service.discover(view.id);
    // Another project's recent, finished read of teabox.com.
    prisma.crawlJob.findFirst.mockImplementation(({ where }: any) =>
      where?.website?.scope === 'competitor:someone-else'
        ? Promise.resolve({ id: 'theirs', status: 'COMPLETED', pagesCrawled: 40, finishedAt: new Date() })
        : Promise.resolve(null),
    );

    const confirmed = await service.confirm(view.id, 'u1', ['teabox.com']);

    expect(prisma.crawlJob.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { website: { domain: 'teabox.com', scope: 'competitor:p-new' }, status: 'COMPLETED' } }),
    );
    expect(competitorCrawl.startCrawl).toHaveBeenCalledTimes(1);
    expect(confirmed.log.map((l) => l.message).join(' ')).toContain("Started reading Teabox's website.");
  });

  it("shows each site's progress from this project's own records only", async () => {
    const { service, prisma } = setup(MODEL);
    const view = await service.start({ userId: 'u1', organizationId: 'o1', domain: 'brandkettle.co.in' });
    await service.discover(view.id);
    await service.confirm(view.id, 'u1', ['teabox.com']);
    prisma.crawlJob.findMany.mockClear();

    await service.get(view.id, 'u1');

    const wheres = prisma.crawlJob.findMany.mock.calls.map((c: any[]) => c[0].where.website);
    expect(wheres).toEqual([
      { domain: 'brandkettle.co.in', projectId: 'p-new', scope: 'own' },
      { domain: 'teabox.com', scope: 'competitor:p-new' },
    ]);
  });

  it('writes the report anyway when a crawl never finishes', async () => {
    const { service, prisma, report } = setup(MODEL);
    const view = await service.start({ userId: 'u1', organizationId: 'o1', domain: 'brandkettle.co.in' });
    await service.discover(view.id);
    await service.confirm(view.id, 'u1', ['teabox.com']);
    prisma.jobs['teabox.com'] = { status: 'PENDING', pagesCrawled: 0 };
    await service.tick(new Date(Date.now() + 2 * 60 * 60 * 1000));
    expect(report.generate).toHaveBeenCalled();
  });
});

describe('offering competitors found after the first audit', () => {
  const found = Array.from({ length: 6 }, (_, i) => ({
    domain: `rival${i}.in`,
    name: `Rival ${i}`,
    reason: 'Sells fresh milk in Pune',
    foundBy: 'sarvam-105b',
  }));

  it('puts five to the customer as a question, attributed to the organization owner', async () => {
    const { service, prisma, competitorCrawl } = setup(MODEL);

    const run = await service.offerSuggestions({ projectId: 'p1', organizationId: 'o1', domain: 'milquufresh.in', suggestions: found });

    expect(run).toMatchObject({ status: 'AWAITING_CONFIRMATION', step: 'CONFIRM', userId: 'owner1', domain: 'milquufresh.in' });
    expect(run!.suggestions).toHaveLength(5);
    // Nothing is tracked or crawled until the customer picks.
    expect(prisma.competitors).toHaveLength(0);
    expect(competitorCrawl.startCrawl).not.toHaveBeenCalled();
    const log = (run!.log as any[]).map((l) => l.message).join(' ');
    expect(log).toContain('Your website audit of milquufresh.in finished.');
    expect(log).toContain('Found 5 likely competitors with sarvam-105b');
    expect(log).toContain('Pick up to 3 to track.');
  });

  it('leaves the question to a search the customer already started', async () => {
    const { service, prisma } = setup(MODEL);
    prisma.runs.push({ id: 'mine', projectId: 'p1', status: 'DISCOVERING' });

    await expect(
      service.offerSuggestions({ projectId: 'p1', organizationId: 'o1', domain: 'milquufresh.in', suggestions: found }),
    ).resolves.toBeNull();
    expect(prisma.runs).toHaveLength(1);
  });

  it('offers nothing when nothing was found', async () => {
    const { service } = setup(MODEL);
    await expect(
      service.offerSuggestions({ projectId: 'p1', organizationId: 'o1', domain: 'milquufresh.in', suggestions: [] }),
    ).resolves.toBeNull();
  });
});

describe('competitor-finder', () => {
  it('reads what a homepage says', () => {
    const s = summariseHomepage('<title>Kettle</title><nav><a>Green tea</a><a>Assam tea</a></nav><h1>Tea</h1><script>x</script><p>Fresh tea</p>');
    expect(s).toMatchObject({ title: 'Kettle', headings: ['Tea'], links: ['Green tea', 'Assam tea'] });
    expect(s.text).not.toContain('x');
  });

  it('accepts an array or an object, and drops junk', () => {
    expect(filterCandidates([{ domain: 'a.in' }, { domain: 'not a domain' }, { domain: 'A.in' }], 'me.in').map((c) => c.domain)).toEqual(['a.in']);
    expect(filterCandidates({ competitors: [{ website: 'b.com', name: 'B' }] }, 'me.in')).toEqual([{ domain: 'b.com', name: 'B', reason: '' }]);
    expect(filterCandidates([{ domain: 'teabox.com' }, { domain: 'x.com' }, { domain: 'shop.amazon.in' }], 'me.in').map((c) => c.domain)).toEqual(['teabox.com']);
  });
});

@Global()
@Module({
  providers: [
    { provide: CrawlerService, useValue: {} },
    { provide: FetcherService, useValue: {} },
    { provide: ConfigService, useValue: { get: () => undefined } },
    { provide: IssueCountService, useValue: {} },
    { provide: IssueGroupService, useValue: {} },
  ],
  exports: [CrawlerService, FetcherService, ConfigService, IssueCountService, IssueGroupService],
})
class FakeCrawlerModule {}

describe('AutopilotModule wiring', () => {
  it('resolves the service and scheduler, so the app can boot with it', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [FakeCrawlerModule, AutopilotModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    expect(moduleRef.get(AutopilotScheduler)).toBeInstanceOf(AutopilotScheduler);
  });
});
