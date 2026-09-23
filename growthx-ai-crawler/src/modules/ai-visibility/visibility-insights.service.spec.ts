import { AiProvider } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { VisibilityInsightsService } from './visibility-insights.service';

const summary = (checked: number) => ({
  checked,
  cited: 0,
  citationSharePct: 0,
  averagePosition: null,
  previousCitationSharePct: null,
  deltaPt: null,
  failedChecks: 0,
});

describe('VisibilityInsightsService', () => {
  let prisma: any;
  let router: any;
  let visibility: any;
  let service: VisibilityInsightsService;

  beforeEach(() => {
    prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'proj_1',
          name: 'Northwind Outdoors',
          organizationId: 'org_1',
          websites: [{ domain: 'northwindoutdoors.com' }],
          competitors: [{ domain: 'trailheadco.com', label: 'Trailhead Co' }],
        }),
      },
      trackedPrompt: {
        findMany: jest.fn().mockResolvedValue([
          {
            text: 'best insulated jacket',
            checks: [
              {
                assistant: 'SARVAM',
                cited: false,
                position: null,
                competitorsCited: ['trailheadco.com'],
                answerExcerpt: 'Trailhead Co makes a great jacket.',
                checkedAt: new Date('2026-09-20'),
              },
            ],
          },
        ]),
      },
      crawlJob: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    router = {
      generate: jest.fn().mockResolvedValue({
        provider: AiProvider.SARVAM,
        model: 'sarvam-105b',
        text: JSON.stringify({
          summary: 'Not cited for the one tracked question.',
          findings: [{ title: 'Rival named', detail: 'Trailhead Co was named instead.', evidence: 'best insulated jacket' }],
          recommendations: [
            { title: 'Publish a jacket guide', category: 'content', priority: 'High', effort: 'weird', rationale: 'Gap', evidence: 'best insulated jacket' },
          ],
        }),
        usage: { inputTokens: 1, outputTokens: 1, estimatedCostUsd: null },
        refused: false,
      }),
    };
    visibility = {
      getReport: jest.fn().mockResolvedValue({ summary: summary(1), byAssistant: [], shareOfVoice: [], trend: [] }),
    };
    service = new VisibilityInsightsService(prisma, router, visibility);
  });

  it('generates nothing when nothing has been measured', async () => {
    visibility.getReport.mockResolvedValue({ summary: summary(0), byAssistant: [], shareOfVoice: [], trend: [] });
    const insights = await service.getInsights('proj_1');
    expect(insights.status).toBe('NO_DATA');
    expect(insights.recommendations).toEqual([]);
    expect(router.generate).not.toHaveBeenCalled();
  });

  it('grounds the model in the measured checks and names the model that wrote it', async () => {
    const insights = await service.getInsights('proj_1');

    const request = router.generate.mock.calls[0][0];
    expect(request.prompt).toContain('best insulated jacket');
    expect(request.prompt).toContain('trailheadco.com');
    expect(request.systemInstruction).toMatch(/Never invent/);
    expect(insights).toMatchObject({ status: 'READY', model: 'sarvam-105b' });
    // Out-of-range labels from the model are normalised, not passed through.
    expect(insights.recommendations[0]).toMatchObject({ category: 'CONTENT', priority: 'HIGH', effort: 'MEDIUM' });
  });

  it('does not re-bill the model for unchanged data', async () => {
    await service.getInsights('proj_1');
    await service.getInsights('proj_1');
    expect(router.generate).toHaveBeenCalledTimes(1);
  });
});
