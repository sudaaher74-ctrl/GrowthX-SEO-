import { Injectable, Logger } from '@nestjs/common';
import { FetcherService } from '../crawler/fetcher.service';
import { AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';

const META_JSON_SCHEMA = {
  type: 'object',
  properties: {
    currentTitle: { type: 'string' },
    currentDescription: { type: 'string' },
    titleScore: { type: 'number', minimum: 0, maximum: 100 },
    descriptionScore: { type: 'number', minimum: 0, maximum: 100 },
    analysis: { type: 'string', description: 'Brief audit of the current tags and why they need improvement' },
    proposedVariations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          rationale: { type: 'string' },
        },
        required: ['title', 'description', 'rationale'],
      },
    },
  },
  required: ['currentTitle', 'currentDescription', 'titleScore', 'descriptionScore', 'analysis', 'proposedVariations'],
  additionalProperties: false,
} as const;

@Injectable()
export class MetaOptimizerService {
  private readonly logger = new Logger(MetaOptimizerService.name);

  constructor(
    private readonly fetcher: FetcherService,
    private readonly router: MultiAiRouterService,
  ) {}

  async analyzeAndOptimize(url: string, organizationId: string) {
    this.logger.log(`Fetching ${url} for meta tag optimization`);
    
    const pageData = await this.fetcher.fetchPage(url);
    if (!pageData || !pageData.html) {
      throw new Error('Failed to fetch the URL content.');
    }

    const { title, description } = this.extractCurrentMeta(pageData.html);

    const systemPrompt = `You are an expert SEO copywriter. Your task is to analyze the current title and meta description of a webpage, score their SEO effectiveness (0-100), provide a brief analysis of their strengths/weaknesses (length, keywords, intent), and propose 3 highly optimized variations.
Title tags should be around 50-60 characters. Meta descriptions should be 150-160 characters. Both should compel the user to click.
Base your optimization on the provided page content context.`;

    const textContent = this.extractTextFromHtml(pageData.html);
    const safeContent = textContent.slice(0, 10000);

    const prompt = `URL: ${url}
Current Title: ${title || '[Missing]'}
Current Description: ${description || '[Missing]'}

Page Content (for context):
${safeContent}

Provide the audit and 3 optimized variations.`;

    const result = await this.router.generate({
      prompt,
      systemInstruction: systemPrompt,
      task: AiTask.REASONING,
      organizationId,
      jsonSchema: META_JSON_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 2500,
    });

    if (!result.text?.trim()) {
      throw new Error('AI failed to generate meta optimization.');
    }

    const parsed = this.parseJson(result.text);
    return {
      ...parsed,
      model: result.model,
    };
  }

  private extractCurrentMeta(html: string): { title: string; description: string } {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i) || 
                      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i);
    
    return {
      title: titleMatch ? titleMatch[1].trim() : '',
      description: descMatch ? descMatch[1].trim() : '',
    };
  }

  private extractTextFromHtml(html: string): string {
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
    text = text.replace(/<[^>]+>/g, ' ');
    return text.replace(/\s+/g, ' ').trim();
  }

  private parseJson(text: string): Record<string, any> {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    try { return JSON.parse(candidate); } catch { return {}; }
  }
}
