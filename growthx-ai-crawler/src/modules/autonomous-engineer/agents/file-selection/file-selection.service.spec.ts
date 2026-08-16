import { Test, TestingModule } from '@nestjs/testing';
import { AstParserService } from '../../../repository-graph/ast-parser/ast-parser.service';
import { FileSelectionService } from './file-selection.service';
import { MultiAiRouterService } from '../../../ai-search/multi-ai-router/multi-ai-router.service';

describe('FileSelectionService', () => {
  let service: FileSelectionService;
  let astParser: { indexRepository: jest.Mock; semanticSearch: jest.Mock };

  beforeEach(async () => {
    astParser = {
      indexRepository: jest.fn().mockResolvedValue(0),
      semanticSearch: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [FileSelectionService,
        { provide: MultiAiRouterService, useValue: { generate: jest.fn().mockResolvedValue({ text: '{}', model: 'stub', usage: {}, refused: false }) } }, { provide: AstParserService, useValue: astParser }],
    }).compile();
    service = module.get(FileSelectionService);
  });

  it('is constructed with the AST parser injected', () => {
    expect(service).toBeDefined();
    expect((service as any).astParser).toBe(astParser);
  });
});
