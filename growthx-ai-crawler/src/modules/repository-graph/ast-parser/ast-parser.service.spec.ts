import { Test, TestingModule } from '@nestjs/testing';
import { AstParserService } from './ast-parser.service';

describe('AstParserService', () => {
  let service: AstParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AstParserService],
    }).compile();

    service = module.get<AstParserService>(AstParserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
