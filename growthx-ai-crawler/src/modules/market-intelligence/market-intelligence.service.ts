import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';

/** Enough of the site that the analysis is about this business specifically. */
const SAMPLE_PAGE_LIMIT = 15;

const SYSTEM_PROMPT = `You are a market analyst. You are given real crawled pages from a
single company's website and the search prompts their visibility is tracked against.
Report only what that evidence supports. Do not invent products, locations, or
customer claims that do not appear in the evidence. If the evidence is thin, say so
in the summary and return fewer topics rather than padding the list.`;

const MARKET_SCHEMA = {
  type: 'object',
  properties: {
    sentimentScore: {
      type: 'number',
      description: 'Market sentiment from -1 (hostile) to 1 (highly favourable), based on the evidence.',
    },
    sentimentSummary: {
      type: 'string',
      description: "Two to three sentences on how this specific business is positioned and perceived.",
    },
    trendingTopics: {
      type: 'array',
      items: { type: 'string' },
      description: 'Search topics relevant to THIS business, drawn from its pages and tracked prompts.',
    },
  },
  required: ['sentimentScore', 'sentimentSummary', 'trendingTopics'],
};

@Injectable()
export class MarketIntelligenceService {
  private readonly logger = new Logger(MarketIntelligenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MultiAiRouterService,
  ) {}

  /**
   * Returns the stored report, or null when the project has never generated one.
   *
   * It deliberately does not generate on read. Auto-seeding a report here is how
   * one tenant ends up looking at another tenant's market analysis: the caller
   * cannot tell a real report from a placeholder, so the placeholder gets shown
   * as fact. The client renders an empty state instead.
   */
  async getMarketIntelligence(projectId: string) {
    return this.prisma.marketIntelligence.findUnique({ where: { projectId } });
  }

  /**
   * Produces sentiment and trending topics from the project's own crawled pages
   * and tracked prompts. There is no template fallback — a generic report
   * presented as analysis of a customer's market is worse than no report.
   */
  async generateMarketIntelligence(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { websites: { select: { id: true, domain: true } } },
    });
    if (!project) throw new NotFoundException('Project not found');

    const websiteIds = project.websites.map((w) => w.id);
    const domains = project.websites.map((w) => w.domain);

    // Pages hang off a crawl job, so take the most recent crawl that actually
    // returned pages for one of this project's own websites.
    const latestCrawl = websiteIds.length
      ? await this.prisma.crawlJob.findFirst({
          where: { websiteId: { in: websiteIds }, pagesCrawled: { gt: 0 } },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        })
      : null;

    const [pages, prompts] = await Promise.all([
      latestCrawl
        ? this.prisma.page.findMany({
            where: { crawlJobId: latestCrawl.id },
            select: { url: true, title: true, metaDescription: true },
            orderBy: { crawledAt: 'desc' },
            take: SAMPLE_PAGE_LIMIT,
          })
        : Promise.resolve([]),
      this.prisma.trackedPrompt.findMany({
        where: { projectId },
        select: { text: true, intent: true, cluster: true },
      }),
    ]);

    if (pages.length === 0) {
      throw new BadRequestException(
        'Run a crawl before generating market intelligence — without site data the report would be generic.',
      );
    }

    const evidence = [
      `Project: ${project.name}`,
      `Domains: ${domains.join(', ') || 'unknown'}`,
      '',
      'Crawled pages:',
      ...pages.map(
        (p) => `- ${p.url} | title: ${p.title ?? '(none)'} | description: ${p.metaDescription ?? '(none)'}`,
      ),
      '',
      prompts.length
        ? `Tracked search prompts:\n${prompts
            .map((p) => `- ${p.text}${p.intent ? ` (intent: ${p.intent})` : ''}${p.cluster ? ` [${p.cluster}]` : ''}`)
            .join('\n')}`
        : 'Tracked search prompts: none yet.',
    ].join('\n');

    const completion = await this.router.generate({
      prompt: `Analyse the market position of this business from the evidence below.\n\n${evidence}`,
      systemInstruction: SYSTEM_PROMPT,
      task: AiTask.REASONING,
      organizationId: project.organizationId,
      jsonSchema: MARKET_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 4000,
    });

    if (completion.refused || !completion.text.trim()) {
      throw new ServiceUnavailableException('The model did not return a market report. Please retry.');
    }

    let parsed: { sentimentScore?: number; sentimentSummary?: string; trendingTopics?: string[] };
    try {
      parsed = JSON.parse(completion.text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim());
    } catch {
      throw new ServiceUnavailableException('The model returned an unusable market report. Please retry.');
    }

    if (typeof parsed.sentimentScore !== 'number' || !Array.isArray(parsed.trendingTopics)) {
      throw new ServiceUnavailableException('The model returned an unusable market report. Please retry.');
    }

    const fields = {
      sentimentScore: Math.max(-1, Math.min(1, parsed.sentimentScore)),
      sentimentSummary: parsed.sentimentSummary ?? null,
      trendingTopics: parsed.trendingTopics.filter((t): t is string => typeof t === 'string'),
    };

    this.logger.log(`Market intelligence generated for project ${projectId} by ${completion.model}.`);

    return this.prisma.marketIntelligence.upsert({
      where: { projectId },
      update: { ...fields, updatedAt: new Date() },
      create: { projectId, ...fields },
    });
  }
}
