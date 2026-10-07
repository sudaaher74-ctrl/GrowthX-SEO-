import { Injectable, Logger } from '@nestjs/common';
import { MultiAiRouterService, AiProvider, AiTask } from '../ai-search/multi-ai-router/multi-ai-router.service';

export interface ScanResult {
  provider: string;
  model: string;
  text: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  error?: string;
  refused?: boolean;
}

@Injectable()
export class AiProviderAbstractionService {
  private readonly logger = new Logger(AiProviderAbstractionService.name);

  constructor(private readonly aiRouter: MultiAiRouterService) {}

  async runPrompt(
    prompt: string,
    provider: AiProvider,
    organizationId?: string,
    projectId?: string,
  ): Promise<ScanResult> {
    const start = Date.now();
    try {
      const completion = await this.aiRouter.generate({
        prompt,
        provider,
        allowFallback: false,
        task: AiTask.REASONING,
        organizationId,
        projectId,
      });

      return {
        provider: completion.provider,
        model: completion.model,
        text: completion.text,
        latencyMs: Date.now() - start,
        inputTokens: completion.usage.inputTokens,
        outputTokens: completion.usage.outputTokens,
        costUsd: completion.usage.estimatedCostUsd,
        refused: completion.refused,
      };
    } catch (e: any) {
      this.logger.error(`Failed to run prompt on ${provider}`, e.stack);
      return {
        provider,
        model: 'unknown',
        text: '',
        latencyMs: Date.now() - start,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: null,
        error: e.message || 'Unknown provider error',
      };
    }
  }
}
