import { Module } from '@nestjs/common';
import { GroqController } from './groq.controller';
import { AiSearchModule } from '../ai-search/ai-search.module';

/**
 * Exposes the Groq Llama 3.1 8B Instant endpoints:
 *   GET  /api/ai/health  — provider config check
 *   POST /api/ai/chat    — single-turn or multi-turn AI chat
 *
 * Both require a JWT. `/chat` bills a paid model on every call, so it is also
 * gated on the caller's plan and usage allowance and records usage on success.
 * The container's own liveness probe is the root `/health` route on
 * HealthController, not `/api/ai/health`, so guarding these is safe.
 */
@Module({
  imports: [AiSearchModule],
  controllers: [GroqController],
})
export class GroqModule {}
