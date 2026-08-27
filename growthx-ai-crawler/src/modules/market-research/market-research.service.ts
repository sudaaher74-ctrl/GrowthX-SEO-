import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  MarketActionStatus,
  MarketActionType,
  ResearchConfidence,
  ResearchIntent,
  ResearchMessageRole,
  ResearchRunStatus,
  ResearchSourceType,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { EvidenceRetrievalService, RetrievedSource } from './evidence-retrieval.service';
import { ModelRole, ModelRouterService, ModelUsage } from './model-router.service';
import { validateCitations } from './citation-validator';
import { parseModelJson } from '../ai-engine/utils/json-extractor.util';
import {
  ANSWER_INSTRUCTIONS,
  ANSWER_SCHEMA,
  CLASSIFY_INSTRUCTIONS,
  CLASSIFY_SCHEMA,
} from './research-schema';

export interface AskOptions {
  organizationId: string;
  projectId: string;
  threadId?: string;
  question: string;
  deepResearch?: boolean;
}

const LEVEL: Record<string, ResearchConfidence> = {
  high: ResearchConfidence.HIGH,
  medium: ResearchConfidence.MEDIUM,
  low: ResearchConfidence.LOW,
};

/** Only these action types are accepted; anything else the model invents is dropped. */
const ACTION_TYPES: Record<string, MarketActionType> = {
  CONTENT_BRIEF: MarketActionType.CONTENT_BRIEF,
  PAGE_REFRESH: MarketActionType.PAGE_REFRESH,
  TECHNICAL_TASK: MarketActionType.TECHNICAL_TASK,
  TRACK_PROMPT: MarketActionType.TRACK_PROMPT,
  COMPETITOR_WATCH: MarketActionType.COMPETITOR_WATCH,
  OUTREACH_OPPORTUNITY: MarketActionType.OUTREACH_OPPORTUNITY,
};

const CONFIDENCE: Record<string, ResearchConfidence> = {
  high: ResearchConfidence.HIGH,
  medium: ResearchConfidence.MEDIUM,
  low: ResearchConfidence.LOW,
};

@Injectable()
export class MarketResearchService {
  private readonly logger = new Logger(MarketResearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly models: ModelRouterService,
    private readonly evidence: EvidenceRetrievalService,
  ) {}

  /**
   * Opening questions written around what this client actually sells.
   *
   * The four prompts on this page were fixed strings — "our core topic", "this
   * market" — identical for a fruit pulp exporter and a dentist, and useful to
   * neither. The crawl already knows the subject, so the questions can name it.
   *
   * Derived rather than generated: no model is called, because a page that
   * spends tokens before the operator has asked anything is a page nobody wants
   * to open. Falls back to the generic set when a project has not been crawled
   * yet, so the panel is never empty.
   */
  async suggestedQuestions(organizationId: string, projectId: string): Promise<string[]> {
    const generic = [
      'What changed in this market this week?',
      'Which competitors are winning AI citations for our core topic?',
      'What content should we create to close the biggest visibility gap?',
      'How is our positioning different from our top competitors?',
    ];

    try {
      await this.assertProjectInOrg(organizationId, projectId);

      const [project, recentPages, competitors] = await Promise.all([
        this.prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }),
        // Narrowed below to the shortest URL, which on any site is the
        // homepage — its title and meta describe the business as a whole
        // rather than one product.
        this.prisma.page.findMany({
          where: { crawlJob: { website: { projectId } }, statusCode: 200, title: { not: null } },
          orderBy: { crawledAt: 'desc' },
          select: { url: true, title: true, metaDescription: true },
          take: 50,
        }),
        this.prisma.competitorDomain.findMany({ where: { projectId }, select: { domain: true }, take: 1 }),
      ]);

      const homepage = [...recentPages].sort((a, b) => a.url.length - b.url.length)[0];
      const subject = this.subjectFrom(homepage?.title, homepage?.metaDescription, project?.name);
      if (!subject) return generic;

