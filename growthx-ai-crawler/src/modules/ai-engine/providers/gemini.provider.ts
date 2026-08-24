import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { IAiProvider, AiProviderGenerateOptions } from '../interfaces/ai-provider.interface';
import { extractAndParseJson } from '../utils/json-extractor.util';

@Injectable()
export class GeminiProvider implements IAiProvider {
  readonly name = 'GEMINI';
  private readonly logger = new Logger(GeminiProvider.name);

  private readonly apiKey?: string;
  private readonly defaultModel: string;
  private client?: GoogleGenAI;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;
    this.defaultModel = this.config.get<string>('GEMINI_MODEL') || process.env.GEMINI_MODEL || 'gemini-2.5-pro';

    if (this.isAvailable()) {
      this.client = new GoogleGenAI({ apiKey: this.apiKey! });
      this.logger.log(`GeminiProvider initialized with model: ${this.defaultModel}`);
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
      throw new ServiceUnavailableException('Gemini AI is not configured. Please provide GEMINI_API_KEY.');
    }

    const model = options?.model || this.defaultModel;
    const temperature = options?.temperature ?? 0.2;

    const response = await this.client.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        temperature,
      },
    });

    return response.text || '';
  }

  async generateStructuredJson<T>(
    prompt: string,
    systemPrompt?: string,
    jsonSchema?: Record<string, unknown>,
    options?: AiProviderGenerateOptions,
  ): Promise<T> {
    if (!this.isAvailable() || !this.client) {
      throw new ServiceUnavailableException('Gemini AI is not configured. Please provide GEMINI_API_KEY.');
    }

    const model = options?.model || this.defaultModel;
    const temperature = options?.temperature ?? 0.2;

    const response = await this.client.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        temperature,
        ...(jsonSchema
          ? { responseMimeType: 'application/json', responseSchema: jsonSchema as any }
          : { responseMimeType: 'application/json' }),
      },
    });

    return extractAndParseJson<T>(response.text || '');
  }
}
