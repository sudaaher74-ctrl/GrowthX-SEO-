import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { TokensService } from '../tokens/tokens.service';
import { AiSearchModule } from './ai-search.module';
import { AiUsageService } from './multi-ai-router/ai-usage.service';
import { MultiAiRouterService } from './multi-ai-router/multi-ai-router.service';

/**
 * The router takes its ledger and its token service as optional dependencies,
 * so it can be built standalone. The cost of that is that a module which forgets
 * to provide one does not fail to boot: the router just stops metering. This is
 * the test that notices.
 */
describe('AiSearchModule wiring', () => {
  it('gives the router the spend ledger and the token service, so calls are metered', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), AiSearchModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    const router = moduleRef.get(MultiAiRouterService) as any;

    expect(router.usageLedger).toBeInstanceOf(AiUsageService);
    expect(router.tokens).toBeInstanceOf(TokensService);
  });
});
