import { Injectable, Logger } from '@nestjs/common';
import { ResearchSourceType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AiVisibilityService } from '../ai-visibility/ai-visibility.service';
import { ModelRouterService, RetrievedWebSource } from './model-router.service';

/** A candidate source, before it is written to the run. */
export interface RetrievedSource {
  type: ResearchSourceType;
  url?: string;
  internalDocId?: string;
  title: string;
  publisher?: string;
  publishedAt?: Date;
  excerpt: string;
  /** 0-1, used to rank and to show the reader how much weight it carries. */
  qualityScore: number;
}

/** The client's own context, which is what public research gets joined to. */
export interface ClientContext {
  projectName: string;
  domains: string[];
  competitors: { domain: string; label: string | null }[];
  trackedPrompts: { text: string; cluster: string | null }[];
  visibility: {
    citationSharePct: number | null;
    byAssistant: { assistant: string; citationSharePct: number }[];
    shareOfVoice: { domain: string | null; label: string; sharePct: number }[];
    lostPrompts: { prompt: string; competitors: string[] }[];
  } | null;
}

const CRAWL_PAGE_LIMIT = 8;
const EMBED_BATCH = 64;

@Injectable()
export class EvidenceRetrievalService {
  private readonly logger = new Logger(EvidenceRetrievalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly models: ModelRouterService,
    private readonly visibility: AiVisibilityService,
  ) {}

