import { AiProvider } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { AuditReportService, buildAuditPrompt, normaliseAuditAnalysis } from './audit-report.service';

const page = (over: Record<string, unknown> = {}) => ({
  statusCode: 200,
  responseTimeMs: 400,
  wordCount: 600,
  title: 'Cow milk',
  metaDescription: 'Fresh milk',
  h1: ['Cow milk'],
  indexability: 'INDEXABLE',
  _count: { schemas: 0 },
  ...over,
});

function setup(router: { generate: jest.Mock }, crawledAt: string | null = '2026-09-24T00:00:00Z') {
  const prisma = {
    project: { findUnique: jest.fn().mockResolvedValue({ name: 'MilQuu Fresh', websites: [{ id: 'w1', domain: 'milquufresh.in' }] }) },
    crawlJob: { findFirst: jest.fn().mockResolvedValue({ id: 'job1' }) },
    page: {
      findMany: jest.fn().mockResolvedValue([
        page(),
        page({ statusCode: 404 }),
        page({ responseTimeMs: 2400, wordCount: 120, title: '', h1: [], _count: { schemas: 2 } }),
        page({ metaDescription: null, indexability: 'NOINDEX' }),
      ]),
    },
    auditReportSnapshot: { create: jest.fn().mockResolvedValue({ id: 'snap1' }), findFirst: jest.fn() },
  };
  const counts = { countsForProject: jest.fn().mockResolvedValue({ crawledAt, healthScore: 72, bySeverity: { CRITICAL: 1, HIGH: 3, MEDIUM: 0, LOW: 2 } }) };
  const groups = {
    groupsForProject: jest.fn().mockResolvedValue({
      groups: [
        {
          title: '12 pages let Google write their own description — usually badly',
          severity: 'HIGH',
          affectedCount: 12,
          summary: 'The grey text under your link is your sales pitch',
          action: 'Write one or two sentences for each page',
          sampleUrls: ['https://milquufresh.in/a', 'https://milquufresh.in/b'],
          issueType: 'MISSING_META_DESCRIPTION',
        },
      ],
    }),
  };
  return { service: new AuditReportService(prisma as any, counts as any, groups as any, router as any), prisma };
}

describe('AuditReportService', () => {
  it('counts the page facts from the latest crawl', async () => {
    const { service } = setup({ generate: jest.fn() });
    const facts = await service.gatherFacts('p1');
    expect(facts.site).toMatchObject({ domain: 'milquufresh.in', healthScore: 72 });
    expect(facts.pages).toMatchObject({ read: 3, broken: 1, slow: 1, thin: 1, missingTitle: 1, missingHeadline: 1, missingDescription: 1, hiddenFromGoogle: 1, withGoogleDetails: 1 });
    expect(facts.problems[0]).toMatchObject({ pages: 12, action: 'Write one or two sentences for each page' });
  });

  it('asks Sarvam only, in plain words, and stores the report', async () => {
    const router = {
      generate: jest.fn().mockResolvedValue({
        model: 'sarvam-105b',
        refused: false,
        text: '```json\n{"summary":"Mostly healthy.","fixes":[{"title":"b","priority":"low"},{"title":"a","priority":"critical","whoCanFix":"web developer","steps":["x"]}]}\n```',
      }),
    };
    const { service, prisma } = setup(router);
    const report = await service.generate('p1', 'o1');
    expect(router.generate).toHaveBeenCalledWith(expect.objectContaining({ provider: AiProvider.SARVAM, allowFallback: false }));
    expect(report.analysis?.fixes.map((f) => [f.title, f.priority, f.whoCanFix])).toEqual([
      ['a', 'high', 'developer'],
      ['b', 'low', 'you'],
    ]);
    expect(report.snapshotId).toBe('snap1');
    expect(prisma.auditReportSnapshot.create).toHaveBeenCalled();
  });

  it('keeps the facts when Sarvam fails, and says so when the site was never read', async () => {
    const failing = { generate: jest.fn().mockRejectedValue(new Error('SARVAM_API_KEY is not set')) };
    const r1 = await setup(failing).service.generate('p1');
    expect(r1.analysis).toBeNull();
    expect(r1.analysisError).toContain('SARVAM_API_KEY is not set');
    expect(r1.facts.problems).toHaveLength(1);

    const never = { generate: jest.fn() };
    const r2 = await setup(never, null).service.generate('p1');
    expect(never.generate).not.toHaveBeenCalled();
    expect(r2.analysisError).toContain("hasn't been read yet");
  });
});

describe('buildAuditPrompt', () => {
  it('carries the numbers and bans jargon in the answer', async () => {
    const { service } = setup({ generate: jest.fn() });
    const prompt = buildAuditPrompt(await service.gatherFacts('p1'));
    expect(prompt).toContain('health score 72/100');
    expect(prompt).toContain('broken pages (error when opened): 1');
    expect(prompt).toContain('(12 pages)');
    expect(prompt).toContain('Never use jargon');
  });
});

describe('normaliseAuditAnalysis', () => {
  it('never throws on odd model output', () => {
    expect(normaliseAuditAnalysis('nope')).toEqual({ summary: '', scoreExplained: '', fixes: [], quickWins: [], whatIsGood: [], plan: [], dataGaps: [] });
    expect(normaliseAuditAnalysis({ fixes: [{ pages: -3 }] }).fixes[0]).toMatchObject({ title: 'Untitled problem', pages: 0, whoCanFix: 'you', priority: 'medium' });
  });
});
