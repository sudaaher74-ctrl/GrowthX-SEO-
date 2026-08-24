import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAiProvider, AiProviderGenerateOptions } from '../interfaces/ai-provider.interface';
import { extractAndParseJson } from '../utils/json-extractor.util';

@Injectable()
export class SarvamProvider implements IAiProvider {
  readonly name = 'SARVAM';
  private readonly logger = new Logger(SarvamProvider.name);

  private readonly apiKey?: string;
  private readonly defaultModel: string;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('SARVAM_API_KEY') || process.env.SARVAM_API_KEY;
    this.defaultModel = this.config.get<string>('SARVAM_MODEL') || process.env.SARVAM_MODEL || 'sarvam-105b';
    this.baseUrl = this.config.get<string>('SARVAM_BASE_URL') || 'https://api.sarvam.ai/v1';

    if (this.isAvailable()) {
      this.logger.log(`SarvamProvider initialized with model: ${this.defaultModel}`);
    } else {
      this.logger.warn('SarvamProvider: SARVAM_API_KEY is not configured or is a placeholder.');
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
    if (!this.isAvailable()) {
      throw new ServiceUnavailableException('Sarvam AI is not configured. Please provide a valid SARVAM_API_KEY.');
    }

    const model = options?.model || this.defaultModel;
    const temperature = options?.temperature ?? 0.2;
    const maxTokens = options?.maxTokens ?? 4000;
    const timeoutMs = options?.timeoutMs ?? 60000;
    const maxRetries = options?.retries ?? 3;

    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const payload = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    return this.executeWithRetry(payload, timeoutMs, maxRetries);
  }

  async generateStructuredJson<T>(
    prompt: string,
    systemPrompt?: string,
    jsonSchema?: Record<string, unknown>,
    options?: AiProviderGenerateOptions,
  ): Promise<T> {
    const jsonSystemInstruction = [
      systemPrompt || 'You are an expert AI strategic intelligence and SEO consultant.',
      'CRITICAL FORMATTING DIRECTIVE:',
      'You MUST return ONLY a strictly valid JSON object adhering to the requested fields.',
      'Do NOT include markdown backticks (```json), commentary, or surrounding prose.',
      jsonSchema ? `JSON Schema to conform with:\n${JSON.stringify(jsonSchema, null, 2)}` : '',
    ].filter(Boolean).join('\n\n');

    const raw = await this.generateText(prompt, jsonSystemInstruction, options);
    return extractAndParseJson<T>(raw);
  }

  /**
   * Executes HTTP request with timeout, rate limit handling, and exponential backoff retry.
   */
  private async executeWithRetry(
    payload: Record<string, any>,
    timeoutMs: number,
    maxRetries: number,
  ): Promise<string> {
    const url = `${this.baseUrl}/chat/completions`;
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-subscription-key': this.apiKey!,
            Authorization: `Bearer ${this.apiKey!}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (response.ok) {
          const json: any = await response.json();
          const choice = json?.choices?.[0];
          const content = choice?.message?.content;

          if (typeof content !== 'string') {
            throw new Error('Sarvam API returned an empty or invalid message content.');
          }

          return content;
        }

        // Handle rate limiting (429) or transient server errors (500, 502, 503, 504)
        const errorText = await response.text().catch(() => '');
        const status = response.status;
        this.logger.warn(`Sarvam API request failed (HTTP ${status}, Attempt ${attempt}/${maxRetries}): ${errorText}`);

        if (status === 429 || (status >= 500 && status < 600)) {
          const retryAfterHeader = response.headers.get('Retry-After');
          const delayMs = retryAfterHeader
            ? parseInt(retryAfterHeader, 10) * 1000
            : Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 10000);

          this.logger.log(`Sarvam rate limit / transient error encountered. Waiting ${delayMs}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        throw new Error(`Sarvam API error (HTTP ${status}): ${errorText}`);
      } catch (err: any) {
        clearTimeout(timer);
        lastError = err;

        if (err.name === 'AbortError') {
          this.logger.warn(`Sarvam API request timed out after ${timeoutMs}ms (Attempt ${attempt}/${maxRetries})`);
        } else {
          this.logger.warn(`Sarvam API network error (Attempt ${attempt}/${maxRetries}): ${err.message}`);
        }

        if (attempt < maxRetries) {
          const backoff = Math.min(1000 * Math.pow(2, attempt), 8000);
          await new Promise((resolve) => setTimeout(resolve, backoff));
        }
      }
    }

    throw new ServiceUnavailableException(
      `Sarvam AI service unavailable after ${maxRetries} attempts. Cause: ${lastError?.message || 'Unknown error'}`,
    );
  }
}
