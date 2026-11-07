import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { parseModelJson } from '../ai-engine/utils/json-extractor.util';
import { MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { AiProvider, AiTask } from '../ai-search/multi-ai-router/multi-ai-router.types';
import {
  IDEA_INTENTS,
  IDEA_KINDS,
  IdeaIntent,
  IdeaKind,
  KeywordIdea,
  localTemplates,
  mergeIdeas,
  normalizeKeyword,
  oneOf,
} from './keyword-ideas';
import { ownSite } from './own-site';
import { resolveMarket } from './search-market';
import { SearchRankingsService } from './search-rankings.service';

export interface KeywordIdeasReport {
  /** The place the local keywords were written for, when there is one. */
  city: string | null;
  business: { industry: string | null; offerings: string[] };
  ideas: KeywordIdea[];
  /** GEMINI when a model wrote ideas; TEMPLATES_ONLY when only the built-in local phrases could be produced. */
  generatedBy: 'GEMINI' | 'TEMPLATES_ONLY';
  /** Why the model's ideas are missing, when they are. */
  notice: string | null;
  /** Always says search volume is not part of these ideas, so the screen never implies otherwise. */
  volumeNote: string;
  generatedAt: string;
}

const CACHE_MS = 6 * 60 * 60 * 1000;
const VOLUME_NOTE =
  'Search volume and difficulty are not shown: they need a keyword data provider, and these ideas are written from your site, not measured.';

const IDEAS_SCHEMA = {
  type: 'object',
  properties: {
    industry: { type: 'string', description: 'What the business sells, in a few words.' },
    city: { type: 'string', description: 'The main city or area the business serves, or an empty string if unclear.' },
    offerings: { type: 'array', items: { type: 'string' }, description: 'Up to six products or services, as a customer would name them.' },
    keywords: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          keyword: { type: 'string' },
          kind: { type: 'string', enum: [...IDEA_KINDS] },
          intent: { type: 'string', enum: [...IDEA_INTENTS] },
          reason: { type: 'string', description: 'One short line: who searches this and why.' },
        },
        required: ['keyword', 'kind', 'intent'],
      },
    },
  },
  required: ['keywords'],
} as const;

/**
 * Writes the searches this business's customers are likely to type, from the
 * site itself, and marks which are already tracked or already bring Google
 * traffic. Needs only Gemini (or any configured model): no paid keyword tool.
 */
