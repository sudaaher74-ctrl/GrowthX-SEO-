import { Module } from '@nestjs/common';
import { GroqController } from './groq.controller';
import { AiSearchModule } from '../ai-search/ai-search.module';

/**
 * Exposes the Groq Llama 3.1 8B Instant endpoints:
 *   GET  /api/ai/health  — provider config check
 *   POST /api/ai/chat    — single-turn or multi-turn AI chat
 *
 * Routes are intentionally unauthenticated so they can serve as a lightweight
 * AI chat surface without requiring a JWT. Add JwtAuthGuard to the controller
 * if the product roadmap calls for it.
 */
@Module({
  imports: [AiSearchModule],
  controllers: [GroqController],
})
export class GroqModule {}
