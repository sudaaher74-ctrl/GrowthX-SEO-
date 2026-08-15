import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ContentPieceStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { StrategyService } from '../strategy/strategy.service';

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
        'The full page in Markdown. Use ## and ### headings. 800-1500 words. No front matter, no H1 — the title becomes the H1.',
    },
  },
  required: ['title', 'metaDescription', 'slug', 'body'],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT =
  'You are writing a page that will be published on a client\'s live website. ' +
  'Write for their actual customers, in their domain, using only facts evidenced ' +
  'by the brief. Never invent statistics, prices, awards, client names, or ' +
  'testimonials. If you would need a specific number you do not have, write ' +
  'around it. Respond only with JSON matching the schema.';

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
    let latest = await this.prisma.strategyReport.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    if (!latest) {
      latest = await this.strategy.generateDefaultStrategy(projectId);
    }
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

    return this.prisma.contentPiece.update({
      where: { id: pieceId },
      data: {
        title: parsed.title,
        metaDescription: parsed.metaDescription ?? null,
        slug: this.slugify(parsed.slug || parsed.title),
        body: parsed.body,
        generatedByModel: completion.model,
        status: ContentPieceStatus.DRAFTED,
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

  private parseJson(text: string): Record<string, any> {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      return {};
    }
  }
}
