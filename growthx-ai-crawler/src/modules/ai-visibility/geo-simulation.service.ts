import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { AiAssistant } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { extractAndParseJson } from '../ai-engine/utils/json-extractor.util';
import { detectCitation, normalizeDomain, CompetitorRef } from './citation/citation-detector';
import { ASSISTANT_PROVIDER } from './assistants';

export type GeoEngine = 'PERPLEXITY' | 'CHATGPT' | 'GEMINI' | 'CLAUDE' | 'SARVAM';

const ALL_ENGINES: readonly GeoEngine[] = ['SARVAM', 'CHATGPT', 'CLAUDE', 'GEMINI', 'PERPLEXITY'];

export interface GeoEngineResult {
  engine: GeoEngine;
  /** The model that actually answered. Null when the engine was not asked. */
  model: string | null;
  /**
   * Why this engine has no answer — no API, no key on this deployment, or the
   * call failed. Set means every measurement below is empty, never a guess.
   */
  error: string | null;
  cited: boolean;
  position: number | null;
  citedUrl: string | null;
  competitorsCited: string[];
  answerExcerpt: string | null;
  latencyMs: number;
}

export interface GeoDisplacementPatch {
  id: string;
  targetTitle: string;
  targetUrl: string;
  reasoning: string;
  displacementContent: string;
  faqSchema: string;
  category: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  /** The model that drafted the content. */
  draftedBy: string;
}

export interface GeoSimulationResult {
  query: string;
  domain: string;
  brandName: string;
  /** Engines that actually answered. Rates below are over these only. */
  enginesAnswered: number;
  /** Null when no engine answered: there is nothing to take a rate of. */
  overallCitationRate: number | null;
  overallShareOfVoice: number | null;
  engines: GeoEngineResult[];
  /** Null when no engine answered or the draft could not be written. */
  displacementPatch: GeoDisplacementPatch | null;
}

export interface SimulateGeoOptions {
  query: string;
  engines?: GeoEngine[];
  location?: string;
}

const EXCERPT_LIMIT = 600;

/** Asked of every engine alike: the answer a real person would get. */
const PLAIN_QUESTION_INSTRUCTION =
  'Answer as you normally would for a member of the public. Where you recommend specific companies or products, name them and link them.';

@Injectable()
export class GeoSimulationService {
  private readonly logger = new Logger(GeoSimulationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MultiAiRouterService,
  ) {}

