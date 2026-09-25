import { AiProvider } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { CompetitorIntelReportService, buildPrompt, normaliseAnalysis } from './competitor-intel-report.service';

const issue = (issueType: string, severity: string, pages: number) => ({
  issueType,
  severity,
  pages,
  description: `${issueType} description`,
  recommendation: `${issueType} fix`,
  exampleUrls: ['https://milquufresh.in/a', 'https://milquufresh.in/b'],
});

function setup(router: { generate: jest.Mock }) {
  const prisma = {
    project: {
      findUnique: jest.fn().mockResolvedValue({ name: 'MilQuu Fresh', websites: [{ id: 'w1', domain: 'milquufresh.in' }] }),
    },
    competitorDomain: { findMany: jest.fn().mockResolvedValue([{ id: 'c1', domain: 'countrydelight.in' }]) },
    crawlJob: {
      findFirst: jest.fn().mockResolvedValue({ finishedAt: new Date('2026-09-17T10:00:00Z'), pagesCrawled: 32, healthScore: 80 }),
    },
  };
  const seoReport = {
    issuesFor: jest.fn().mockResolvedValue([issue('DUPLICATE_TITLE', 'HIGH', 31), issue('MISSING_CANONICAL', 'HIGH', 32)]),
    report: jest.fn().mockResolvedValue({
      competitor: { id: 'c1', name: 'Country Delight', domain: 'countrydelight.in', status: 'ANALYZED', lastAnalyzedAt: null },
      crawl: { crawledAt: '2026-09-20T00:00:00Z', pagesCrawled: 120, healthScore: 86, verdict: '' },
      coverage: [{ pageType: 'PRODUCT', label: 'Product pages', count: 40, exampleUrl: null }],
      issues: [issue('MISSING_META_DESCRIPTION', 'MEDIUM', 5)],
      issuesBySeverity: {},
      comparison: [{ label: 'Product pages', whatItMeans: '', higherIsBetter: true, them: 40, you: 3, leader: 'them' }],
      notes: [],
    }),
  };
  return new CompetitorIntelReportService(prisma as any, seoReport as any, router as any);
}

describe('CompetitorIntelReportService.generate', () => {
  it('asks Sarvam only, and returns its analysis alongside the facts', async () => {
    const router = {
      generate: jest.fn().mockResolvedValue({
        model: 'sarvam-105b',
        refused: false,
        text: '```json\n{"executiveSummary":"Behind Country Delight.","problems":[{"title":"Duplicate titles","severity":"LOW","fix":["a"]},{"title":"No canonicals","severity":"critical","effort":"low"}],"plan":[{"actions":["x"]}]}\n```',
      }),
    };
    const report = await setup(router).generate('p1', 'org1');

    expect(router.generate).toHaveBeenCalledWith(
      expect.objectContaining({ provider: AiProvider.SARVAM, allowFallback: false, organizationId: 'org1', projectId: 'p1' }),
    );
    expect(report.model).toBe('sarvam-105b');
    expect(report.analysisError).toBeNull();
    expect(report.analysis?.problems.map((p) => p.severity)).toEqual(['critical', 'low']);
    expect(report.analysis?.plan[0].week).toBe('Week 1');
    expect(report.facts.you?.healthScore).toBe(80);
    expect(report.facts.rivals[0].name).toBe('Country Delight');
  });

  it('still returns the facts when Sarvam fails', async () => {
    const router = { generate: jest.fn().mockRejectedValue(new Error('SARVAM_API_KEY is not set')) };
    const report = await setup(router).generate('p1');

    expect(report.analysis).toBeNull();
    expect(report.analysisError).toContain('SARVAM_API_KEY is not set');
    expect(report.facts.you?.issues).toHaveLength(2);
    expect(report.facts.rivals).toHaveLength(1);
  });
});

describe('buildPrompt', () => {
  it('carries the measured numbers and example URLs, and says what is unknown', async () => {
    const router = { generate: jest.fn().mockResolvedValue({ model: 'm', refused: false, text: '{}' }) };
    const service = setup(router);
    const prompt = buildPrompt(await service.gatherFacts('p1'));

    expect(prompt).toContain('health score: 80/100');
    expect(prompt).toContain('DUPLICATE_TITLE on 31 page(s)');
    expect(prompt).toContain('https://milquufresh.in/a');
    expect(prompt).toContain('Product pages: them 40, you 3 (leader: them)');
  });
});

describe('normaliseAnalysis', () => {
  it('turns anything the model sends into the report shape without throwing', () => {
    expect(normaliseAnalysis(null)).toEqual({ executiveSummary: '', problems: [], competitorInsights: [], plan: [], dataGaps: [] });
    const a = normaliseAnalysis({ problems: [{ severity: 'urgent', fix: 'not a list' }] });
    expect(a.problems[0]).toMatchObject({ title: 'Untitled problem', severity: 'medium', fix: [], effort: 'medium', where: 'Your site' });
  });
});
