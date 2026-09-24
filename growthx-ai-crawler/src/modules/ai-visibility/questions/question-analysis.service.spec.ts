import { AiProvider } from '../../ai-search/multi-ai-router/multi-ai-router.service';
import { QuestionAnalysisService } from './question-analysis.service';

const OWN_PAGE = {
  id: 'own1',
  url: 'https://aivaenterprises.com/organic-turmeric',
  title: 'Organic Turmeric Powder | Aiva Enterprises',
  metaDescription: null,
  h1: ['Organic Turmeric Powder'],
  h2: [],
  h3: [],
  pageType: 'PRODUCT',
  wordCount: 400,
};

const check = (over: any) => ({
  assistant: 'SARVAM',
  model: 'sarvam-105b',
  checkedAt: new Date('2026-09-20T06:00:00Z'),
  cited: false,
  position: null,
  competitorsCited: [],
  answerExcerpt: null,
  error: null,
  ...over,
});

describe('QuestionAnalysisService', () => {
  let prisma: any;
  let router: any;
  let service: QuestionAnalysisService;

  beforeEach(() => {
    prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({
          name: 'Aiva',
          websites: [{ id: 'w1', domain: 'aivaenterprises.com' }],
          competitors: [],
        }),
      },
      crawlJob: { findFirst: jest.fn().mockResolvedValue({ id: 'job1' }) },
      page: {
        findMany: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve(where.id ? [{ id: 'own1', rawHtml: null, renderedHtml: null, schemas: [] }] : [OWN_PAGE]),
        ),
      },
      issue: { findMany: jest.fn().mockResolvedValue([]) },
      localLocation: { findFirst: jest.fn().mockResolvedValue(null) },
      trackedPrompt: { findMany: jest.fn() },
    };
    // Nothing configured on this deployment right now.
    router = { configuredProviders: jest.fn().mockReturnValue([]) };
    service = new QuestionAnalysisService(prisma, router);
  });

  it('counts a real answer even when its assistant is no longer enabled', async () => {
    prisma.trackedPrompt.findMany.mockResolvedValue([
      { id: 'q1', text: 'best organic turmeric powder', cluster: null, checks: [check({ competitorsCited: ['rival.com'] })] },
    ]);

    const [q] = (await service.analyze('proj_1')).questions;

    expect(q.outcome).toBe('NOT_CITED');
    expect(q.answer?.competitorsCited).toEqual(['rival.com']);
  });

  it('ignores a stale failure from an assistant this deployment no longer asks', async () => {
    router.configuredProviders.mockReturnValue([AiProvider.SARVAM]);
    prisma.trackedPrompt.findMany.mockResolvedValue([
      { id: 'q1', text: 'best organic turmeric powder', cluster: null, checks: [check({ assistant: 'CHATGPT', error: 'OPENAI is not configured.' })] },
    ]);

    const [q] = (await service.analyze('proj_1')).questions;

    expect(q.outcome).toBe('NOT_MEASURED');
    expect(q.failure).toBeNull();
  });

  it('does not match a reputation question to a page just because the page title names the brand', async () => {
    prisma.trackedPrompt.findMany.mockResolvedValue([
      { id: 'q1', text: 'is Aiva legitimate and reliable', cluster: null, checks: [check({ cited: true, position: 1 })] },
      { id: 'q2', text: 'best organic turmeric powder', cluster: null, checks: [] },
    ]);

    const [reputation, buyer] = (await service.analyze('proj_1')).questions;

    expect(reputation.group).toBe('REPUTATION');
    expect(reputation.ownPage).toBeNull();
    expect(reputation.verdict).toBe('NOT_APPLICABLE');
    expect(buyer.ownPage?.url).toBe(OWN_PAGE.url);
  });
});
