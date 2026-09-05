import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ContentPieceStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { StrategyService } from '../strategy/strategy.service';
import { parseModelJson } from '../ai-engine/utils/json-extractor.util';

/** The shape a generated page must come back in. */
const PAGE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Page title, 50-58 characters.' },
    metaDescription: { type: 'string', description: 'Meta description, 130-155 characters.' },
    slug: { type: 'string', description: 'URL slug, lowercase and hyphenated, no leading slash.' },
    body: {
      type: 'string',
      description:
        'The full page in Markdown. Must start with an H2 Key Overview / Direct Answer Block (45-55 words), contain a Markdown comparison/benchmark data table, and structured headings (## and ###). 1200-2500 words. No front matter, no H1 — the title becomes the H1.',
    },
    faqSchema: {
      type: 'string',
      description: 'Valid Schema.org FAQPage JSON-LD string with 3-5 high intent Q&As related to the target query.',
    },
  },
  required: ['title', 'metaDescription', 'slug', 'body'],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT =
  'You are an expert Generative Engine Optimization (GEO) and SEO content architect writing a page for a client\'s live website. ' +
  'Structure the article to rank in Google and win direct answer citations in Google AI Overviews, ChatGPT Search, and Perplexity. ' +
  'Requirements: ' +
  '1. Begin the body with "## Key Overview & Direct Answer" containing a punchy 45-55 word direct declarative summary. ' +
  '2. Include a detailed Markdown Comparison / Benchmark Data Table providing high information gain. ' +
  '3. Provide authoritative, thorough analysis (1200-2500 words) using clean ## and ### headings. ' +
  '4. Never invent client names or false statistics; focus on domain expertise, architectural trade-offs, and verified best practices. ' +
  'Respond only with JSON matching the schema.';

@Injectable()
export class ContentGenerationService {
  private readonly logger = new Logger(ContentGenerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MultiAiRouterService,
    private readonly strategy: StrategyService,
  ) {}

  /**
   * Turns the latest strategy's content plan into tracked ContentPiece rows.
   *
   * Nothing is written yet — this is the queue an agency reviews before any
   * page is drafted or committed.
   */
  async planFromStrategy(projectId: string) {
    const latest = await this.prisma.strategyReport.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    if (!latest) {
      throw new BadRequestException('Generate a strategy first — the content plan comes from it.');
    }

    const plan = (latest.content as any)?.contentPlan;
    if (!Array.isArray(plan) || plan.length === 0) {
      throw new BadRequestException('The latest strategy contains no content plan.');
    }

    const created = [];
    for (const item of plan) {
      if (!item?.title) continue;
      const slug = this.slugify(item.title);
      created.push(
        await this.prisma.contentPiece.upsert({
          where: { projectId_slug: { projectId, slug } },
          update: { format: item.format, targetQuery: item.targetQuery, rationale: item.why },
          create: {
            projectId,
            slug,
            title: item.title,
            format: item.format,
            targetQuery: item.targetQuery,
            rationale: item.why,
            status: ContentPieceStatus.PLANNED,
          },
        }),
      );
    }

    this.logger.log(`Planned ${created.length} content pieces for project ${projectId}.`);
    return created;
  }

