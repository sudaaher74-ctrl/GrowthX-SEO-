import { Test, TestingModule } from '@nestjs/testing';
import { InvestigationToolsService } from './investigation-tools.service';

describe('InvestigationToolsService', () => {
  let service: InvestigationToolsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InvestigationToolsService],
    }).compile();

    service = module.get<InvestigationToolsService>(InvestigationToolsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
