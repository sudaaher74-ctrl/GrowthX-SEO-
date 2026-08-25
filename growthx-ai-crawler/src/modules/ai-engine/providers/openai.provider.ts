import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import { IAiProvider, AiProviderGenerateOptions } from '../interfaces/ai-provider.interface';
import { extractAndParseJson } from '../utils/json-extractor.util';

@Injectable()
export class OpenAiProvider implements IAiProvider {
  readonly name = 'OPENAI';
  private readonly logger = new Logger(OpenAiProvider.name);

  private readonly apiKey?: string;
  private readonly defaultModel: string;
  private client?: OpenAI;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('OPENAI_API_KEY') || process.env.OPENAI_API_KEY;
    this.defaultModel = this.config.get<string>('OPENAI_MODEL') || process.env.OPENAI_MODEL || 'gpt-4o';

    if (this.isAvailable()) {
      this.client = new OpenAI({ apiKey: this.apiKey! });
      this.logger.log(`OpenAiProvider initialized with model: ${this.defaultModel}`);
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
      throw new ServiceUnavailableException('OpenAI is not configured. Please provide OPENAI_API_KEY.');
    }

    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const response = await this.client.chat.completions.create({
      model: options?.model || this.defaultModel,
      messages,
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? 4000,
    });

    return response.choices[0]?.message?.content || '';
  }

  async generateStructuredJson<T>(
    prompt: string,
    systemPrompt?: string,
    jsonSchema?: Record<string, unknown>,
    options?: AiProviderGenerateOptions,
  ): Promise<T> {
    if (!this.isAvailable() || !this.client) {
      throw new ServiceUnavailableException('OpenAI is not configured. Please provide OPENAI_API_KEY.');
    }

    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const response = await this.client.chat.completions.create({
      model: options?.model || this.defaultModel,
      messages,
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? 4000,
      ...(jsonSchema
        ? {
            response_format: {
              type: 'json_schema',
              json_schema: { name: 'intelligence_response', schema: jsonSchema, strict: false },
            },
          }
        : { response_format: { type: 'json_object' } }),
    } as any);

    return extractAndParseJson<T>(response.choices[0]?.message?.content || '');
  }
}
