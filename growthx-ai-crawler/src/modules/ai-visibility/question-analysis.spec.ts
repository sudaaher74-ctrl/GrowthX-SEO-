import { questionAnalysis, questionSuggestions } from './question-analysis';
import { AiVisibilityController } from './ai-visibility.controller';
import { PATH_METADATA } from '@nestjs/common/constants';

function fixture() {
  const page = { id: 'page', crawlJobId: 'job', url: 'https://example.in/daily-milk', title: 'Fresh milk subscriptions | Example', metaDescription: 'Daily fresh milk delivery', h1: ['Fresh milk subscriptions'], h2: [], wordCount: 100, schemas: [], issues: [] };
  const prisma: any = {
    project: { findUnique: jest.fn().mockResolvedValue({ name: 'Example', websites: [{ id: 'site', domain: 'example.in' }], competitors: [] }) },
    crawlJob: { findMany: jest.fn().mockResolvedValue([{ id: 'job', websiteId: 'site' }]) },
    page: { findMany: jest.fn().mockResolvedValue([page]), count: jest.fn().mockResolvedValue(1) },
    aiVisibilityPrompt: { findMany: jest.fn().mockResolvedValue([]) },
    contentGap: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return prisma;
}

describe('question analysis routes', () => {
  it('registers both endpoints used by the Questions tab', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AiVisibilityController.prototype.getQuestions)).toBe('questions');
    expect(Reflect.getMetadata(PATH_METADATA, AiVisibilityController.prototype.getQuestionSuggestions)).toBe('questions/suggestions');
  });

  it('returns real audit counts with an empty questions array before tracking', async () => {
    const prisma = fixture();
    await expect(questionAnalysis(prisma, 'project')).resolves.toMatchObject({ auditAvailable: true, auditedPages: 1, competitorsTracked: 0, questions: [] });
  });

  it('joins saved answers and keeps brand questions separate', async () => {
    const prisma = fixture();
    prisma.aiVisibilityPrompt.findMany.mockResolvedValue([
      { id: 'buyer', text: 'Which fresh milk subscriptions are available?', category: 'Discovery', responses: [{ provider: 'GEMINI', model: 'tested-model', createdAt: new Date(), rawResponse: 'Other dairies', errorMessage: null, analysis: { brandMentioned: false, brandPosition: null }, mentions: [{ isCustomer: false, brandName: 'rival.in' }] }] },
      { id: 'brand', text: 'Is Example reliable?', responses: [] },
    ]);
    const result = await questionAnalysis(prisma, 'project');
    expect(result.questions[0]).toMatchObject({ group: 'BUYER', outcome: 'NOT_CITED', ownPage: { url: 'https://example.in/daily-milk' }, answer: { competitorsCited: ['rival.in'] } });
    expect(result.questions[1]).toMatchObject({ group: 'REPUTATION', outcome: 'NOT_MEASURED', answer: null });
  });

  it('suggests buyer questions from crawled topics and excludes already tracked questions', async () => {
    const prisma = fixture();
    const result = await questionSuggestions(prisma, 'project');
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]).toMatchObject({ source: 'OWN_PAGE', evidenceUrl: 'https://example.in/daily-milk' });
    expect(result.suggestions[0].text).not.toMatch(/example/i);
    prisma.aiVisibilityPrompt.findMany.mockResolvedValue([{ text: result.suggestions[0].text }]);
    expect((await questionSuggestions(prisma, 'project')).suggestions).toEqual([]);
  });

  it('rejects unknown projects instead of manufacturing an empty report', async () => {
    const prisma = fixture();
    prisma.project.findUnique.mockResolvedValue(null);
    await expect(questionAnalysis(prisma, 'missing')).rejects.toThrow('Project not found');
  });

  it('bounds page loading while preserving the full audited page count', async () => {
    const prisma = fixture();
    prisma.page.count.mockResolvedValue(5000);
    expect((await questionAnalysis(prisma, 'project')).auditedPages).toBe(5000);
    expect(prisma.page.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100, where: expect.objectContaining({ crawlJobId: 'job' }) }));
  });
});
