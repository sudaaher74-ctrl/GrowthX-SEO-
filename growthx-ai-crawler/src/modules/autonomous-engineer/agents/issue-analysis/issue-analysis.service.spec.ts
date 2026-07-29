import { Test, TestingModule } from '@nestjs/testing';
import { IssueAnalysisService } from './issue-analysis.service';

describe('IssueAnalysisService', () => {
  let service: IssueAnalysisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IssueAnalysisService],
    }).compile();

    service = module.get<IssueAnalysisService>(IssueAnalysisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
