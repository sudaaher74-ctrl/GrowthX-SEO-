import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  AgentKind,
  ContentPieceKind,
  ContentPieceStatus,
  Evidence,
  EvidenceSource,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { AgentRunService, RecordEvidenceInput } from '../agents/agent-run.service';

/** Context the caller supplies, beyond what we can read from the project. */
export interface ContentRequest {
  kind: ContentPieceKind;
  /** Subject for a post, FAQ set, or outline. */
  topic?: string;
  targetQuery?: string;
  /** SCHEMA_MARKUP: the crawled page to mark up. */
  pageUrl?: string;
  /** REVIEW_REPLY: the review being answered. */
  reviewText?: string;
  reviewRating?: number;
  reviewAuthor?: string;
  /** LANDING_PAGE_OUTLINE: the place the page targets. */
  location?: string;
}

/**
 * One output shape for every format. The body instruction differs per kind but
 * the envelope does not, which keeps parsing and the review UI uniform.
 */
const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Short internal label for this draft.' },
    metaDescription: { type: 'string', description: 'Only for page-like formats; otherwise an empty string.' },
    body: { type: 'string', description: 'The draft itself, following the format instruction given.' },
  },
  required: ['title', 'metaDescription', 'body'],
  additionalProperties: false,
} as const;

const BASE_SYSTEM_PROMPT =
  'You are drafting material for a real business that a human will review before ' +
  'anything is published. Use only facts present in the evidence supplied. Never ' +
  'invent statistics, prices, awards, opening hours, client names, certifications ' +
  'or testimonials. If a specific detail is missing, write around it or leave an ' +
  'explicit [CONFIRM: ...] placeholder for the reviewer. Respond only with JSON ' +
  'matching the schema.';

/** Per-format instruction for the `body` field. */
const FORMAT_INSTRUCTIONS: Record<ContentPieceKind, string> = {
  [ContentPieceKind.ARTICLE]:
    'Write the full page in Markdown using ## and ### headings, 800-1500 words. No H1 and no front matter.',
  [ContentPieceKind.BRIEF]:
    'Write a content brief in Markdown: target query, search intent, who it is for, the ' +
    'angle, an H2/H3 outline, internal links to use from the pages listed, and what ' +
    '"good" looks like. Do not write the article itself.',
  [ContentPieceKind.GBP_POST]:
    'Write a Google Business Profile post: under 1500 characters, plain text, no ' +
    'Markdown headings, warm and specific to this business, ending with one clear ' +
    'call to action on its own line.',
  [ContentPieceKind.FAQ]:
    'Propose 6-10 FAQs as Markdown: each question as a "### " heading with a 40-80 word ' +
    'answer beneath it. Favour questions the evidence shows people actually ask.',
  [ContentPieceKind.REVIEW_REPLY]:
    'Write a reply to the review, as the business owner. Under 350 characters, plain ' +
    'text, no headings. Thank the reviewer by name if given, address their specific ' +
    'point, and never dispute facts or offer compensation.',
  [ContentPieceKind.LANDING_PAGE_OUTLINE]:
    'Write a local landing page outline in Markdown: proposed H1, meta description, ' +
    'then an H2/H3 section outline with a one-line note under each on what it should ' +
    'cover and which local detail it needs. Do not write the page copy.',
  [ContentPieceKind.SCHEMA_MARKUP]:
    'Return ONLY a valid JSON-LD object as text — no Markdown fence, no commentary. ' +
    'It must start with { and use "@context": "https://schema.org". Include only ' +
    'properties evidenced by the page content supplied.',
};

@Injectable()
export class ContentAgentService {
  private readonly logger = new Logger(ContentAgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MultiAiRouterService,
    private readonly agentRuns: AgentRunService,
  ) {}

