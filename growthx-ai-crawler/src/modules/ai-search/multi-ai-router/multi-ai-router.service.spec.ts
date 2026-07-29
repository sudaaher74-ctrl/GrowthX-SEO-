import { Test, TestingModule } from '@nestjs/testing';
import { MultiAiRouterService } from './multi-ai-router.service';

describe('MultiAiRouterService', () => {
  let service: MultiAiRouterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MultiAiRouterService],
    }).compile();

    service = module.get<MultiAiRouterService>(MultiAiRouterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
