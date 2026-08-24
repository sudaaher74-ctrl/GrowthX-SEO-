export interface AiProviderGenerateOptions {
  /** Maximum output tokens. Defaults to provider standard (e.g. 4000). */
  maxTokens?: number;

  /** Sampling temperature between 0.0 and 1.0. Defaults to 0.2. */
  temperature?: number;

  /** Request timeout in milliseconds. Defaults to 60000ms. */
  timeoutMs?: number;

  /** Number of retry attempts on network errors or 429 rate limits. Defaults to 3. */
  retries?: number;

  /** Model override if needed. */
  model?: string;
}

export interface IAiProvider {
  /** The identifier of this provider (e.g. 'SARVAM', 'GEMINI', 'OPENAI', 'CLAUDE'). */
  readonly name: string;

  /** Returns true if the provider has valid API credentials configured. */
  isAvailable(): boolean;

  /**
   * Generates a raw text completion from the provider.
   */
  generateText(
    prompt: string,
    systemPrompt?: string,
    options?: AiProviderGenerateOptions,
  ): Promise<string>;

  /**
   * Generates structured JSON matching the provided schema or type structure.
   */
  generateStructuredJson<T>(
    prompt: string,
    systemPrompt?: string,
    jsonSchema?: Record<string, unknown>,
    options?: AiProviderGenerateOptions,
  ): Promise<T>;
}
