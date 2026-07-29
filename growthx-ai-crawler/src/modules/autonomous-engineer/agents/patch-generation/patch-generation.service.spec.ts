import { Test, TestingModule } from '@nestjs/testing';
import { PatchGenerationService } from './patch-generation.service';

describe('PatchGenerationService', () => {
  let service: PatchGenerationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PatchGenerationService],
    }).compile();

    service = module.get<PatchGenerationService>(PatchGenerationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
