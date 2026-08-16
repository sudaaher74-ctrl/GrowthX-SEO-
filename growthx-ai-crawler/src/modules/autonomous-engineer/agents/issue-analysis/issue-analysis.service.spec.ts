import { Test, TestingModule } from '@nestjs/testing';
import { IssueAnalysisService } from './issue-analysis.service';
import { MultiAiRouterService } from '../../../ai-search/multi-ai-router/multi-ai-router.service';

describe('IssueAnalysisService', () => {
  let service: IssueAnalysisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IssueAnalysisService,
        {
          provide: MultiAiRouterService,
          useValue: {
            generate: jest.fn().mockResolvedValue({ text: '{}', model: 'stub', usage: {}, refused: false }),
          },
        },
      ],
    }).compile();

    service = module.get<IssueAnalysisService>(IssueAnalysisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