      const rival = competitors[0]?.domain;
      return [
        `What changed for ${subject} buyers this week?`,
        rival
          ? `Which competitors are winning AI citations for ${subject}, and where does ${rival} rank?`
          : `Which competitors are winning AI citations for ${subject}?`,
        `What content should we create to close our biggest visibility gap in ${subject}?`,
        `How is our positioning in ${subject} different from our top competitors?`,
      ];
    } catch {
      // Suggestions are decoration. Nothing here is worth failing the page for.
      return generic;
    }
  }

  /**
   * The business, in a few words, taken from how the site describes itself.
   *
   * A title is typically "<what it does> | <brand>" or "<brand> - <what it
   * does>", so the brand half is dropped and the descriptive half kept. The
   * meta description is the fallback because it is prose rather than a label,
   * and a truncated clause reads worse than a slightly generic question.
   */
  private subjectFrom(title?: string | null, meta?: string | null, projectName?: string | null): string | null {
    const brand = (projectName ?? '').trim().toLowerCase();

    const fromTitle = (title ?? '')
      .split(/[|–—]|\s-\s/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 8 && (!brand || !part.toLowerCase().includes(brand)))
      .sort((a, b) => b.length - a.length)[0];

    const candidate = fromTitle ?? (meta ?? '').split(/[.!?]/)[0]?.trim();
    if (!candidate || candidate.length < 8) return null;

    // Long enough to be specific, short enough to read inside a question.
    return candidate.length > 70 ? `${candidate.slice(0, 70).trimEnd()}…` : candidate;
  }

  // ── tenancy ───────────────────────────────────────────────────────────────

  /**
   * Confirms the project belongs to the organization on the request.
   *
   * Called at the top of every entry point. The guard chain already resolved
   * the organization from the caller's membership, so this closes the last gap:
   * a valid member of org A passing a project id from org B.
   */
  private async assertProjectInOrg(organizationId: string, projectId: string): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found in this organization.');
    }
  }

  /** Loads a thread, refusing any that belongs to a different tenant. */
  private async assertThread(organizationId: string, projectId: string, threadId: string) {
    const thread = await this.prisma.marketResearchThread.findFirst({
      where: { id: threadId, organizationId, projectId },
    });
    if (!thread) {
      throw new NotFoundException('Research thread not found for this project.');
    }
    return thread;
  }

  // ── threads ───────────────────────────────────────────────────────────────

  async listThreads(organizationId: string, projectId: string) {
    await this.assertProjectInOrg(organizationId, projectId);
    return this.prisma.marketResearchThread.findMany({
      where: { organizationId, projectId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
  }

  async createThread(organizationId: string, projectId: string, title: string) {
    await this.assertProjectInOrg(organizationId, projectId);
    return this.prisma.marketResearchThread.create({
      data: { organizationId, projectId, title: title.slice(0, 200) || 'New research' },
    });
  }

  async getThread(organizationId: string, projectId: string, threadId: string) {
    await this.assertProjectInOrg(organizationId, projectId);
    await this.assertThread(organizationId, projectId, threadId);

    return this.prisma.marketResearchThread.findFirst({
      where: { id: threadId, organizationId, projectId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        runs: {
          orderBy: { startedAt: 'asc' },
          include: { sources: { orderBy: { sourceKey: 'asc' } } },
        },
      },
    });
  }

  async getRunSources(organizationId: string, projectId: string, runId: string) {
    await this.assertProjectInOrg(organizationId, projectId);
    const run = await this.prisma.marketResearchRun.findFirst({
      where: { id: runId, organizationId, projectId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException('Research run not found for this project.');

    return this.prisma.researchSource.findMany({
      where: { runId, organizationId, projectId },
      orderBy: { sourceKey: 'asc' },
    });
  }

  // ── the research flow ─────────────────────────────────────────────────────

  /**
   * Runs the pipeline: classify, plan, retrieve, answer, validate, persist.
   *
   * The order matters. Sources are written before the answer is validated so a
   * failed or partly-valid run still leaves an auditable record of exactly what
   * was retrieved and what the model did with it.
   */
  async ask(options: AskOptions) {
    const { organizationId, projectId } = options;

    // Validated here rather than only in the DTO. A route whose body was
    // stripped — a global ValidationPipe with `whitelist: true` removes every
    // property of a DTO that carries no class-validator decorator — used to
    // arrive with `question` undefined and crash on the first `.slice()`,
    // which the customer saw as a bare "Internal server error". A missing
    // question is a bad request, and it is one wherever the call came from:
    // the scheduler and the smoke script reach this method without a pipe.
    const question = typeof options.question === 'string' ? options.question.trim() : '';
    if (!question) {
      throw new BadRequestException('A question is required to run market research.');
    }

    await this.assertProjectInOrg(organizationId, projectId);

    const thread = options.threadId
      ? await this.assertThread(organizationId, projectId, options.threadId)
      : await this.prisma.marketResearchThread.create({
          data: { organizationId, projectId, title: question.slice(0, 120) },
        });

    const run = await this.prisma.marketResearchRun.create({
      data: {
        threadId: thread.id,
        organizationId,
        projectId,
        question,
        deepResearch: Boolean(options.deepResearch),
        status: ResearchRunStatus.RUNNING,
      },
    });

    await this.prisma.marketResearchMessage.create({
      data: {
        threadId: thread.id,
        organizationId,
        projectId,
        role: ResearchMessageRole.USER,
        content: question,
      },
    });

    const usage: ModelUsage[] = [];

    try {
      // 1. Classify and plan.
      const classification = await this.classify(question, usage);

      // 2. Retrieve. Client context first — it is what makes the answer about
      //    this business rather than the category in general.
      const context = await this.evidence.loadClientContext(projectId);
      if (!context) throw new NotFoundException('Project not found.');

      const clientSources = await this.evidence.searchClientPages(
        organizationId,
        projectId,
        classification.clientDataQuery || question,
      );
      const visibilitySources = this.evidence.visibilitySources(context);

      // 3. Public web. The hosted search reports which URLs it actually read;
      //    only those become citable.
      const web = await this.models.generate({
        step: 'web-research',
        role: options.deepResearch ? ModelRole.DEEP : ModelRole.ANALYST,
        instructions:
          'Research the question using web search. Summarise what you found, ' +
          'attributing each point to the page it came from. Do not speculate.',
        input: [
          `Question: ${question}`,
          `Searches to run: ${classification.searchQueries.join(' | ')}`,
          `Client: ${context.projectName} (${context.domains.join(', ') || 'no domain on file'})`,
        ].join('\n'),
        webSearch: true,
        maxOutputTokens: options.deepResearch ? 6000 : 4000,
      });
      usage.push(web.usage);

      // When web search cannot run, the answer must say so rather than quietly
      // presenting a client-data-only answer as if the market had been checked.
      const retrievalGaps: string[] = [];
      if (web.webSearchUnavailable) retrievalGaps.push(web.webSearchUnavailable);
      if (!this.models.supportsEmbeddings()) {
        retrievalGaps.push(
          'No embedding model is configured, so client pages were matched by keyword rather than meaning.',
        );
      }

      const webSources = this.evidence.webSources(web.webSources);

      // 4. Assemble the citable set and persist it before answering.
      const allSources = [...webSources, ...clientSources, ...visibilitySources];
      const stored = await this.persistSources(run.id, organizationId, projectId, allSources);
      const validKeys = new Set(stored.map((s) => s.sourceKey));

      // 5. Answer, or report honestly that we cannot.
      if (stored.length === 0) {
        // Say which of the two things actually happened. A project with a
        // finished crawl that still retrieves nothing has a linkage problem,
        // not a missing crawl, and telling them to crawl again wastes their
        // time on the wrong fix.
        const crawledPages = await this.evidence.countClientPages(projectId);
        return this.finishWithNoEvidence(
          run.id,
          thread.id,
          organizationId,
          projectId,
          usage,
          retrievalGaps,
          crawledPages,
        );
      }

      const answerResult = await this.models.generate({
        step: 'answer',
        role: options.deepResearch ? ModelRole.DEEP : ModelRole.ANALYST,
        instructions: ANSWER_INSTRUCTIONS,
        input: this.buildAnswerInput(question, context, stored, web.text),
        jsonSchema: { name: ANSWER_SCHEMA.name, schema: ANSWER_SCHEMA.schema as Record<string, unknown> },
        maxOutputTokens: options.deepResearch ? 6000 : 4000,
      });
      usage.push(answerResult.usage);

      const parsed = parseJson(answerResult.text);

      // 6. Enforce the citation rules independently of the model.
      const validation = validateCitations(parsed, validKeys);
      if (validation.invalidCitations.length > 0) {
        this.logger.warn(
          `Run ${run.id} cited ${validation.invalidCitations.length} source(s) that were not retrieved: ${validation.invalidCitations.join(', ')}`,
        );
      }

      const answer = {
        summary: String(parsed.summary ?? ''),
        confidence: normaliseConfidence(parsed.confidence, validation.verifiedClaims.length),
        verifiedClaims: validation.verifiedClaims,
        inferences: validation.inferences,
        citationGaps: Array.isArray(parsed.citationGaps) ? parsed.citationGaps : [],
        recommendedActions: validation.recommendedActions,
        evidenceGaps: [
          ...(Array.isArray(parsed.evidenceGaps) ? parsed.evidenceGaps.map(String) : []),
          ...validation.warnings,
          ...retrievalGaps,
        ],
      };

      await this.persistClaims(run.id, organizationId, projectId, answer, stored);
      await this.persistOpportunitiesAndActions(run.id, organizationId, projectId, answer);

      const totals = sumUsage(usage);
      await this.prisma.marketResearchRun.update({
        where: { id: run.id },
        data: {
          status: ResearchRunStatus.SUCCEEDED,
          intent: classification.intent,
          plan: classification as unknown as object,
          answer: answer as unknown as object,
          confidence: CONFIDENCE[answer.confidence] ?? ResearchConfidence.LOW,
          modelUsage: usage as unknown as object,
          inputTokens: totals.inputTokens,
          outputTokens: totals.outputTokens,
          finishedAt: new Date(),
        },
      });

      await this.prisma.marketResearchMessage.create({
        data: {
          threadId: thread.id,
          organizationId,
          projectId,
          role: ResearchMessageRole.ASSISTANT,
          content: answer.summary,
          runId: run.id,
        },
      });

      await this.prisma.marketResearchThread.update({
        where: { id: thread.id },
        data: { updatedAt: new Date() },
      });

      return { threadId: thread.id, runId: run.id, answer, sources: stored };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Bookkeeping must not swallow the real failure. If the database is the
      // thing that broke, this update throws too, and rethrowing *its* error
      // would report a connection fault where the customer needs to see the
      // model or retrieval failure that actually stopped the run.
      try {
        await this.prisma.marketResearchRun.update({
          where: { id: run.id },
          data: { status: ResearchRunStatus.FAILED, error: message.slice(0, 2000), finishedAt: new Date() },
        });
      } catch (bookkeeping) {
        this.logger.error(`Could not mark run ${run.id} failed: ${String(bookkeeping)}`);
      }

      this.logger.warn(`Research run ${run.id} failed: ${message}`);

      // An HttpException already carries a message the UI can show. Anything
      // else would reach the browser as Nest's generic "Internal server error",
      // which tells the customer nothing and tells us nothing either.
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(`Market research failed: ${message}`);
    }
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private async classify(question: string, usage: ModelUsage[]) {
    const result = await this.models.generate({
      step: 'classify',
      role: ModelRole.WORKER,
      instructions: CLASSIFY_INSTRUCTIONS,
      input: question,
      jsonSchema: { name: CLASSIFY_SCHEMA.name, schema: CLASSIFY_SCHEMA.schema as Record<string, unknown> },
      maxOutputTokens: 1000,
    });
    usage.push(result.usage);

    const parsed = parseJson(result.text);
    const intent = (parsed.intent as ResearchIntent) ?? ResearchIntent.MARKET_TREND;
    return {
      intent: Object.values(ResearchIntent).includes(intent) ? intent : ResearchIntent.MARKET_TREND,
      searchQueries: Array.isArray(parsed.searchQueries) ? parsed.searchQueries.map(String).slice(0, 4) : [question],
      clientDataQuery: typeof parsed.clientDataQuery === 'string' ? parsed.clientDataQuery : question,
    };
  }

  private async persistSources(
    runId: string,
    organizationId: string,
    projectId: string,
    sources: RetrievedSource[],
  ) {
    const seen = new Set<string>();
    const rows: {
      runId: string;
      organizationId: string;
      projectId: string;
      sourceKey: string;
      type: ResearchSourceType;
      url: string | null;
      internalDocId: string | null;
      title: string;
      publisher: string | null;
      publishedAt: Date | null;
      excerpt: string;
      qualityScore: number;
    }[] = [];

    for (const source of sources) {
      // Dedupe on the identity of the thing, so the same page arriving from web
      // search and from the client's own crawl is one citable source.
      const identity = source.url ?? source.internalDocId ?? source.title;
      if (seen.has(identity)) continue;
      seen.add(identity);

      rows.push({
        runId,
        organizationId,
        projectId,
        sourceKey: `source_${rows.length + 1}`,
        type: source.type,
        url: source.url ?? null,
        internalDocId: source.internalDocId ?? null,
        title: source.title.slice(0, 400),
        publisher: source.publisher ?? null,
        publishedAt: source.publishedAt ?? null,
        excerpt: source.excerpt.slice(0, 2000),
        qualityScore: source.qualityScore,
      });
    }

    if (rows.length === 0) return [];
    await this.prisma.researchSource.createMany({ data: rows });

    return this.prisma.researchSource.findMany({
      where: { runId, organizationId, projectId },
      orderBy: { sourceKey: 'asc' },
    });
  }

  private async persistClaims(
    runId: string,
    organizationId: string,
    projectId: string,
    answer: {
      verifiedClaims: { claim: string; citationIds: string[] }[];
      inferences: { statement: string; reasoning: string; citationIds: string[] }[];
    },
    sources: { id: string; sourceKey: string }[],
  ) {
    const idByKey = new Map(sources.map((s) => [s.sourceKey, s.id]));

    for (const claim of answer.verifiedClaims) {
      await this.prisma.researchClaim.create({
        data: {
          runId,
          organizationId,
          projectId,
          kind: 'VERIFIED',
          text: claim.claim,
          citations: {
            connect: claim.citationIds
              .map((key) => idByKey.get(key))
              .filter((id): id is string => Boolean(id))
              .map((id) => ({ id })),
          },
        },
      });
    }

    for (const inference of answer.inferences) {
      await this.prisma.researchClaim.create({
        data: {
          runId,
          organizationId,
          projectId,
          kind: 'INFERENCE',
          text: inference.statement,
          reasoning: inference.reasoning,
          citations: {
            connect: inference.citationIds
              .map((key) => idByKey.get(key))
              .filter((id): id is string => Boolean(id))
              .map((id) => ({ id })),
          },
        },
      });
    }
  }


  /**
   * Turns the validated answer into reviewable work.
   *
   * Only actions that survived citation validation reach this point, so every
   * row here is evidence-backed by construction. They are written as PROPOSED:
   * this is a queue for a human, never an instruction to act.
   */
  private async persistOpportunitiesAndActions(
    runId: string,
    organizationId: string,
    projectId: string,
    answer: {
      citationGaps: any[];
      recommendedActions: { type: string; title: string; description: string; expectedImpact: string; confidence: string }[];
    },
  ) {
    for (const gap of answer.citationGaps ?? []) {
      if (!gap?.topic || !gap?.gap) continue;
      await this.prisma.marketOpportunity.create({
        data: {
          runId,
          organizationId,
          projectId,
          topic: String(gap.topic),
          gap: String(gap.gap),
          competitorsWinning: Array.isArray(gap.competitorsWinning) ? gap.competitorsWinning.map(String) : [],
          recommendedResponse: String(gap.recommendedResponse ?? ''),
          impact: LEVEL[String(gap.impact).toLowerCase()] ?? ResearchConfidence.MEDIUM,
          effort: LEVEL[String(gap.effort).toLowerCase()] ?? ResearchConfidence.MEDIUM,
        },
      });
    }

    for (const action of answer.recommendedActions ?? []) {
      const type = ACTION_TYPES[action.type];
      if (!type) continue;

      // The model can return an action with a type but no title. Passing that
      // straight to Prisma throws on a required column and loses the whole
      // answer at the last step, after every token has been spent. An action
      // nobody can read is not worth queueing, so it is dropped instead.
      const title = String(action.title ?? '').trim();
      if (!title) {
        this.logger.warn(`Run ${runId}: dropped a ${type} action with no title.`);
        continue;
      }

      await this.prisma.marketAction.create({
        data: {
          organizationId,
          projectId,
          runId,
          type,
          title,
          description: String(action.description ?? ''),
          expectedImpact: action.expectedImpact ? String(action.expectedImpact) : null,
          confidence: LEVEL[String(action.confidence).toLowerCase()] ?? ResearchConfidence.MEDIUM,
          status: MarketActionStatus.PROPOSED,
          requiresApproval: true,
        },
      });
    }
  }

  /**
   * The honest empty state. Retrieval found nothing, so the run succeeds with
   * an explicit "no reliable evidence" rather than letting the model answer
   * from memory.
   */
  private async finishWithNoEvidence(
    runId: string,
    threadId: string,
    organizationId: string,
    projectId: string,
    usage: ModelUsage[],
    retrievalGaps: string[] = [],
    crawledPages = 0,
  ) {
    const summary =
      crawledPages > 0
        ? 'No reliable evidence found. No usable sources were retrieved for this question, ' +
          `even though this project has ${crawledPages} crawled page(s) — they could not be reached ` +
          'for this run.'
        : 'No reliable evidence found. No usable sources were retrieved for this question, ' +
          'and this project has no crawled pages or AI-visibility history to draw on yet.';

    const answer = {
      summary,
      confidence: 'low' as const,
      verifiedClaims: [],
      inferences: [],
      citationGaps: [],
      recommendedActions: [],
      evidenceGaps: [
        'No sources were retrieved for this question.',
        crawledPages > 0
          ? `This project has ${crawledPages} crawled page(s) that were not used. Check that the ` +
            'crawled site is linked to this project, then track prompts so AI-visibility history ' +
            'can be used as evidence too.'
          : 'Crawl the client site and track prompts so future research can use their own data.',
        ...retrievalGaps,
      ],
    };

    const totals = sumUsage(usage);
    await this.prisma.marketResearchRun.update({
      where: { id: runId },
      data: {
        status: ResearchRunStatus.SUCCEEDED,
        answer: answer as unknown as object,
        confidence: ResearchConfidence.LOW,
        modelUsage: usage as unknown as object,
        inputTokens: totals.inputTokens,
        outputTokens: totals.outputTokens,
        finishedAt: new Date(),
      },
    });

    await this.prisma.marketResearchMessage.create({
      data: {
        threadId,
        organizationId,
        projectId,
        role: ResearchMessageRole.ASSISTANT,
        content: answer.summary,
        runId,
      },
    });

    return { threadId, runId, answer, sources: [] };
  }

  private buildAnswerInput(
    question: string,
    context: { projectName: string; domains: string[]; competitors: { domain: string; label: string | null }[]; trackedPrompts: { text: string; cluster: string | null }[]; visibility: unknown },
    sources: { sourceKey: string; type: string; title: string; url: string | null; excerpt: string; publisher: string | null }[],
    webSummary: string,
  ): string {
    const sourceBlock = sources
      .map(
        (s) =>
          `[${s.sourceKey}] (${s.type}) ${s.title}\n` +
          `    ${s.url ?? 'internal record'}${s.publisher ? ` — ${s.publisher}` : ''}\n` +
          (s.excerpt ? `    "${s.excerpt.slice(0, 400)}"` : '    (no excerpt captured)'),
      )
      .join('\n');

    return [
      `# Question\n${question}`,
      `# Client\n${context.projectName} (${context.domains.join(', ') || 'no domain on file'})`,
      `# Tracked competitors\n${context.competitors.map((c) => c.label ?? c.domain).join(', ') || '(none)'}`,
      `# Tracked prompts\n${context.trackedPrompts.map((p) => `- ${p.text}`).join('\n') || '(none)'}`,
      `# AI visibility position\n${JSON.stringify(context.visibility ?? 'not measured')}`,
      `# Web research notes\n${webSummary || '(none)'}`,
      `# SOURCES — you may cite only these ids\n${sourceBlock}`,
    ].join('\n\n');
  }
}

function sumUsage(usage: ModelUsage[]) {
  return usage.reduce(
    (acc, u) => ({
      inputTokens: acc.inputTokens + u.inputTokens,
      outputTokens: acc.outputTokens + u.outputTokens,
    }),
    { inputTokens: 0, outputTokens: 0 },
  );
}

/**
 * Confidence is capped by the evidence that survived validation. A model
 * claiming "high" after every one of its citations was stripped would be
 * reporting confidence in nothing.
 */
function normaliseConfidence(raw: unknown, verifiedCount: number): 'high' | 'medium' | 'low' {
  const stated = String(raw).toLowerCase();
  const value: 'high' | 'medium' | 'low' =
    stated === 'high' || stated === 'medium' || stated === 'low' ? stated : 'low';
  if (verifiedCount === 0) return 'low';
  if (value === 'high' && verifiedCount < 2) return 'medium';
  return value;
}

export function parseJson(text: string): Record<string, unknown> {
  return parseModelJson<Record<string, unknown>>(text, 'Market research');
}
