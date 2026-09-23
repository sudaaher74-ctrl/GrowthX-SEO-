import { AiVisibilityAdapter } from './ai-visibility.adapter';
import { PrismaService } from '../../database/prisma.service';

describe('AiVisibilityAdapter', () => {
  let adapter: AiVisibilityAdapter;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({ organizationId: 'org-1' }),
      },
      trackedPrompt: {
        findMany: jest.fn(),
      },
    };
    adapter = new AiVisibilityAdapter(mockPrisma as unknown as PrismaService);
  });

  it('honors the honest zero: emits zero findings when no PromptCheck rows exist', async () => {
    mockPrisma.trackedPrompt.findMany.mockResolvedValue([
      {
        id: 'prompt-1',
        projectId: 'proj-1',
        text: 'best enterprise seo tool',
        checks: [], // No checks run yet!
      },
    ]);

    const findings = await adapter.collect('proj-1');
    expect(findings).toEqual([]);
  });

  it('produces stable fingerprints across two invocations with identical inputs when brand is absent', async () => {
    mockPrisma.trackedPrompt.findMany.mockResolvedValue([
      {
        id: 'prompt-1',
        projectId: 'proj-1',
        text: 'best enterprise seo tool',
        estimatedVolume: 500,
        checks: [
          {
            id: 'check-1',
            assistant: 'PERPLEXITY',
            cited: false,
            competitorsCited: ['rival-seo.com'],
            checkedAt: new Date('2026-09-20'),
          },
        ],
      },
    ]);

    const run1 = await adapter.collect('proj-1');
    const run2 = await adapter.collect('proj-1');

    expect(run1).toHaveLength(1);
    expect(run2).toHaveLength(1);
    expect(run1[0].fingerprint).toBe(run2[0].fingerprint);
    expect(run1[0].fingerprint).toBe('proj-1::AIVIS::prompt-1');
    expect(run1[0].detailType).toBe('AI_VISIBILITY_PROMPT');
    expect(run1[0].detailRef).toBe('prompt-1');
  });

  it('omits findings when brand is cited', async () => {
    mockPrisma.trackedPrompt.findMany.mockResolvedValue([
      {
        id: 'prompt-1',
        projectId: 'proj-1',
        text: 'best enterprise seo tool',
        checks: [
          {
            id: 'check-1',
            assistant: 'CHATGPT',
            cited: true, // Brand is cited!
            checkedAt: new Date('2026-09-20'),
          },
        ],
      },
    ]);

    const findings = await adapter.collect('proj-1');
    expect(findings).toHaveLength(0);
  });
});
