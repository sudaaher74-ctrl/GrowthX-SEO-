import { AiProvider } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { GeoSimulationService } from './geo-simulation.service';

const PROJECT = {
  id: 'proj_1',
  name: 'Northwind Outdoors',
  websites: [{ domain: 'northwindoutdoors.com', url: 'https://northwindoutdoors.com' }],
  competitors: [{ domain: 'trailheadco.com', label: 'Trailhead Co' }],
};

const answer = (text: string, model = 'sarvam-105b') => ({
  provider: AiProvider.SARVAM,
  model,
  text,
  usage: { inputTokens: 1, outputTokens: 1, estimatedCostUsd: null },
  refused: false,
});

describe('GeoSimulationService', () => {
  let prisma: any;
  let router: any;
  let service: GeoSimulationService;

  beforeEach(() => {
    prisma = { project: { findUnique: jest.fn().mockResolvedValue(PROJECT) } };
    router = {
      configuredProviders: jest.fn().mockReturnValue([AiProvider.SARVAM]),
      generate: jest.fn().mockImplementation((req: any) =>
        Promise.resolve(
          req.jsonSchema
            ? answer(JSON.stringify({ targetTitle: 'T', reasoning: 'R', displacementContent: 'Draft [add a customer result]', faq: [] }))
            : answer('For jackets, trailheadco.com is popular.'),
        ),
      ),
    };
    service = new GeoSimulationService(prisma, router);
  });

  it('asks only the engines this deployment can reach by default', async () => {
    const result = await service.simulateQuery('org_1', 'proj_1', { query: 'best jacket' });
    expect(result.engines.map((e) => e.engine)).toEqual(['SARVAM']);
    expect(result.engines[0]).toMatchObject({ model: 'sarvam-105b', error: null, cited: false });
    expect(result.engines[0].competitorsCited).toEqual(['trailheadco.com']);
  });

  it('never answers an engine with another vendor, and never writes an answer on failure', async () => {
    router.generate.mockImplementation((req: any) =>
      req.provider === AiProvider.SARVAM ? Promise.reject(new Error('Sarvam API failed (HTTP 500)')) : Promise.resolve(answer('x')),
    );

    const result = await service.simulateQuery('org_1', 'proj_1', {
      query: 'best jacket',
      engines: ['SARVAM', 'CHATGPT', 'PERPLEXITY'],
    });

    for (const engine of result.engines) {
      expect(engine.error).toBeTruthy();
      expect(engine.answerExcerpt).toBeNull();
      expect(engine.cited).toBe(false);
    }
    // Only Sarvam was ever called; ChatGPT has no key here and Perplexity no API.
    expect(router.generate.mock.calls.every(([req]: any) => req.provider === AiProvider.SARVAM)).toBe(true);
    expect(result.overallCitationRate).toBeNull();
    expect(result.displacementPatch).toBeNull();
  });

  it('drafts content with the drafting model named, and rates only over engines that answered', async () => {
    const result = await service.simulateQuery('org_1', 'proj_1', {
      query: 'best jacket',
      engines: ['SARVAM', 'PERPLEXITY'],
    });
    expect(result.enginesAnswered).toBe(1);
    expect(result.overallCitationRate).toBe(0);
    expect(result.displacementPatch).toMatchObject({ draftedBy: 'sarvam-105b', priority: 'CRITICAL' });
  });
});
