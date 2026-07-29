import { Test, TestingModule } from '@nestjs/testing';
import { FileSelectionService } from './file-selection.service';

describe('FileSelectionService', () => {
  let service: FileSelectionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FileSelectionService],
    }).compile();

    service = module.get<FileSelectionService>(FileSelectionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
