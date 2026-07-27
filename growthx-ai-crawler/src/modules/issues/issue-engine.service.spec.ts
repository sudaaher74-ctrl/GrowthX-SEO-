import { Test, TestingModule } from '@nestjs/testing';
import { IssueEngineService, DetectedIssueInput } from './issue-engine.service';
import { PrismaService } from '../../database/prisma.service';

describe('IssueEngineService', () => {
  let service: IssueEngineService;

  const mockPrisma = {
    issue: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 3 }),
      create: jest.fn().mockResolvedValue({ id: 'issue_1' }),
    },
    crawlJob: {
      update: jest.fn().mockResolvedValue({}),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IssueEngineService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<IssueEngineService>(IssueEngineService);
  });

  it('should detect missing title, thin content, and slow response time', async () => {
    const htmlData: any = {
      title: '', // Missing title
      metaDescription: 'A valid description.',
      canonicalUrl: 'https://growthx.ai/test-page',
      h1: ['Main Heading'],
      h2: [],
      h3: [],
      robotsMeta: '',
    };
    const images: any[] = [];
    const links: any = { internalCount: 2, externalCount: 1, brokenAnchors: [], nofollowLinks: [] };
    const content: any = { wordCount: 150, readingTimeMin: 0.75, duplicateScore: 0, headingStructureErrors: [] };
    const schemas: any[] = [];

    const issues: DetectedIssueInput[] = await service.evaluateAndPersistIssues(
      'job_123',
      'page_456',
      'https://growthx.ai/test-page',
      200,
      ['https://growthx.ai/test-page'],
      '<html></html>',
      htmlData,
      images,
      links,
      content,
      schemas,
      true,
      true
    );

    const types = issues.map((i: DetectedIssueInput) => i.issueType);

    expect(types).toContain('MISSING_TITLE');
    expect(types).toContain('THIN_CONTENT');
  });
});