  /**
   * Asks each requested engine the query live and measures whether the
   * customer is cited.
   *
   * Each engine is answered only by its own vendor. An engine with no API, or
   * whose key is not configured, comes back with `error` set — never with an
   * answer written on its behalf.
   */
  async simulateQuery(
    organizationId: string,
    projectId: string,
    options: SimulateGeoOptions,
  ): Promise<GeoSimulationResult> {
    const query = options.query?.trim();
    if (!query) {
      throw new BadRequestException('A search query is required for GEO simulation.');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        websites: { select: { domain: true, url: true } },
        competitors: { select: { domain: true, label: true } },
      },
    });

    if (!project) throw new NotFoundException('Project not found');

    const primaryWebsite = project.websites[0];
    const domain = primaryWebsite ? normalizeDomain(primaryWebsite.domain) : '';
    if (!domain) {
      throw new BadRequestException(
        'Add a website to this project before running a GEO simulation — without a domain there is nothing to look for in the answers.',
      );
    }
    const baseOrigin = primaryWebsite?.url || `https://${domain}`;
    const domainLabel = domain.split('.')[0].replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const brandName = project.name?.trim() || domainLabel;

    const ownDomains = [domain];
    const ownBrandNames = [...new Set([brandName, domainLabel, domainLabel.replace(/\s+/g, '')])];

    // Only the rivals the customer actually tracks. An empty list means share
    // of voice has nothing to compare against, which is reported as such.
    const competitors: CompetitorRef[] = (project.competitors || []).map((c) => ({
      domain: normalizeDomain(c.domain),
      names: c.label ? [c.label] : undefined,
    }));

    const requestedEngines = options.engines?.length ? options.engines : this.measurableEngines();

    this.logger.log(`Running GEO simulation for "${query}" on ${domain} across ${requestedEngines.join(', ')}`);

    const engines = await Promise.all(
      requestedEngines.map((engine) =>
        this.evaluateEngine(engine, query, organizationId, ownDomains, ownBrandNames, competitors, options.location),
      ),
    );

    const answered = engines.filter((e) => !e.error);
    const citedCount = answered.filter((e) => e.cited).length;
    const overallCitationRate = answered.length > 0 ? Math.round((citedCount / answered.length) * 100) : null;

    const competitorMentions = answered.reduce((acc, e) => acc + e.competitorsCited.length, 0);
    const totalMentions = citedCount + competitorMentions;
    const overallShareOfVoice =
      answered.length === 0 ? null : totalMentions > 0 ? Math.round((citedCount / totalMentions) * 100) : 0;

    const displacementPatch =
      answered.length > 0
        ? await this.draftPatch({ query, brandName, domain, baseOrigin, answered, organizationId, citedCount })
        : null;

    return {
      query,
      domain,
      brandName,
      enginesAnswered: answered.length,
      overallCitationRate,
      overallShareOfVoice,
      engines,
      displacementPatch,
    };
  }

  /** Engines this deployment can actually ask, in display order. */
  measurableEngines(): GeoEngine[] {
    const configured = this.router.configuredProviders?.();
    return ALL_ENGINES.filter((engine) => {
      const provider = ASSISTANT_PROVIDER[engine as AiAssistant];
      return provider && (!configured || configured.includes(provider));
    });
  }

  private async evaluateEngine(
    engine: GeoEngine,
    query: string,
    organizationId: string,
    ownDomains: string[],
    ownBrandNames: string[],
    competitors: CompetitorRef[],
    location?: string,
  ): Promise<GeoEngineResult> {
    const startTime = Date.now();
    const unanswered = (error: string): GeoEngineResult => ({
      engine,
      model: null,
      error,
      cited: false,
      position: null,
      citedUrl: null,
      competitorsCited: [],
      answerExcerpt: null,
      latencyMs: Date.now() - startTime,
    });

    const provider = ASSISTANT_PROVIDER[engine as AiAssistant];
    if (!provider) {
      return unanswered('No public API is available for this engine, so it cannot be asked directly.');
    }
    const configured = this.router.configuredProviders?.();
    if (configured && !configured.includes(provider)) {
      return unanswered(`${engine} is not enabled on this deployment.`);
    }

    const locationPrompt = location ? ` The person asking is in ${location}.` : '';

    try {
      // Pinned to the engine's own vendor: if it cannot answer, the router
      // throws rather than handing the question to someone else.
      const completion = await this.router.generate({
        prompt: query,
        systemInstruction: PLAIN_QUESTION_INSTRUCTION + locationPrompt,
        task: AiTask.REASONING,
        provider,
        organizationId,
      });

      if (completion.refused || !completion.text?.trim()) {
        return { ...unanswered('The engine declined to answer.'), model: completion.model };
      }

      const detection = detectCitation({ answer: completion.text, ownDomains, ownBrandNames, competitors });

      return {
        engine,
        model: completion.model,
        error: null,
        cited: detection.cited,
        position: detection.position,
        citedUrl: detection.citedUrl,
        competitorsCited: detection.competitorsCited,
        answerExcerpt: completion.text.slice(0, EXCERPT_LIMIT),
        latencyMs: Date.now() - startTime,
      };
    } catch (err: any) {
      this.logger.warn(`GEO simulation: ${engine} could not be asked: ${err.message}`);
      return unanswered(`Could not reach ${engine}: ${String(err.message).slice(0, 200)}`);
    }
  }

  /**
   * A draft page section for this query, written by the model from what the
   * engines actually said.
   *
   * The model is told not to invent facts about the customer; where a claim
   * needs a real proof point it leaves a bracketed placeholder for the
   * customer to fill in. Null when the draft cannot be written.
   */
  private async draftPatch(params: {
    query: string;
    brandName: string;
    domain: string;
    baseOrigin: string;
    answered: GeoEngineResult[];
    organizationId: string;
    citedCount: number;
  }): Promise<GeoDisplacementPatch | null> {
    const { query, brandName, domain, baseOrigin, answered, organizationId, citedCount } = params;
    const rivals = [...new Set(answered.flatMap((e) => e.competitorsCited))];
    const evidence = answered
      .map((e) => `${e.engine} (${e.cited ? `cited ${brandName}` : `did not cite ${brandName}`}): ${e.answerExcerpt ?? ''}`)
      .join('\n\n');

    try {
      const completion = await this.router.generate({
        task: AiTask.REASONING,
        organizationId,
        systemInstruction:
          'You write website copy that helps a business get cited by AI assistants. ' +
          'Never invent facts about the business: no statistics, percentages, prices, customer counts, awards, ' +
          'certifications or guarantees. Where a claim needs a real proof point, write a bracketed placeholder ' +
          'such as [add a customer result] for the business to fill in. Return only JSON.',
        prompt:
          `Business: ${brandName} (${domain})\n` +
          `Search query: "${query}"\n` +
          `Competitors the AI answers named: ${rivals.length ? rivals.join(', ') : 'none'}\n\n` +
          `What the AI assistants answered:\n${evidence}\n\n` +
          'Draft a page section for the business that directly answers this query. Return JSON with: ' +
          '"targetTitle" (page title), "reasoning" (one or two sentences on why the answers above did or did not cite the business, based only on the answers), ' +
          '"displacementContent" (a 80-150 word answer-first section), and "faq" (2-3 objects with "question" and "answer").',
        jsonSchema: {
          type: 'object',
          properties: {
            targetTitle: { type: 'string' },
            reasoning: { type: 'string' },
            displacementContent: { type: 'string' },
            faq: {
              type: 'array',
              items: {
                type: 'object',
                properties: { question: { type: 'string' }, answer: { type: 'string' } },
                required: ['question', 'answer'],
              },
            },
          },
          required: ['targetTitle', 'reasoning', 'displacementContent', 'faq'],
        },
      });

      const draft = extractAndParseJson<{
        targetTitle?: string;
        reasoning?: string;
        displacementContent?: string;
        faq?: { question?: string; answer?: string }[];
      }>(completion.text);
      if (!draft?.displacementContent?.trim()) return null;

      const faq = (draft.faq ?? []).filter((f) => f?.question?.trim() && f?.answer?.trim());
      const faqSchema = JSON.stringify(
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faq.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer },
          })),
        },
        null,
        2,
      );

      const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

      return {
        id: `geo-patch-${Date.now().toString(36)}`,
        targetTitle: draft.targetTitle?.trim() || query,
        targetUrl: `${baseOrigin.replace(/\/$/, '')}/${slug}`,
        reasoning: draft.reasoning?.trim() || '',
        displacementContent: draft.displacementContent.trim(),
        faqSchema,
        category: 'AI_SEARCH',
        priority: citedCount === 0 ? 'CRITICAL' : citedCount < answered.length ? 'HIGH' : 'MEDIUM',
        draftedBy: completion.model,
      };
    } catch (err: any) {
      this.logger.warn(`GEO simulation: could not draft content for "${query}": ${err.message}`);
      return null;
    }
  }
}
