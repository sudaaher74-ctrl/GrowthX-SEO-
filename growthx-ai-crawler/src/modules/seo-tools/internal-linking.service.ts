import { Injectable, Logger } from '@nestjs/common';
import { FetcherService } from '../crawler/fetcher.service';
import { PrismaService } from '../../database/prisma.service';
import { AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';

const INTERNAL_LINK_SCHEMA = {
  type: 'object',
  properties: {
    pageTitle: { type: 'string' },
    summary: { type: 'string', description: 'Summary of the internal link profile and topical cluster potential' },
    linkHealthScore: { type: 'number', minimum: 0, maximum: 100 },
    currentInternalLinksCount: { type: 'number' },
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          targetUrl: { type: 'string', description: 'The destination URL to link to' },
          targetTitle: { type: 'string', description: 'Title or topic of the destination page' },
          recommendedAnchorText: { type: 'string', description: 'The exact phrase in the source content that should become a hyperlink' },
          sentenceContext: { type: 'string', description: 'The paragraph or sentence excerpt showing where to place the link' },
          linkType: { 
            type: 'string', 
            enum: ['TOPICAL_AUTHORITY', 'PRODUCT_CONVERSION', 'PILLAR_PAGE', 'RELATED_GUIDE', 'FOUNDATIONAL_CONTENT'],
            description: 'Strategic reason for this internal link'
          },
          relevancyScore: { type: 'number', minimum: 0, maximum: 100 },
          rationale: { type: 'string', description: 'Why this internal link boosts topical authority or user journey' },
        },
        required: ['targetUrl', 'targetTitle', 'recommendedAnchorText', 'sentenceContext', 'linkType', 'relevancyScore', 'rationale'],
      },
    },
  },
  required: ['pageTitle', 'summary', 'linkHealthScore', 'currentInternalLinksCount', 'suggestions'],
  additionalProperties: false,
} as const;

@Injectable()
export class InternalLinkingService {
  private readonly logger = new Logger(InternalLinkingService.name);

  constructor(
    private readonly fetcher: FetcherService,
    private readonly prisma: PrismaService,
    private readonly router: MultiAiRouterService,
  ) {}

  async suggestInternalLinks(url: string, projectId: string, organizationId: string) {
    this.logger.log(`Analyzing internal links for ${url} in project ${projectId}`);

    const [pageData, projectPages] = await Promise.all([
      this.fetcher.fetchPage(url),
      this.fetchProjectPages(projectId),
    ]);

    if (!pageData || !pageData.html) {
      throw new Error('Failed to fetch the target page content.');
    }

    const { pageTitle, internalLinks, cleanText } = this.extractPageLinksAndText(pageData.html, url);

    // Build target domain candidate list
    const candidatePages = this.buildCandidatePages(url, projectPages, internalLinks);

    const systemPrompt = `You are a world-class Technical and Topical SEO strategist.
Your task is to analyze the source webpage content and recommend high-impact internal links to other relevant pages on the website.
Guidelines:
1. Identify natural, context-rich anchor text within the source text. Avoid generic anchors like "click here" or "read more".
2. Match sentences in the source text to relevant candidate destination URLs and topics.
3. Suggest 4 to 8 high-relevance internal links that strengthen site architecture, topical clusters, and pass PageRank effectively.
4. Calculate a realistic internal link health score (0-100) and link strategy summary.`;

    const prompt = `Source Page URL: ${url}
Source Page Title: ${pageTitle}
Current Internal Links Count on Page: ${internalLinks.length}

Source Page Text Excerpt:
${cleanText.slice(0, 7000)}

Available Destination / Related Pages on this Website:
${candidatePages.map((p, i) => `[${i + 1}] URL: ${p.url} | Title/Topic: ${p.title}`).join('\n')}

Generate the internal linking strategy and actionable suggestions.`;

    const result = await this.router.generate({
      prompt,
      systemInstruction: systemPrompt,
      task: AiTask.REASONING,
      organizationId,
      jsonSchema: INTERNAL_LINK_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 3500,
    });

    if (!result.text?.trim()) {
      throw new Error('AI failed to generate internal link suggestions.');
    }

    const parsed = this.parseJson(result.text);

    return {
      ...parsed,
      model: result.model,
    };
  }

  private async fetchProjectPages(projectId: string): Promise<{ url: string; title: string }[]> {
    try {
      const pages = await this.prisma.page.findMany({
        where: {
          crawlJob: {
            website: {
              projectId,
            },
          },
          statusCode: 200,
        },
        select: {
          url: true,
          title: true,
        },
        distinct: ['url'],
        take: 40,
        orderBy: { crawledAt: 'desc' },
      });

      return pages.map((p) => ({
        url: p.url,
        title: p.title || p.url,
      }));
    } catch (err) {
      this.logger.warn(`Could not load existing project pages: ${err}`);
      return [];
    }
  }

  private extractPageLinksAndText(html: string, baseUrl: string) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const pageTitle = titleMatch ? titleMatch[1].trim() : baseUrl;

    let baseHostname = '';
    try {
      baseHostname = new URL(baseUrl).hostname;
    } catch {}

    const linkRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
    const internalLinks: { url: string; text: string }[] = [];
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(html)) !== null) {
      const rawHref = match[1].trim();
      const rawAnchor = match[2].replace(/<[^>]+>/g, '').trim();

      if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:')) {
        continue;
      }

      try {
        const fullUrl = new URL(rawHref, baseUrl);
        if (fullUrl.hostname === baseHostname && fullUrl.href !== baseUrl) {
          internalLinks.push({
            url: fullUrl.href,
            text: rawAnchor,
          });
        }
      } catch {}
    }

    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
    text = text.replace(/<[^>]+>/g, ' ');
    const cleanText = text.replace(/\s+/g, ' ').trim();

    return {
      pageTitle,
      internalLinks,
      cleanText,
    };
  }

  private buildCandidatePages(
    sourceUrl: string,
    projectPages: { url: string; title: string }[],
    existingInternalLinks: { url: string; text: string }[],
  ): { url: string; title: string }[] {
    const candidateMap = new Map<string, string>();

    // Add project pages from DB
    for (const p of projectPages) {
      if (p.url !== sourceUrl) {
        candidateMap.set(p.url, p.title);
      }
    }

    // Add existing internal links extracted from page navigation/footer if not present
    for (const l of existingInternalLinks) {
      if (l.url !== sourceUrl && !candidateMap.has(l.url)) {
        candidateMap.set(l.url, l.text || l.url);
      }
    }

    // If still empty or very few, generate common semantic silo targets based on root domain
    if (candidateMap.size < 3) {
      try {
        const root = new URL(sourceUrl).origin;
        candidateMap.set(`${root}/services`, 'Main Services / Solutions');
        candidateMap.set(`${root}/blog`, 'Articles & Guides Blog Hub');
        candidateMap.set(`${root}/pricing`, 'Pricing & Plans');
        candidateMap.set(`${root}/case-studies`, 'Customer Success & Case Studies');
        candidateMap.set(`${root}/contact`, 'Contact & Consultation Request');
      } catch {}
    }

    return Array.from(candidateMap.entries()).slice(0, 30).map(([url, title]) => ({ url, title }));
  }

  private parseJson(text: string): Record<string, any> {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    try { return JSON.parse(candidate); } catch { return {}; }
  }
}
