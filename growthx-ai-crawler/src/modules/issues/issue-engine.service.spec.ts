import { Test, TestingModule } from '@nestjs/testing';
import { IssueEngineService, DetectedIssueInput } from './issue-engine.service';
import { PrismaService } from '../../database/prisma.service';

describe('IssueEngineService', () => {
  let service: IssueEngineService;

  const mockPrisma = {
    issue: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'issue_1' }),
    },
    page: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    crawlJob: {
      update: jest.fn().mockResolvedValue({}),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.issue.findFirst.mockResolvedValue(null);
    mockPrisma.page.findFirst.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IssueEngineService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<IssueEngineService>(IssueEngineService);
  });

  it('detects missing title, thin content, and sets proper severity', async () => {
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
    const content: any = { wordCount: 80, readingTimeMin: 0.4, duplicateScore: 0, headingStructureErrors: [], extractionMethod: 'semantic_region', mainContentSelector: 'main', boilerplatePercentage: 10 };
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
      true,
      'BLOG'
    );

    const missingTitle = issues.find((i) => i.issueType === 'MISSING_TITLE');
    expect(missingTitle).toBeDefined();
    expect(missingTitle?.severity).toBe('HIGH');
    expect(missingTitle?.confidence).toBe('CONFIRMED');

    const thinContent = issues.find((i) => i.issueType === 'THIN_CONTENT');
    expect(thinContent).toBeDefined();
    expect(thinContent?.severity).toBe('MEDIUM');
  });

  it('marks multiple H1s as LOW advisory rather than high or critical', async () => {
    const htmlData: any = {
      title: 'Valid Page Title Here',
      metaDescription: 'Valid description for page.',
      canonicalUrl: 'https://growthx.ai/page',
      h1: ['First Heading', 'Second Heading'],
      h2: [],
      h3: [],
      robotsMeta: '',
    };
    const content: any = { wordCount: 400, readingTimeMin: 2, duplicateScore: 0, headingStructureErrors: [] };

    const issues = await service.evaluateAndPersistIssues(
      'job_123',
      'page_456',
      'https://growthx.ai/page',
      200,
      ['https://growthx.ai/page'],
      '<html></html>',
      htmlData,
      [],
      { internalCount: 2, externalCount: 0 } as any,
      content,
      [],
      true,
      true,
      'BLOG'
    );

    const multH1 = issues.find((i) => i.issueType === 'MULTIPLE_H1');
    expect(multH1).toBeDefined();
    expect(multH1?.severity).toBe('LOW');
    expect(multH1?.confidence).toBe('ADVISORY');
    expect(multH1?.evidence).toContain('First Heading');
  });

  it('does NOT flag a contact page with 40 words as thin content', async () => {
    const htmlData: any = {
      title: 'Contact Us - Aiva',
      metaDescription: 'Get in touch with Aiva today.',
      canonicalUrl: 'https://aivaenterprises.com/contact',
      h1: ['Contact Us'],
      h2: [],
      h3: [],
      robotsMeta: '',
    };
    const content: any = { wordCount: 45, readingTimeMin: 0.2, duplicateScore: 0, headingStructureErrors: [] };

    const issues = await service.evaluateAndPersistIssues(
      'job_123',
      'page_456',
      'https://aivaenterprises.com/contact',
      200,
      ['https://aivaenterprises.com/contact'],
      '<html></html>',
      htmlData,
      [],
      { internalCount: 1, externalCount: 0 } as any,
      content,
      [],
      true,
      true,
      'CONTACT'
    );

    const thin = issues.find((i) => i.issueType === 'THIN_CONTENT');
    expect(thin).toBeUndefined();
  });

  it('deduplicates issues so the same issue is not persisted twice', async () => {
    mockPrisma.issue.findFirst.mockResolvedValueOnce({ id: 'already_existing' });

    const htmlData: any = {
      title: '',
      metaDescription: '',
      canonicalUrl: '',
      h1: [],
      h2: [],
      h3: [],
      robotsMeta: '',
    };
    const content: any = { wordCount: 400, readingTimeMin: 2, duplicateScore: 0, headingStructureErrors: [] };

    await service.evaluateAndPersistIssues(
      'job_123',
      'page_456',
      'https://growthx.ai/p',
      200,
      ['https://growthx.ai/p'],
      '<html></html>',
      htmlData,
      [],
      { internalCount: 0, externalCount: 0 } as any,
      content,
      [],
      true,
      true,
      'BLOG'
    );

    // The mock returned an existing row for the first check, so create was not called for that duplicate
    expect(mockPrisma.issue.create).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ dedupKey: 'https://growthx.ai/p::MISSING_TITLE' }),
    }));
  });
});
