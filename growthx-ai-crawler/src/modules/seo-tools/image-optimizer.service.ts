import { Injectable, Logger } from '@nestjs/common';
import { FetcherService } from '../crawler/fetcher.service';
import { AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';

const IMAGE_OPTIMIZER_SCHEMA = {
  type: 'object',
  properties: {
    pageTitle: { type: 'string' },
    summary: { type: 'string', description: 'Brief audit summary of the page image SEO health' },
    overallScore: { type: 'number', minimum: 0, maximum: 100 },
    images: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          src: { type: 'string' },
          currentAlt: { type: 'string' },
          suggestedAlt: { type: 'string' },
          seoScore: { type: 'number', minimum: 0, maximum: 100 },
          issues: {
            type: 'array',
            items: { type: 'string' },
          },
          recommendedFileName: { type: 'string' },
          rationale: { type: 'string' },
        },
        required: ['src', 'currentAlt', 'suggestedAlt', 'seoScore', 'issues', 'recommendedFileName', 'rationale'],
      },
    },
  },
  required: ['pageTitle', 'summary', 'overallScore', 'images'],
  additionalProperties: false,
} as const;

export interface ExtractedImageInfo {
  src: string;
  alt: string;
  context: string;
}

@Injectable()
export class ImageOptimizerService {
  private readonly logger = new Logger(ImageOptimizerService.name);

  constructor(
    private readonly fetcher: FetcherService,
    private readonly router: MultiAiRouterService,
  ) {}

  async analyzeAndOptimizeImages(url: string, organizationId: string) {
    this.logger.log(`Fetching ${url} for Image SEO optimization`);

    const pageData = await this.fetcher.fetchPage(url);
    if (!pageData || !pageData.html) {
      throw new Error('Failed to fetch the webpage content.');
    }

    const { pageTitle, extractedImages, pageText } = this.extractImagesAndContext(pageData.html, url);

    if (extractedImages.length === 0) {
      return {
        pageTitle: pageTitle || url,
        summary: 'No standard <img> tags found on the page to optimize.',
        overallScore: 100,
        images: [],
        model: 'heuristic',
      };
    }

    const systemPrompt = `You are an expert on-page SEO specialist specializing in Image SEO and Accessibility (WCAG).
Analyze the extracted images from the page, audit their current alt text, and generate highly descriptive, keyword-rich, concise alt text that adheres to Google Image SEO guidelines.
Rules:
1. Don't stuff keywords unnaturally.
2. If current alt text is missing or generic (e.g., "image1", "photo", "logo"), flag it in issues.
3. Suggest a search-friendly file name (hyphen-separated, lowercase).
4. Provide an overall Image SEO health score (0-100) and individual image scores.
5. Base the alt text on the image source URL, surrounding context text, and page topic.`;

    const imagesToAnalyze = extractedImages.slice(0, 20); // analyze up to 20 images to maintain speed & token budget
    const prompt = `Webpage URL: ${url}
Webpage Title: ${pageTitle}

Page Context:
${pageText.slice(0, 4000)}

Extracted Images to Audit & Optimize:
${imagesToAnalyze.map((img, idx) => `
[Image ${idx + 1}]
Src: ${img.src}
Current Alt: ${img.alt || '[MISSING ALT TEXT]'}
Surrounding Context: ${img.context}
`).join('\n')}

Generate the complete image optimization audit and suggested alt tags.`;

    const result = await this.router.generate({
      prompt,
      systemInstruction: systemPrompt,
      task: AiTask.REASONING,
      organizationId,
      jsonSchema: IMAGE_OPTIMIZER_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 3000,
    });

    if (!result.text?.trim()) {
      throw new Error('AI failed to generate Image SEO recommendations.');
    }

    const parsed = this.parseJson(result.text);

    return {
      ...parsed,
      model: result.model,
    };
  }

  private extractImagesAndContext(html: string, baseUrl: string): { pageTitle: string; extractedImages: ExtractedImageInfo[]; pageText: string } {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const pageTitle = titleMatch ? titleMatch[1].trim() : '';

    const imgRegex = /<img\b([^>]+)>/gi;
    const extractedImages: ExtractedImageInfo[] = [];
    const seenSrcs = new Set<string>();

    let match: RegExpExecArray | null;
    while ((match = imgRegex.exec(html)) !== null) {
      const attributes = match[1];

      // Extract src or data-src
      const srcMatch = attributes.match(/(?:src|data-src)=["']([^"']+)["']/i);
      if (!srcMatch) continue;

      let rawSrc = srcMatch[1].trim();
      if (!rawSrc || rawSrc.startsWith('data:') || rawSrc.includes('pixel') || rawSrc.includes('tracking')) {
        continue; // ignore trackers and 1px transparent spacers
      }

      // Resolve relative URL if needed
      let fullSrc = rawSrc;
      try {
        fullSrc = new URL(rawSrc, baseUrl).href;
      } catch {
        fullSrc = rawSrc;
      }

      if (seenSrcs.has(fullSrc)) continue;
      seenSrcs.add(fullSrc);

      // Extract alt
      const altMatch = attributes.match(/alt=["']([^"']*)["']/i);
      const currentAlt = altMatch ? altMatch[1].trim() : '';

      // Get surrounding text context (up to 150 chars before and after)
      const startIdx = Math.max(0, match.index - 150);
      const endIdx = Math.min(html.length, match.index + match[0].length + 150);
      const rawContext = html.slice(startIdx, endIdx)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      extractedImages.push({
        src: fullSrc,
        alt: currentAlt,
        context: rawContext,
      });
    }

    // Clean text for general page context
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
    text = text.replace(/<[^>]+>/g, ' ');
    const pageText = text.replace(/\s+/g, ' ').trim();

    return {
      pageTitle,
      extractedImages,
      pageText,
    };
  }

  private parseJson(text: string): Record<string, any> {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    try { return JSON.parse(candidate); } catch { return {}; }
  }
}
