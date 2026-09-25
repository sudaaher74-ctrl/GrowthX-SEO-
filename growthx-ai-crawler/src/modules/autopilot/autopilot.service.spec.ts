import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { CrawlerService } from '../crawler/crawler.service';
import { FetcherService } from '../crawler/fetcher.service';
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
    },
    page: { findMany: jest.fn().mockResolvedValue([]) },
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
  const orgContext = { assertMembership: jest.fn().mockResolvedValue(undefined) };
  const service = new AutopilotService(
    prisma as any,
    orgContext as any,
    crawler as any,
    fetcher as any,
    router as any,
    competitorCrawl as any,
    report as any,
  );
  return { service, prisma, crawler, fetcher, router, competitorCrawl, report };
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
    const { service, prisma, competitorCrawl, report } = setup(MODEL);
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
    const done = await service.get(view.id, 'u1');
    expect(done).toMatchObject({ status: 'DONE', reportReady: true });
    expect(done.log.map((l) => l.message).join(' ')).toContain("Couldn't read Teabox's website");
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
  ],
  exports: [CrawlerService, FetcherService, ConfigService],
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
