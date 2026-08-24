import { Test, TestingModule } from '@nestjs/testing';
import { AiSearchController } from './ai-search.controller';
import { AiSearchService } from './ai-search/ai-search.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

describe('AiSearchController', () => {
  let controller: AiSearchController;
  let aiSearch: { askQuestion: jest.Mock };
  let entitlements: { recordUsage: jest.Mock };

  beforeEach(async () => {
    aiSearch = { askQuestion: jest.fn().mockResolvedValue({ answer: 'ok' }) };
    entitlements = { recordUsage: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiSearchController],
      providers: [
        { provide: AiSearchService, useValue: aiSearch },
],
    })
      // The guards are exercised in their own suites; here we test the handler,
      // so they are stubbed out rather than wired up.
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      
      .compile();
    controller = module.get(AiSearchController);
  });

  it('passes the guard-resolved organization to the service', async () => {
    const req = { organizationId: 'org_1' };
    await controller.askQuestion(req, 'proj_1', { question: 'why?' });
    expect(aiSearch.askQuestion).toHaveBeenCalledWith('proj_1', 'why?', 'org_1');
  });

  it('bills the analysis only after the answer comes back', async () => {
    const req = { organizationId: 'org_1' };
    await controller.askQuestion(req, 'proj_1', { question: 'why?' });
    expect(entitlements.recordUsage).toHaveBeenCalledWith('org_1', 'AI_ANALYSES');
  });

  it('does not bill when the answer fails', async () => {
    aiSearch.askQuestion.mockRejectedValue(new Error('provider down'));
    await expect(
      controller.askQuestion({ organizationId: 'org_1' }, 'proj_1', { question: 'why?' }),
    ).rejects.toThrow('provider down');
    expect(entitlements.recordUsage).not.toHaveBeenCalled();
  });
});
