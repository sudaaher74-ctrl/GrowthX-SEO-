import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { IAiProvider, AiProviderGenerateOptions } from '../interfaces/ai-provider.interface';
import { extractAndParseJson } from '../utils/json-extractor.util';

@Injectable()
export class ClaudeProvider implements IAiProvider {
  readonly name = 'CLAUDE';
  private readonly logger = new Logger(ClaudeProvider.name);

  private readonly apiKey?: string;
  private readonly defaultModel: string;
  private client?: Anthropic;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('ANTHROPIC_API_KEY') || process.env.ANTHROPIC_API_KEY;
    this.defaultModel = this.config.get<string>('ANTHROPIC_MODEL') || process.env.ANTHROPIC_MODEL || 'claude-opus-5';

    if (this.isAvailable()) {
      this.client = new Anthropic({ apiKey: this.apiKey! });
      this.logger.log(`ClaudeProvider initialized with model: ${this.defaultModel}`);
    }
  }

  isAvailable(): boolean {
    if (!this.apiKey) return false;
    const lower = this.apiKey.toLowerCase();
    return !lower.startsWith('your_') && !lower.startsWith('add-') && !lower.includes('***') && this.apiKey.length > 5;
  }

  async generateText(
    prompt: string,
    systemPrompt?: string,
    options?: AiProviderGenerateOptions,
  ): Promise<string> {
    if (!this.isAvailable() || !this.client) {
      throw new ServiceUnavailableException('Anthropic Claude is not configured. Please provide ANTHROPIC_API_KEY.');
    }

    const maxTokens = options?.maxTokens ?? 4000;
    const message = await this.client.messages.create({
      model: options?.model || this.defaultModel,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
      ...(systemPrompt ? { system: systemPrompt } : {}),
    });

    const text = message.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('');

    return text;
  }

  async generateStructuredJson<T>(
    prompt: string,
    systemPrompt?: string,
    jsonSchema?: Record<string, unknown>,
    options?: AiProviderGenerateOptions,
  ): Promise<T> {
    if (!this.isAvailable() || !this.client) {
      throw new ServiceUnavailableException('Anthropic Claude is not configured. Please provide ANTHROPIC_API_KEY.');
    }

    const maxTokens = options?.maxTokens ?? 4000;
    const body: any = {
      model: options?.model || this.defaultModel,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
      ...(systemPrompt ? { system: systemPrompt } : {}),
      ...(jsonSchema
        ? {
            output_config: {
              format: { type: 'json_schema', schema: jsonSchema },
            },
          }
        : {}),
    };

    const message = await this.client.messages.create(body);
    const text = message.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('');

    return extractAndParseJson<T>(text);
  }
}
