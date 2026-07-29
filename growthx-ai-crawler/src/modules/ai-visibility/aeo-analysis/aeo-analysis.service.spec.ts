import { Test, TestingModule } from '@nestjs/testing';
import { AeoAnalysisService } from './aeo-analysis.service';

describe('AeoAnalysisService', () => {
  let service: AeoAnalysisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AeoAnalysisService],
    }).compile();

    service = module.get<AeoAnalysisService>(AeoAnalysisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
