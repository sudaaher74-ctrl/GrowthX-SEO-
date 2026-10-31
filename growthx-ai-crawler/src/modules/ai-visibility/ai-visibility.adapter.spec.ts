import { AiVisibilityAdapter } from './ai-visibility.adapter';
import { PrismaService } from '../../database/prisma.service';

describe('AiVisibilityAdapter', () => {
  let adapter: AiVisibilityAdapter;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'proj-1',
          organizationId: 'org-1',
          name: 'MilquuFresh',
          websites: [{ domain: 'milquufresh.in' }],
        }),
      },
      aiVisibilityJourney: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'journey-1',
          projectId: 'proj-1',
          scanId: 'scan-1',
          status: 'PARTIAL',
          analysis: [
            {
              provider: 'GEMINI',
              actions: [
                {
                  title: 'Create a Panvel delivery page',
                  priority: 'high',
                  steps: ['Build local landing page', 'Add delivery hours'],
                  measureBy: 'Increase local ranking',
                  timeframe: 'Immediate',
                },
              ],
            },
          ],
        }),
      },
      aiVisibilityScan: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'scan-1',
          projectId: 'proj-1',
          status: 'PARTIAL',
        }),
      },
      aiVisibilityResponse: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'resp-1',
            provider: 'OPENAI',
            model: 'gpt-4o',
            promptText: 'Which suppliers deliver milk in Navi Mumbai?',
            rawResponse: 'Aavin delivers fresh milk.',
            mentions: [
              { brandName: 'Aavin', isCustomer: false, recommended: false },
            ],
            citations: [
              { domain: 'aavin.com', brandMentioned: false },
            ],
            analysis: { brandMentioned: false, recommended: false },
          },
          {
            id: 'resp-2',
            provider: 'GEMINI',
            model: 'gemini-2.5',
            promptText: 'Which suppliers deliver milk in Navi Mumbai?',
            rawResponse: 'Blinkit provides 10-minute delivery.',
            mentions: [
              { brandName: 'Blinkit', isCustomer: false, recommended: false },
            ],
            citations: [
              { domain: 'blinkit.com', brandMentioned: false },
            ],
            analysis: { brandMentioned: false, recommended: false },
          },
          {
            id: 'resp-3',
            provider: 'OPENAI',
            model: 'gpt-4o',
            promptText: 'What are the local options for buying milk in Panvel?',
            rawResponse: 'Local dairies are available in the market.',
            mentions: [],
            citations: [],
            analysis: { brandMentioned: false, recommended: false },
          },
        ]),
      },
    };

    adapter = new AiVisibilityAdapter(mockPrisma as unknown as PrismaService);
  });

  it('returns empty array when project not found', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);
    const result = await adapter.collect('proj-missing');
    expect(result).toEqual([]);
  });

  it('returns empty array when no scans exist', async () => {
    mockPrisma.aiVisibilityJourney.findFirst.mockResolvedValue(null);
    mockPrisma.aiVisibilityScan.findFirst.mockResolvedValue(null);
    const result = await adapter.collect('proj-1');
    expect(result).toEqual([]);
  });

  it('collects competitor citation findings and zero-visibility problems', async () => {
    const findings = await adapter.collect('proj-1');

    // Should include:
    // 1. Competitor Aavin
    // 2. Competitor Blinkit
    // 3. Zero brand visibility on commercial queries
    // 4. Journey action (Create a Panvel delivery page)
    expect(findings.length).toBeGreaterThanOrEqual(3);

    const aavin = findings.find((f) => f.title.includes('Aavin'));
    expect(aavin).toBeDefined();
    expect(aavin?.source).toBe('MARKET');
    expect(aavin?.category).toBe('COMPETITOR');
    expect(aavin?.detailType).toBe('AI_VISIBILITY_LOSS');
    expect(aavin?.evidence.some((e) => e.value === 'Aavin')).toBe(true);

    const blinkit = findings.find((f) => f.title.includes('Blinkit'));
    expect(blinkit).toBeDefined();

    const zeroVis = findings.find((f) => f.detailType === 'AI_ZERO_VISIBILITY');
    expect(zeroVis).toBeDefined();
    expect(zeroVis?.source).toBe('MARKET');

    const journeyAction = findings.find((f) => f.detailType === 'AI_JOURNEY_ACTION');
    expect(journeyAction).toBeDefined();
    expect(journeyAction?.title).toBe('Create a Panvel delivery page');
  });

  it('generates stable fingerprints across invocations', async () => {
    const run1 = await adapter.collect('proj-1');
    const run2 = await adapter.collect('proj-1');

    expect(run1.map((f) => f.fingerprint)).toEqual(run2.map((f) => f.fingerprint));
  });
});
