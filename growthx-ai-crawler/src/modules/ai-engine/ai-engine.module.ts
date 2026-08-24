import { Global, Module } from '@nestjs/common';
import { SarvamProvider } from './providers/sarvam.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { ClaudeProvider } from './providers/claude.provider';
import { AiProviderFactory } from './ai-provider.factory';
import { UnifiedAiService } from './unified-ai.service';
import { UnifiedAiController } from './unified-ai.controller';

@Global()
@Module({
  controllers: [UnifiedAiController],
  providers: [
    SarvamProvider,
    GeminiProvider,
    OpenAiProvider,
    ClaudeProvider,
    AiProviderFactory,
    UnifiedAiService,
  ],
  exports: [
    UnifiedAiService,
    AiProviderFactory,
    SarvamProvider,
    GeminiProvider,
    OpenAiProvider,
    ClaudeProvider,
  ],
})
export class AiEngineModule {}