  /**
   * Writes the actual page for one planned piece.
   *
   * The brief is built from the same evidence the strategy used, so the page is
   * about this business rather than generically about the topic.
   */
  async draft(pieceId: string, organizationId?: string) {
    const piece = await this.prisma.contentPiece.findUnique({ where: { id: pieceId } });
    if (!piece) throw new BadRequestException('Content piece not found');

    const evidence = await this.strategy.gatherEvidence(piece.projectId);

    const brief = [
      `# Brief`,
      `Business: ${evidence.business.projectName} (${evidence.business.domains.join(', ')})`,
      `Page to write: ${piece.title}`,
      piece.format ? `Format: ${piece.format}` : '',
      piece.targetQuery ? `Target query: ${piece.targetQuery}` : '',
      piece.rationale ? `Why this page: ${piece.rationale}` : '',
      '',
      `# What this business actually publishes today`,
      ...evidence.site.samplePages.slice(0, 8).map((p) => `- ${p.url} — "${p.title ?? 'untitled'}"`),
      '',
      evidence.aiVisibility.lostPrompts.length
        ? `# Questions competitors are winning\n${evidence.aiVisibility.lostPrompts
            .map((p) => `- "${p.prompt}" (cited instead: ${p.competitors.join(', ')})`)
            .join('\n')}`
        : '',
      '',
      'Write the page so it directly answers the target query for this business.',
    ]
      .filter(Boolean)
      .join('\n');

    const completion = await this.router.generate({
      prompt: brief,
      systemInstruction: SYSTEM_PROMPT,
      task: AiTask.REASONING,
      organizationId,
      jsonSchema: PAGE_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 16000,
    });

    if (completion.refused || !completion.text.trim()) {
      throw new ServiceUnavailableException('The model did not return a page. Please retry.');
    }

    const parsed = this.parseJson(completion.text);
    if (!parsed.body || !parsed.title) {
      throw new ServiceUnavailableException('The model returned an unusable page. Please retry.');
    }

    let finalBody = parsed.body;
    if (parsed.faqSchema && !finalBody.includes('application/ld+json')) {
      finalBody += `\n\n\`\`\`html\n<script type="application/ld+json">\n${parsed.faqSchema.trim()}\n</script>\n\`\`\`\n`;
    }

    return this.prisma.contentPiece.update({
      where: { id: pieceId },
      data: {
        title: parsed.title,
        metaDescription: parsed.metaDescription ?? null,
        slug: this.slugify(parsed.slug || parsed.title),
        body: finalBody,
        generatedByModel: completion.model,
        status: ContentPieceStatus.DRAFTED,
      },
    });
  }

  /** Creates a custom planned content piece directly from the UI. */
  async createCustomPiece(
    projectId: string,
    data: { title: string; targetQuery?: string; format?: string; rationale?: string },
  ) {
    if (!data.title?.trim()) {
      throw new BadRequestException('Title is required');
    }
    const slug = this.slugify(data.title);
    return this.prisma.contentPiece.upsert({
      where: { projectId_slug: { projectId, slug } },
      update: {
        format: data.format || 'Article',
        targetQuery: data.targetQuery,
        rationale: data.rationale,
      },
      create: {
        projectId,
        slug,
        title: data.title.trim(),
        format: data.format || 'Article',
        targetQuery: data.targetQuery?.trim() || null,
        rationale: data.rationale?.trim() || null,
        status: ContentPieceStatus.PLANNED,
      },
    });
  }

  /** Renders a drafted piece as the file that gets committed. */
  toMarkdownFile(piece: {
    title: string;
    metaDescription: string | null;
    body: string;
    targetQuery: string | null;
  }): string {
    const frontMatter = [
      '---',
      `title: ${JSON.stringify(piece.title)}`,
      `description: ${JSON.stringify(piece.metaDescription ?? '')}`,
      piece.targetQuery ? `keywords: ${JSON.stringify([piece.targetQuery])}` : '',
      `date: ${new Date().toISOString().slice(0, 10)}`,
      '---',
      '',
    ]
      .filter(Boolean)
      .join('\n');

    return `${frontMatter}${piece.body.trim()}\n`;
  }

  async list(projectId: string) {
    return this.prisma.contentPiece.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        format: true,
        targetQuery: true,
        status: true,
        filePath: true,
        generatedByModel: true,
        metaDescription: true,
        body: true,
        createdAt: true,
      },
    });
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80);
  }

  /** Reads the model's JSON answer, repairing truncation or naming the failure. */
  private parseJson(text: string): Record<string, any> {
    return parseModelJson(text, 'Content generation');
  }
}