@Injectable()
export class KeywordIdeasService {
  private readonly logger = new Logger(KeywordIdeasService.name);
  private readonly cache = new Map<string, { at: number; report: KeywordIdeasReport }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MultiAiRouterService,
    private readonly searchRankings: SearchRankingsService,
  ) {}

  async suggest(projectId: string, options: { city?: string; force?: boolean } = {}): Promise<KeywordIdeasReport> {
    const city = options.city?.trim().slice(0, 60) || null;
    const key = `${projectId}:${normalizeKeyword(city ?? '')}`;
    const hit = this.cache.get(key);
    if (!options.force && hit && Date.now() - hit.at < CACHE_MS) return this.withCurrentTracking(projectId, hit.report);

    const site = await ownSite(this.prisma, projectId);
    const [pages, project, tracked, search] = await Promise.all([
      site?.crawl
        ? this.prisma.page.findMany({
            where: { crawlJobId: site.crawl.id, statusCode: { lt: 400 } },
            orderBy: { url: 'asc' },
            take: 25,
            select: { url: true, title: true, metaDescription: true, h1: true, pageType: true },
          })
        : Promise.resolve([]),
      this.prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }),
      this.prisma.trackedKeyword.findMany({ where: { projectId, isActive: true }, select: { keyword: true } }),
      this.searchRankings.report(projectId, { days: 90, limit: 60 }).catch(() => null),
    ]);
    const market = await resolveMarket(this.prisma, projectId);
    const context = {
      trackedKeywords: tracked.map((t) => t.keyword),
      searchConsole: (search?.rows ?? []).map((r) => ({
        query: r.query,
        position: r.position,
        clicks: r.clicks,
        impressions: r.impressions,
      })),
    };

    let industry: string | null = null;
    let offerings: string[] = [];
    let usedCity = city;
    let modelIdeas: Array<{ keyword: string; kind: IdeaKind; intent: IdeaIntent; reason: string | null; source: 'GEMINI' }> = [];
    let notice: string | null = null;

    if (!site || pages.length === 0) {
      notice = 'Run a website audit first: the ideas are written from what your pages say.';
    } else {
      try {
        const prompt = this.prompt({
          domain: site.website.domain,
          name: project?.name ?? null,
          country: market.country,
          city,
          pages,
          alreadyRanking: context.searchConsole.slice(0, 25).map((r) => r.query),
        });
        const provider = this.router.configuredProviders().includes(AiProvider.GEMINI) ? AiProvider.GEMINI : undefined;
        const completion = await this.router.generate({
          prompt,
          provider,
          task: AiTask.SEO_RESEARCH,
          projectId,
          jsonSchema: IDEAS_SCHEMA as unknown as Record<string, unknown>,
          maxTokens: 4000,
          timeoutMs: 45_000,
        });
        const parsed = parseModelJson<{
          industry?: string;
          city?: string;
          offerings?: string[];
          keywords?: Array<{ keyword?: string; kind?: string; intent?: string; reason?: string }>;
        }>(completion.text, ' while writing keyword ideas');
        industry = parsed.industry?.trim() || null;
        offerings = (parsed.offerings ?? []).filter((o) => typeof o === 'string' && o.trim()).slice(0, 6);
        usedCity = city ?? (parsed.city?.trim() || null);
        modelIdeas = (parsed.keywords ?? [])
          .filter((k) => typeof k?.keyword === 'string')
          .map((k) => ({
            keyword: k.keyword as string,
            kind: oneOf(k.kind, IDEA_KINDS, 'product'),
            intent: oneOf(k.intent, IDEA_INTENTS, 'commercial'),
            reason: k.reason?.trim() || null,
            source: 'GEMINI' as const,
          }));
      } catch (error) {
        this.logger.warn(`Keyword ideas model call failed for ${projectId}: ${(error as Error)?.message}`);
        notice = 'The AI model could not write ideas just now, so only the built-in local phrases are shown. Try again in a minute.';
      }
    }

    const templates = localTemplates(offerings, usedCity).map((t) => ({ ...t, reason: null, source: 'TEMPLATE' as const }));
    const report: KeywordIdeasReport = {
      city: usedCity,
      business: { industry, offerings },
      ideas: mergeIdeas([modelIdeas, templates], context),
      generatedBy: modelIdeas.length > 0 ? 'GEMINI' : 'TEMPLATES_ONLY',
      notice,
      volumeNote: VOLUME_NOTE,
      generatedAt: new Date().toISOString(),
    };
    if (modelIdeas.length > 0) this.cache.set(key, { at: Date.now(), report });
    return report;
  }

  /** A cached list still needs today's tracked flags: keywords are added between visits. */
  private async withCurrentTracking(projectId: string, report: KeywordIdeasReport): Promise<KeywordIdeasReport> {
    const tracked = new Set(
      (await this.prisma.trackedKeyword.findMany({ where: { projectId, isActive: true }, select: { keyword: true } })).map((t) =>
        normalizeKeyword(t.keyword),
      ),
    );
    return { ...report, ideas: report.ideas.map((idea) => ({ ...idea, tracked: tracked.has(idea.keyword) })) };
  }

  private prompt(input: {
    domain: string;
    name: string | null;
    country: string;
    city: string | null;
    pages: Array<{ url: string; title: string | null; metaDescription: string | null; h1: string[]; pageType: string }>;
    alreadyRanking: string[];
  }): string {
    const pageLines = input.pages
      .map((p) => `- [${p.pageType}] ${p.url} | title: ${p.title ?? '-'} | h1: ${p.h1[0] ?? '-'} | ${(p.metaDescription ?? '').slice(0, 140)}`)
      .join('\n');
    return [
      'You are an SEO strategist. Work out what this business sells from its own pages, then list the Google searches its real customers type.',
      '',
      `Website: ${input.domain}${input.name ? ` (${input.name})` : ''}`,
      `Country: ${input.country}`,
      input.city ? `Target city/area: ${input.city}` : 'Target city/area: not given - infer it from the pages if the business is local, otherwise leave it empty.',
      '',
      'Pages read from the site:',
      pageLines,
      '',
      input.alreadyRanking.length
        ? `Searches the site already appears for (do not repeat these):\n${input.alreadyRanking.map((q) => `- ${q}`).join('\n')}`
        : 'The site has no Search Console history yet.',
      '',
      'Rules:',
      '- Give 40 to 60 keywords a real customer would type into Google: short, natural, lower case.',
      '- Cover: "near me" searches, "<product> in <city>" and "<product> delivery in <city>" for a local business, buying/price searches, comparison searches, and a few questions.',
      '- Only use the city given or clearly shown on the site. Never invent a location.',
      '- Do not include the brand name unless people search it.',
      '- Do not give search volumes, difficulty or any number. You do not know them.',
      '- kind is one of near_me, city, product, question, comparison. intent is one of local, transactional, commercial, informational.',
      '- reason is one short line on who searches it and why.',
    ].join('\n');
  }
}
