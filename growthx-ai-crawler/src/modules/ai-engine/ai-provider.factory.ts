import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAiProvider } from './interfaces/ai-provider.interface';
import { SarvamProvider } from './providers/sarvam.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { ClaudeProvider } from './providers/claude.provider';

@Injectable()
export class AiProviderFactory {
  private readonly logger = new Logger(AiProviderFactory.name);

  constructor(
    private readonly config: ConfigService,
    private readonly sarvamProvider: SarvamProvider,
    private readonly geminiProvider: GeminiProvider,
    private readonly openAiProvider: OpenAiProvider,
    private readonly claudeProvider: ClaudeProvider,
  ) {}

  /**
   * Resolves the primary active AI provider based on configuration and availability.
   * Priority: Configured AI_PROVIDER/AI_ENGINE_PROVIDER -> Sarvam -> Gemini -> OpenAI -> Claude.
   */
  getProvider(providerOverride?: string): IAiProvider {
    const requested = (
      providerOverride ||
      this.config.get<string>('AI_PROVIDER') ||
      process.env.AI_PROVIDER ||
      'sarvam'
    ).toUpperCase();

    const providerMap: Record<string, IAiProvider> = {
      SARVAM: this.sarvamProvider,
      GEMINI: this.geminiProvider,
      OPENAI: this.openAiProvider,
      CLAUDE: this.claudeProvider,
      ANTHROPIC: this.claudeProvider,
    };

    const targetProvider = providerMap[requested];

    if (targetProvider && targetProvider.isAvailable()) {
      return targetProvider;
    }

    if (targetProvider && !targetProvider.isAvailable()) {
      this.logger.warn(
        `Requested AI provider '${requested}' is not configured with valid credentials. Finding fallback...`,
      );
    }

    // Default preference chain: Sarvam -> Gemini -> OpenAI -> Claude
    const chain: IAiProvider[] = [
      this.sarvamProvider,
      this.geminiProvider,
      this.openAiProvider,
      this.claudeProvider,
    ];

    for (const provider of chain) {
      if (provider.isAvailable()) {
        this.logger.log(`Active AI engine provider selected: ${provider.name}`);
        return provider;
      }
    }

    // If none are available, return the requested or Sarvam provider so it raises a helpful exception
    return targetProvider || this.sarvamProvider;
  }
}