  /**
   * Everything we know about this client, read only from rows that belong to
   * this project. Nothing here is defaulted or invented: a project with no
   * crawl and no prompts returns empty collections, and the pipeline says so
   * rather than filling the gap.
   */
  async loadClientContext(projectId: string): Promise<ClientContext | null> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        websites: { select: { domain: true } },
        competitors: { select: { domain: true, label: true } },
        prompts: { where: { isActive: true }, select: { text: true, cluster: true }, take: 40 },
      },
    });
    if (!project) return null;

    let visibility: ClientContext['visibility'] = null;
    if (project.prompts.length > 0) {
      try {
        const report = await this.visibility.getReport(projectId, 28);
        const losses = await this.prisma.promptCheck.findMany({
          where: {
            trackedPrompt: { projectId },
            cited: false,
            error: null,
            NOT: { competitorsCited: { isEmpty: true } },
          },
          select: { competitorsCited: true, trackedPrompt: { select: { text: true } } },
          orderBy: { checkedAt: 'desc' },
          take: 25,
        });

        const seen = new Set<string>();
        const lostPrompts: { prompt: string; competitors: string[] }[] = [];
        for (const loss of losses) {
          if (seen.has(loss.trackedPrompt.text)) continue;
          seen.add(loss.trackedPrompt.text);
          lostPrompts.push({ prompt: loss.trackedPrompt.text, competitors: loss.competitorsCited });
        }

        visibility = {
          citationSharePct: report.summary.citationSharePct,
          byAssistant: report.byAssistant.map((a) => ({
            assistant: a.assistant,
            citationSharePct: a.citationSharePct,
          })),
          shareOfVoice: report.shareOfVoice.map((s) => ({
            domain: s.domain,
            label: s.label,
            sharePct: s.sharePct,
          })),
          lostPrompts,
        };
      } catch (error) {
        // Visibility is context, not the answer. If it is unavailable the run
        // continues and the answer reports it as unmeasured.
        this.logger.warn(`Visibility unavailable for project ${projectId}: ${String(error)}`);
      }
    }

    return {
      projectName: project.name,
      domains: project.websites.map((w) => w.domain),
      competitors: project.competitors,
      trackedPrompts: project.prompts,
      visibility,
    };
  }

  /**
   * Turns the client's AI-visibility position into citable sources.
   *
   * These are first-class evidence: a claim about the client losing a prompt to
   * a competitor should cite the check that observed it, not a web page.
   */
  visibilitySources(context: ClientContext): RetrievedSource[] {
    if (!context.visibility) return [];
    const sources: RetrievedSource[] = [];
    const v = context.visibility;

    sources.push({
      type: ResearchSourceType.AI_VISIBILITY_CHECK,
      internalDocId: 'visibility:summary:28d',
      title: `AI visibility summary (last 28 days) for ${context.projectName}`,
      excerpt:
        `Blended citation share ${v.citationSharePct ?? 0}%. ` +
        `By assistant: ${v.byAssistant.map((a) => `${a.assistant} ${a.citationSharePct}%`).join(', ') || 'none measured'}. ` +
        `Share of voice: ${v.shareOfVoice.map((s) => `${s.domain ?? s.label} ${s.sharePct}%`).join(', ') || 'none measured'}.`,
      qualityScore: 0.95,
    });

    v.lostPrompts.slice(0, 8).forEach((lost, i) => {
      sources.push({
        type: ResearchSourceType.AI_VISIBILITY_CHECK,
        internalDocId: `visibility:lost:${i + 1}`,
        title: `Lost prompt: "${lost.prompt}"`,
        excerpt: `AI assistants answered "${lost.prompt}" citing ${lost.competitors.join(', ')} and did not cite ${context.domains.join(', ') || 'this client'}.`,
        qualityScore: 0.9,
      });
    });

    return sources;
  }

  /**
   * Semantic search across this project's crawled pages.
   *
   * The scan is deliberately restricted to one project's embeddings. Besides
   * being cheap at this corpus size, it means a cross-tenant match cannot occur
   * even if a caller passed the wrong id upstream — there is nothing else in
   * the candidate set to match against.
   */
  async searchClientPages(
    organizationId: string,
    projectId: string,
    query: string,
    limit = CRAWL_PAGE_LIMIT,
  ): Promise<RetrievedSource[]> {
    // Without an embedding model there is no vector search. Falling back to
    // lexical matching keeps the client's own pages available as evidence,
    // which matters more than the ranking being optimal — the alternative is
    // an answer with no client context at all.
    if (!this.models.supportsEmbeddings()) {
      return this.lexicalSearchClientPages(projectId, query, limit);
    }

    await this.indexProjectPages(organizationId, projectId);

    const rows = await this.prisma.researchEmbedding.findMany({
      where: { organizationId, projectId, kind: 'CRAWL_PAGE' },
      select: { refId: true, title: true, excerpt: true, vector: true },
    });
    if (rows.length === 0) return [];

    const { vectors } = await this.models.embed([query]);
    const queryVector = vectors[0];
    if (!queryVector) return [];

    return rows
      .map((row) => ({ row, score: cosine(queryVector, row.vector) }))
      .filter((r) => Number.isFinite(r.score))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ row, score }) => ({
        type: ResearchSourceType.CLIENT_WEBSITE,
        url: row.refId,
        internalDocId: row.refId,
        title: row.title,
        excerpt: row.excerpt,
        // Similarity is 0-1 here; keep it as the quality signal so the reader
        // can see how strong the match to their question was.
        qualityScore: Math.max(0, Math.min(1, score)),
      }));
  }

  /**
   * Term-overlap search over this project's crawled pages.
   *
   * Used when no embedding model is reachable. Scoring is deliberately simple:
   * rarer query terms count for more, and the score is normalised so it reads
   * on the same 0-1 scale as cosine similarity in the source drawer. It is
   * weaker than vector search, which is why the answer marks these sources with
   * their real match strength rather than implying a semantic match.
   */
  private async lexicalSearchClientPages(
    projectId: string,
    query: string,
    limit: number,
  ): Promise<RetrievedSource[]> {
    const websites = await this.prisma.website.findMany({
      where: { projectId },
      select: { id: true },
    });
    if (websites.length === 0) return [];

    const pages = await this.prisma.page.findMany({
      where: { crawlJob: { websiteId: { in: websites.map((w) => w.id) } } },
      select: { url: true, title: true, metaDescription: true, h1: true, h2: true },
      orderBy: { crawledAt: 'desc' },
      take: 300,
      distinct: ['url'],
    });
    if (pages.length === 0) return [];

    const terms = tokenize(query);
    if (terms.length === 0) return [];

    const documents = pages.map((page) => ({
      page,
      text: [page.title ?? '', page.metaDescription ?? '', page.h1.join(' '), page.h2.slice(0, 8).join(' ')]
        .join(' ')
        .toLowerCase(),
    }));

    // A term appearing on every page tells us nothing about which page matches.
    const documentFrequency = new Map<string, number>();
    for (const term of terms) {
      documentFrequency.set(term, documents.filter((d) => d.text.includes(term)).length || 1);
    }
    const maxScore = terms.reduce(
      (sum, term) => sum + Math.log(documents.length / documentFrequency.get(term)! + 1),
      0,
    );
    if (maxScore === 0) return [];

    return documents
      .map(({ page, text }) => {
        const score = terms.reduce(
          (sum, term) =>
            text.includes(term) ? sum + Math.log(documents.length / documentFrequency.get(term)! + 1) : sum,
          0,
        );
        return { page, score: score / maxScore };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ page, score }) => ({
        type: ResearchSourceType.CLIENT_WEBSITE,
        url: page.url,
        internalDocId: page.url,
        title: page.title ?? page.url,
        excerpt: [page.title, page.metaDescription].filter(Boolean).join(' — ').slice(0, 500),
        qualityScore: Math.max(0, Math.min(1, score)),
      }));
  }

  /**
   * Embeds any of this project's crawled pages that are not yet indexed.
   *
   * Incremental by design: re-running research on an unchanged site costs one
   * query rather than re-embedding the corpus.
   */
  async indexProjectPages(organizationId: string, projectId: string): Promise<number> {
    const websites = await this.prisma.website.findMany({
      where: { projectId },
      select: { id: true },
    });
    if (websites.length === 0) return 0;

    const pages = await this.prisma.page.findMany({
      where: { crawlJob: { websiteId: { in: websites.map((w) => w.id) } } },
      select: { url: true, title: true, metaDescription: true, h1: true, h2: true },
      orderBy: { crawledAt: 'desc' },
      take: 300,
      distinct: ['url'],
    });
    if (pages.length === 0) return 0;

    const existing = await this.prisma.researchEmbedding.findMany({
      where: { projectId, kind: 'CRAWL_PAGE' },
      select: { refId: true },
    });
    const indexed = new Set(existing.map((e) => e.refId));
    const missing = pages.filter((p) => !indexed.has(p.url));
    if (missing.length === 0) return 0;

    let written = 0;
    for (let i = 0; i < missing.length; i += EMBED_BATCH) {
      const batch = missing.slice(i, i + EMBED_BATCH);
      const texts = batch.map((p) =>
        [p.title ?? '', p.metaDescription ?? '', p.h1.join(' '), p.h2.slice(0, 8).join(' ')]
          .filter(Boolean)
          .join('\n')
          .slice(0, 2000),
      );

      const { vectors, model } = await this.models.embed(texts);

      for (let j = 0; j < batch.length; j++) {
        const page = batch[j];
        const vector = vectors[j];
        if (!vector) continue;
        await this.prisma.researchEmbedding.upsert({
          where: { projectId_kind_refId: { projectId, kind: 'CRAWL_PAGE', refId: page.url } },
          create: {
            organizationId,
            projectId,
            kind: 'CRAWL_PAGE',
            refId: page.url,
            title: page.title ?? page.url,
            excerpt: texts[j].slice(0, 500),
            vector,
            model,
          },
          update: { vector, model, excerpt: texts[j].slice(0, 500) },
        });
        written++;
      }
    }

    this.logger.log(`Indexed ${written} page(s) for project ${projectId}.`);
    return written;
  }

  /** Maps hosted-search annotations onto candidate sources. */
  webSources(retrieved: RetrievedWebSource[]): RetrievedSource[] {
    return retrieved.map((source) => ({
      type: ResearchSourceType.PUBLIC_WEB,
      url: source.url,
      title: source.title,
      publisher: safeHostname(source.url),
      excerpt: '',
      qualityScore: 0.6,
    }));
  }
}

/** Lowercased words of 3+ characters, deduplicated. */
export function tokenize(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 3),
    ),
  ];
}

/** Cosine similarity. Returns NaN for mismatched or empty vectors. */
export function cosine(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return Number.NaN;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return Number.NaN;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function safeHostname(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}
