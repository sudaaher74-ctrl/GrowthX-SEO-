import { Test, TestingModule } from '@nestjs/testing';
import { AiSearchController } from './ai-search.controller';
import { AiSearchService } from './ai-search/ai-search.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/**
 * The two billing tests that used to live here were removed with the billing
 * system itself — Subscription and UsageRecord were dropped from the schema
 * and no EntitlementsService exists anywhere in the product. One of them had
 * been failing ever since; the other passed, but only because it asserted
 * against a bare mock wired to nothing, which is worse. Restoring them would
 * mean reinstating a billing system nobody asked for. Git has them if it
 * comes back.
 */
describe('AiSearchController', () => {
  let controller: AiSearchController;
  let aiSearch: { askQuestion: jest.Mock };

  beforeEach(async () => {
    aiSearch = { askQuestion: jest.fn().mockResolvedValue({ answer: 'ok' }) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiSearchController],
      providers: [{ provide: AiSearchService, useValue: aiSearch }],
    })
      // The guards are exercised in their own suites; here we test the handler,
      // so they are stubbed out rather than wired up.
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(AiSearchController);
  });

  it('passes the guard-resolved organization to the service', async () => {
    // The organization comes from the guard, never from the request body —
    // taking it from the body would let a caller read another tenant's data.
    const req = { organizationId: 'org_1' };
    await controller.askQuestion(req, 'proj_1', { question: 'why?' });
    expect(aiSearch.askQuestion).toHaveBeenCalledWith('proj_1', 'why?', 'org_1');
  });

  it('lets a provider failure surface rather than swallowing it', async () => {
    // A caller who gets a 200 with no answer has no way to tell a broken
    // provider from a question with nothing to say.
    aiSearch.askQuestion.mockRejectedValue(new Error('provider down'));

    await expect(
      controller.askQuestion({ organizationId: 'org_1' }, 'proj_1', { question: 'why?' }),
    ).rejects.toThrow('provider down');
  });
});
