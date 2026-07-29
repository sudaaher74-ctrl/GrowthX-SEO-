import { Test, TestingModule } from '@nestjs/testing';
import { RepositoryUnderstandingService } from './repository-understanding.service';

describe('RepositoryUnderstandingService', () => {
  let service: RepositoryUnderstandingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RepositoryUnderstandingService],
    }).compile();

    service = module.get<RepositoryUnderstandingService>(RepositoryUnderstandingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