  /**
   * Drafts one piece of content, grounded in this project's own data.
   *
   * Everything lands in DRAFTED. There is no path from here to PUBLISHED —
   * approval is a separate, human action, because this agent writes copy that
   * goes out under the customer's name.
   */
  async generate(projectId: string, organizationId: string, request: ContentRequest) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { websites: { select: { id: true, domain: true } } },
    });
    if (!project) throw new NotFoundException('Project not found');

    const { grounding, evidenceInput } = await this.gather(projectId, project, request);

    return this.agentRuns.withRun(
      projectId,
      AgentKind.CONTENT,
      async (run) => {
        const evidence = await this.agentRuns.recordEvidence(run, evidenceInput);

        const completion = await this.router.generate({
          prompt: this.buildPrompt(project.name, project.websites.map((w) => w.domain), request, grounding),
          systemInstruction: `${BASE_SYSTEM_PROMPT}\n\nFormat: ${FORMAT_INSTRUCTIONS[request.kind]}`,
          task: AiTask.REASONING,
          organizationId,
          jsonSchema: OUTPUT_SCHEMA as unknown as Record<string, unknown>,
          maxTokens: 8000,
        });

        if (completion.refused || !completion.text.trim()) {
          throw new ServiceUnavailableException('The model did not return a draft. Please retry.');
        }

        const parsed = this.parseJson(completion.text);
        if (!parsed.body?.trim() || !parsed.title?.trim()) {
          throw new ServiceUnavailableException('The model returned an unusable draft. Please retry.');
        }

        const body = this.validateBody(request.kind, parsed.body);

        const piece = await this.prisma.contentPiece.create({
          data: {
            projectId,
            kind: request.kind,
            status: ContentPieceStatus.DRAFTED,
            title: parsed.title.trim(),
            slug: await this.uniqueSlug(projectId, parsed.title),
            format: request.kind,
            targetQuery: request.targetQuery ?? null,
            rationale: grounding.rationale,
            metaDescription: parsed.metaDescription?.trim() || null,
            body,
            generatedByModel: completion.model,
            sourceEvidenceId: evidence.id,
          },
        });

        this.logger.log(`Drafted ${request.kind} for project ${projectId} (piece ${piece.id}).`);
        return { result: piece, model: completion.model };
      },
      { kind: request.kind, targetQuery: request.targetQuery ?? null },
    );
  }

  /**
   * Collects the real project data each format needs, and the single evidence
   * record the draft will be traceable to.
   */
  private async gather(
    projectId: string,
    project: { name: string; websites: { id: string; domain: string }[] },
    request: ContentRequest,
  ): Promise<{ grounding: { text: string; rationale: string }; evidenceInput: RecordEvidenceInput }> {
    const websiteIds = project.websites.map((w) => w.id);

    // A review reply is grounded in the review itself, which the agency pastes
    // in until the Business Profile connection is live.
    if (request.kind === ContentPieceKind.REVIEW_REPLY) {
      if (!request.reviewText?.trim()) {
        throw new BadRequestException('reviewText is required to draft a review reply.');
      }
      const rating = request.reviewRating != null ? `${request.reviewRating}-star` : 'unrated';
      return {
        grounding: {
          text:
            `# Review to answer\nRating: ${rating}\n` +
            `Author: ${request.reviewAuthor ?? 'anonymous'}\n\n"${request.reviewText.trim()}"`,
          rationale: `Reply to a ${rating} review`,
        },
        evidenceInput: {
          source: EvidenceSource.GBP_REVIEW,
          reference: `review:${request.reviewAuthor ?? 'anonymous'}`,
          observedAt: new Date(),
          summary: `${rating} review: "${request.reviewText.trim().slice(0, 120)}"`,
          payload: {
            reviewText: request.reviewText,
            rating: request.reviewRating ?? null,
            author: request.reviewAuthor ?? null,
          },
        },
      };
    }

    // Schema markup must describe a page we actually crawled, otherwise it
    // would assert properties about a page nobody has read.
    if (request.kind === ContentPieceKind.SCHEMA_MARKUP) {
      if (!request.pageUrl?.trim()) {
        throw new BadRequestException('pageUrl is required to generate schema markup.');
      }
      const page = await this.prisma.page.findFirst({
        where: { url: request.pageUrl.trim(), crawlJob: { websiteId: { in: websiteIds } } },
        orderBy: { crawledAt: 'desc' },
        select: { url: true, title: true, metaDescription: true, h1: true, h2: true, wordCount: true, crawledAt: true },
      });
      if (!page) {
        throw new BadRequestException(
          'That URL has not been crawled for this project. Crawl it first so the markup describes real content.',
        );
      }
      return {
        grounding: {
          text:
            `# Page to mark up\nURL: ${page.url}\nTitle: ${page.title ?? '(none)'}\n` +
            `Meta description: ${page.metaDescription ?? '(none)'}\n` +
            `H1: ${page.h1.join(' | ') || '(none)'}\nH2: ${page.h2.slice(0, 10).join(' | ') || '(none)'}\n` +
            `Word count: ${page.wordCount}`,
          rationale: `Schema markup for ${page.url}`,
        },
        evidenceInput: {
          source: EvidenceSource.CRAWL_PAGE,
          reference: page.url,
          observedAt: page.crawledAt,
          summary: `${page.url} — "${page.title ?? 'untitled'}" (${page.wordCount} words).`,
          payload: { url: page.url, title: page.title, h1: page.h1, h2: page.h2.slice(0, 10) },
        },
      };
    }

    // Everything else is grounded in what this business already publishes, plus
    // the local listing when there is one.
    const [pages, location] = await Promise.all([
      this.prisma.page.findMany({
        where: { crawlJob: { websiteId: { in: websiteIds } } },
        select: { url: true, title: true },
        orderBy: { crawledAt: 'desc' },
        take: 12,
      }),
      this.prisma.localLocation.findUnique({ where: { projectId } }),
    ]);

    if (pages.length === 0) {
      throw new BadRequestException(
        'Run a crawl before drafting content — without site data the draft would be generic.',
      );
    }

    const text = [
      `# What this business publishes today`,
      ...pages.map((p) => `- ${p.url} — "${p.title ?? 'untitled'}"`),
      location ? `\n# Local listing\n${location.businessName} — ${location.address}` : '',
      request.topic ? `\n# Topic\n${request.topic}` : '',
      request.targetQuery ? `\n# Target query\n${request.targetQuery}` : '',
      request.location ? `\n# Target location\n${request.location}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      grounding: {
        text,
        rationale: request.topic ?? request.targetQuery ?? `${request.kind} draft`,
      },
      evidenceInput: {
        source: EvidenceSource.CRAWL_PAGE,
        reference: `project:${projectId}:recent-pages`,
        observedAt: new Date(),
        summary: `Drafted from ${pages.length} recently crawled page(s)${location ? ' and the connected local listing' : ''}.`,
        payload: { pages: pages.map((p) => p.url), hasLocalListing: Boolean(location) },
      },
    };
  }

  private buildPrompt(
    projectName: string,
    domains: string[],
    request: ContentRequest,
    grounding: { text: string },
  ): string {
    return [
      `# Business\n${projectName} (${domains.join(', ') || 'no domain recorded'})`,
      grounding.text,
      `# Task\nProduce a ${request.kind.replace(/_/g, ' ').toLowerCase()} for this business, following the format instruction exactly.`,
    ].join('\n\n');
  }

  /**
   * Schema markup is the one format whose output has to parse. Storing invalid
   * JSON-LD would hand a reviewer something that silently does nothing on the
   * page, so it is rejected here rather than at paste time.
   */
  private validateBody(kind: ContentPieceKind, body: string): string {
    if (kind !== ContentPieceKind.SCHEMA_MARKUP) return body.trim();

    const unfenced = body.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    try {
      const parsed = JSON.parse(unfenced);
      if (!parsed || typeof parsed !== 'object' || !parsed['@context']) {
        throw new Error('missing @context');
      }
      return JSON.stringify(parsed, null, 2);
    } catch {
      throw new ServiceUnavailableException(
        'The model returned schema markup that is not valid JSON-LD. Please retry.',
      );
    }
  }

  /**
   * The review gate. A draft only leaves DRAFTED because a person moved it.
   *
   * Approval is deliberately not something the agent can do to its own output:
   * this material goes out under the customer's name, on their listing or their
   * site, so the last step before publication is a human one.
   */
  async review(pieceId: string, decision: 'APPROVE' | 'REJECT') {
    const piece = await this.prisma.contentPiece.findUnique({ where: { id: pieceId } });
    if (!piece) throw new NotFoundException('Content piece not found');
    if (piece.status !== ContentPieceStatus.DRAFTED) {
      throw new BadRequestException(`Only a DRAFTED piece can be reviewed; this one is ${piece.status}.`);
    }

    return this.prisma.contentPiece.update({
      where: { id: pieceId },
      data: {
        status: decision === 'APPROVE' ? ContentPieceStatus.COMMITTED : ContentPieceStatus.REJECTED,
      },
    });
  }

  /** Drafts waiting on a human, oldest first. */
  async pendingReview(projectId: string) {
    return this.prisma.contentPiece.findMany({
      where: { projectId, status: ContentPieceStatus.DRAFTED },
      orderBy: { createdAt: 'asc' },
      include: { sourceEvidence: true },
    });
  }

  /** ContentPiece is unique on (projectId, slug), so collisions get a suffix. */
  private async uniqueSlug(projectId: string, title: string): Promise<string> {
    const base =
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60) || 'draft';

    for (let attempt = 0; attempt < 25; attempt++) {
      const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
      const existing = await this.prisma.contentPiece.findUnique({
        where: { projectId_slug: { projectId, slug } },
        select: { id: true },
      });
      if (!existing) return slug;
    }
    return `${base}-${Date.now().toString(36)}`;
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
