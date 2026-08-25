import { Injectable, Logger } from '@nestjs/common';
import { FetcherService } from '../crawler/fetcher.service';
import { AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { parseModelJson } from '../ai-engine/utils/json-extractor.util';

const SCHEMA_JSON_SCHEMA = {
  type: 'object',
  properties: {
    schema: { type: 'string', description: 'The raw JSON-LD string including the <script type="application/ld+json"> tags.' },
    rationale: { type: 'string', description: 'Brief explanation of why this schema type was chosen and what data it includes.' },
  },
  required: ['schema', 'rationale'],
  additionalProperties: false,
} as const;

@Injectable()
export class SchemaGeneratorService {
  private readonly logger = new Logger(SchemaGeneratorService.name);

  constructor(
    private readonly fetcher: FetcherService,
    private readonly router: MultiAiRouterService,
  ) {}

  async generateSchema(url: string, type: string, organizationId: string) {
    this.logger.log(`Fetching ${url} for schema generation (${type})`);
    
    const pageData = await this.fetcher.fetchPage(url);
    if (!pageData || !pageData.html) {
      throw new Error('Failed to fetch the URL content.');
    }

    const systemPrompt = `You are an expert technical SEO engineer. Your task is to generate valid JSON-LD schema markup for the provided webpage.
The requested schema type is: ${type}.
Extract relevant information (business name, address, contact, authors, publish dates, FAQ questions, etc.) directly from the provided page text.
If the exact information is not available, try to infer it or leave the field out if it's optional, but ensure the resulting schema is 100% syntactically valid JSON-LD.
Output the schema wrapped in <script type="application/ld+json">...</script> tags.`;

    const textContent = this.extractTextFromHtml(pageData.html);
    const safeContent = textContent.slice(0, 15000);

    const prompt = `URL: ${url}\n\nPage Content:\n${safeContent}\n\nGenerate the JSON-LD schema now.`;

    const result = await this.router.generate({
      prompt,
      systemInstruction: systemPrompt,
      task: AiTask.REASONING,
      organizationId,
      jsonSchema: SCHEMA_JSON_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 2000,
    });

    if (!result.text?.trim()) {
      throw new Error('AI failed to generate schema.');
    }

    const parsed = this.parseJson(result.text);
    return {
      schema: parsed.schema,
      rationale: parsed.rationale,
      model: result.model,
    };
  }

  private extractTextFromHtml(html: string): string {
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
    text = text.replace(/<[^>]+>/g, ' ');
    return text.replace(/\s+/g, ' ').trim();
  }

  /** Reads the model's JSON answer, repairing truncation or naming the failure. */
  private parseJson(text: string): Record<string, any> {
    return parseModelJson(text, 'Schema generator');
  }
}
