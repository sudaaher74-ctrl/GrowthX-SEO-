import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiProvider, AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { extractAndParseJson } from '../ai-engine/utils/json-extractor.util';
import { brandTerms, questionGroup } from '../ai-visibility/questions/question-group';
import { normalizeDomain } from '../ai-visibility/citation/citation-detector';
import { CompetitorSeoReportService, SideBySide } from './competitor-seo-report.service';
import { AdvantagePage, LONG_PAGE_WORDS, RivalAdvantages, computeAdvantages, dedupePages } from './rival-advantages';

/** Rivals read into one report; the rest are named as not included. */
export const MAX_RIVALS = 7;

/**
 * Comparison rows that measure what a site has. The report's other rows count
 * problems, and a rival's problems are not something the customer can act on.
 */
const STRENGTH_ROWS = new Set([
  'Indexable pages',
  'Service pages',
  'Location pages',
  'Articles and guides',
  'Pages with structured data',
]);

export interface ReportYou {
  name: string;
  domain: string;
  crawledAt: string | null;
  pagesCrawled: number | null;
}

export interface ReportRival {
  name: string;
  domain: string;
  crawledAt: string | null;
  pagesCrawled: number | null;
  /** Buyer questions to AI assistants whose answer named this rival. Null when none were asked. */
  aiMentions: number | null;
  googleRating: number | null;
  googleReviews: number | null;
  /** Their counts against yours, on things a site has. */
  comparison: SideBySide[];
  /** Null when either site has no completed crawl to compare. */
  advantages: RivalAdvantages | null;
  notes: string[];
}

export interface ReportFacts {
  you: ReportYou | null;
  /** Buyer questions asked to AI assistants, and how many named you. */
  aiAnswers: { asked: number; namedYou: number };
  rivals: ReportRival[];
  notIncluded: string[];
}

export type Priority = 'high' | 'medium' | 'low';

/** Something rivals have that you do not, and how to close it. */
export interface ReportGap {
  title: string;
  priority: Priority;
  /** The rivals that have it. */
  rivals: string[];
  evidence: string;
  whyItHelpsThemRank: string;
  howToBeatIt: string[];
  effort: 'low' | 'medium' | 'high';
}

export interface ReportAnalysis {
  executiveSummary: string;
  whyTheyRank: Array<{ competitor: string; threat: Priority; reasons: Array<{ factor: string; evidence: string }> }>;
  gaps: ReportGap[];
  whereYouLead: string[];
  plan: Array<{ week: string; actions: string[] }>;
  dataGaps: string[];
}

export interface CompetitorIntelReport {
  generatedAt: string;
  facts: ReportFacts;
  analysis: ReportAnalysis | null;
  /** The model that wrote the analysis, as the router reports it. */
  model: string | null;
  /** Why there is no analysis, when there is none. The facts are still usable. */
  analysisError: string | null;
  /** The stored copy of this report, when it could be saved. */
  snapshotId?: string | null;
}

const PRIORITIES: Priority[] = ['high', 'medium', 'low'];
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : []);
const priority = (v: unknown): Priority => {
  const p = str(v).toLowerCase();
  if (p === 'critical') return 'high';
  return (PRIORITIES as string[]).includes(p) ? (p as Priority) : 'medium';
};
const list = (v: unknown): any[] => (Array.isArray(v) ? v : []);

/**
 * Coerces whatever the model returned into the report's shape. A missing
 * field becomes empty rather than failing the whole report, and a priority
 * outside the known ones is read as medium.
 */
export function normaliseAnalysis(raw: unknown): ReportAnalysis {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const gaps = list(r.gaps).map((g): ReportGap => {
    const effort = str(g?.effort).toLowerCase();
    return {
      title: str(g?.title, 'Untitled gap'),
      priority: priority(g?.priority),
      rivals: strList(g?.rivals),
      evidence: str(g?.evidence),
      whyItHelpsThemRank: str(g?.whyItHelpsThemRank),
      howToBeatIt: strList(g?.howToBeatIt),
      effort: effort === 'low' || effort === 'high' ? effort : 'medium',
    };
  });
  gaps.sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority));

  return {
    executiveSummary: str(r.executiveSummary),
    whyTheyRank: list(r.whyTheyRank)
      .map((c) => ({
        competitor: str(c?.competitor),
        threat: priority(c?.threat),
        reasons: list(c?.reasons)
          .map((x) => ({ factor: str(x?.factor), evidence: str(x?.evidence) }))
          .filter((x) => x.factor),
      }))
      .filter((c) => c.competitor),
    gaps,
    whereYouLead: strList(r.whereYouLead),
    plan: list(r.plan).map((w, i) => ({ week: str(w?.week, `Week ${i + 1}`), actions: strList(w?.actions) })),
    dataGaps: strList(r.dataGaps),
  };
}

/**
 * The full competitor report: why each rival is likely to rank where you do
 * not, what their sites have that yours lacks, and a plan to close it,
 * written by Sarvam.
 *
 * Built from every part of Competitor Intelligence that measures a rival's
 * strengths: the topic gaps, page coverage, structured data, content depth,
 * AI answers and Google reviews. A rival's own site problems are left out on
 * purpose; the customer cannot fix them, and they say nothing about why that
 * rival is winning. The model is given the measured facts and told to use
 * nothing else, and the facts are returned alongside it so the report is
 * downloadable even when the analysis could not be made.
 */
@Injectable()
export class CompetitorIntelReportService {
  private readonly logger = new Logger(CompetitorIntelReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly seoReport: CompetitorSeoReportService,
    private readonly router: MultiAiRouterService,
  ) {}

  async gatherFacts(projectId: string): Promise<ReportFacts> {
    const [project, competitors] = await Promise.all([
      this.prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true, websites: { select: { id: true, domain: true }, take: 1 } },
      }),
      this.prisma.competitorDomain.findMany({
        where: { projectId },
        select: { id: true, domain: true, websiteId: true, localRating: true, localReviewCount: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    let you: ReportYou | null = null;
    let yourPages: AdvantagePage[] | null = null;
    const website = project?.websites[0];
    if (website) {
      const job = await this.latestCrawl(website.id);
      you = {
        name: project?.name ?? website.domain,
        domain: website.domain,
        crawledAt: job?.finishedAt?.toISOString() ?? null,
        pagesCrawled: job?.pagesCrawled ?? null,
      };
      yourPages = job ? await this.pagesOf(job.id) : null;
    }

    const mentions = await this.aiMentions(projectId, project?.name, website ? [website.domain] : []);

    const rivals: ReportRival[] = [];
    for (const c of competitors.slice(0, MAX_RIVALS)) {
      const r = await this.seoReport.report(projectId, c.id);
      const theirJob = c.websiteId ? await this.latestCrawl(c.websiteId) : null;
      const theirPages = theirJob ? await this.pagesOf(theirJob.id) : null;
      const hasReviews = (c.localReviewCount ?? 0) > 0;
      rivals.push({
        name: r.competitor.name,
        domain: r.competitor.domain,
        crawledAt: r.crawl.crawledAt,
        pagesCrawled: r.crawl.pagesCrawled,
        aiMentions: mentions.asked ? (mentions.byDomain.get(normalizeDomain(c.domain)) ?? 0) : null,
        googleRating: hasReviews ? (c.localRating ?? null) : null,
        googleReviews: hasReviews ? c.localReviewCount : null,
        comparison: r.comparison.filter((row) => STRENGTH_ROWS.has(row.label)),
        advantages: yourPages && theirPages ? computeAdvantages(yourPages, theirPages) : null,
        notes: r.notes,
      });
    }

    return {
      you,
      aiAnswers: { asked: mentions.asked, namedYou: mentions.namedYou },
      rivals,
      notIncluded: competitors.slice(MAX_RIVALS).map((c) => c.domain),
    };
  }

  private latestCrawl(websiteId: string) {
    return this.prisma.crawlJob.findFirst({
      where: { websiteId, status: 'COMPLETED' },
      orderBy: { finishedAt: 'desc' },
      select: { id: true, finishedAt: true, pagesCrawled: true },
    });
  }

  private async pagesOf(crawlJobId: string): Promise<AdvantagePage[]> {
    const pages = await this.prisma.page.findMany({
      where: { crawlJobId, statusCode: { gte: 200, lt: 300 } },
      select: {
        url: true,
        title: true,
        pageType: true,
        wordCount: true,
        h2: true,
        h3: true,
        schemas: { select: { schemaType: true } },
      },
    });
    return dedupePages(
      pages.map(({ schemas, ...p }) => ({ ...p, schemaTypes: schemas.map((s) => String(s.schemaType)) })),
    );
  }

  /**
   * How often AI assistants named each site when asked buyer questions, from
   * the latest answer of each assistant to each tracked question — the same
   * count the AI Answers tab shows.
   */
  private async aiMentions(projectId: string, projectName: string | null | undefined, domains: string[]) {
    const brand = brandTerms(projectName, domains.map(normalizeDomain));
    const prompts = await this.prisma.trackedPrompt.findMany({
      where: { projectId, isActive: true },
      select: {
        text: true,
        checks: {
          where: { error: null },
          orderBy: { checkedAt: 'desc' },
          take: 40,
          select: { assistant: true, cited: true, competitorsCited: true },
        },
      },
    });
    const byDomain = new Map<string, number>();
    let asked = 0;
    let namedYou = 0;
    for (const prompt of prompts) {
      if (questionGroup(prompt.text, brand) !== 'BUYER') continue;
      const seen = new Set<string>();
      for (const check of prompt.checks) {
        if (seen.has(check.assistant)) continue;
        seen.add(check.assistant);
        asked += 1;
        if (check.cited) namedYou += 1;
        for (const d of new Set(check.competitorsCited.map(normalizeDomain))) byDomain.set(d, (byDomain.get(d) ?? 0) + 1);
      }
    }
    return { asked, namedYou, byDomain };
  }

  async generate(projectId: string, organizationId?: string): Promise<CompetitorIntelReport> {
    const report = await this.write(projectId, organizationId);
    return { ...report, snapshotId: await this.store(projectId, report) };
  }

  /** The most recently generated report for a project, or null when none was ever made. */
  async latest(projectId: string): Promise<CompetitorIntelReport | null> {
    const row = await this.prisma.competitorReportSnapshot.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, report: true },
    });
    return row ? { ...(row.report as unknown as CompetitorIntelReport), snapshotId: row.id } : null;
  }

  /** Kept so the report can be read again; a failed save never loses the report itself. */
  private async store(projectId: string, report: CompetitorIntelReport): Promise<string | null> {
    try {
      const row = await this.prisma.competitorReportSnapshot.create({
        data: { projectId, report: report as any },
        select: { id: true },
      });
      return row.id;
    } catch (err) {
      this.logger.warn(`[${projectId}] competitor report could not be stored: ${(err as Error).message}`);
      return null;
    }
  }

  private async write(projectId: string, organizationId?: string): Promise<CompetitorIntelReport> {
    const facts = await this.gatherFacts(projectId);
    const base = { generatedAt: new Date().toISOString(), facts };

    try {
      const completion = await this.router.generate({
        prompt: buildPrompt(facts),
        systemInstruction:
          'You are a senior SEO strategist writing for a business owner. Explain why their competitors rank ' +
          'and what those competitors have that the business does not. Use only the facts given. ' +
          'Never invent rankings, traffic, revenue or numbers not in the facts. Reply with valid JSON only.',
        task: AiTask.COMPETITOR_ANALYSIS,
        provider: AiProvider.SARVAM,
        // The customer asked for Sarvam; a different vendor's analysis would
        // be presented under the wrong name.
        allowFallback: false,
        organizationId,
        projectId,
        maxTokens: 6000,
      });
      if (completion.refused || !completion.text.trim()) {
        return { ...base, analysis: null, model: completion.model, analysisError: 'Sarvam returned no analysis. Try again.' };
      }
      return {
        ...base,
        analysis: normaliseAnalysis(extractAndParseJson(completion.text)),
        model: completion.model,
        analysisError: null,
      };
    } catch (err) {
      this.logger.warn(`[${projectId}] competitor report analysis failed: ${(err as Error).message}`);
      return {
        ...base,
        analysis: null,
        model: null,
        analysisError: `The analysis could not be written: ${(err as Error).message}`.slice(0, 400),
      };
    }
  }
}

function advantagesBlock(a: RivalAdvantages): string {
  const topics = a.missingTopics.length
    ? a.missingTopics.map((t) => `    - "${t.title}" (${t.pageType.toLowerCase()}, ${t.wordCount} words) ${t.url}`).join('\n')
    : '    - none found';
  const types = a.pageTypes.length
    ? a.pageTypes.map((t) => `${t.label}: them ${t.them}, you ${t.you}`).join('; ')
    : 'you match or beat them on every kind of page';
  const schema = a.schema.length
    ? a.schema.map((s) => `${s.type}: them ${s.them} page(s), you ${s.you} (e.g. ${s.exampleUrl})`).join('; ')
    : 'nothing they use that you do not';
  const d = a.depth;
  const questions = a.questions.theirs.length ? a.questions.theirs.map((q) => `"${q}"`).join(', ') : 'none';
  return (
    `  topics they cover that you have no page for: ${a.missingTopicsTotal} (biggest first)\n${topics}\n` +
    `  topics you cover that they do not: ${a.yourUniqueTopicsTotal}\n` +
    `  kinds of page they have more of: ${types}\n` +
    `  structured data they use more than you: ${schema}\n` +
    `  content depth: median words per page them ${d.theirMedianWords ?? 'unknown'}, you ${d.yourMedianWords ?? 'unknown'}; ` +
    `pages of ${LONG_PAGE_WORDS}+ words them ${d.theirLongPages}, you ${d.yourLongPages}\n` +
    `  questions answered in headings: them ${a.questions.theirCount}, you ${a.questions.yourCount}; theirs include ${questions}`
  );
}

function rivalBlock(r: ReportRival, facts: ReportFacts): string {
  const cmp = r.comparison.map((c) => `${c.label}: them ${c.them ?? 'unknown'}, you ${c.you ?? 'unknown'}`).join('; ');
  const ai =
    r.aiMentions == null
      ? 'not measured (no buyer questions tracked)'
      : `named in ${r.aiMentions} of ${facts.aiAnswers.asked} AI answers (you: ${facts.aiAnswers.namedYou})`;
  const reviews = r.googleReviews == null ? 'not measured' : `${r.googleRating ?? '?'} stars from ${r.googleReviews} reviews`;
  return (
    `${r.name} (${r.domain})\n` +
    `  crawled: ${r.crawledAt ?? 'never'}; pages: ${r.pagesCrawled ?? 'unknown'}\n` +
    `  side by side: ${cmp || 'not measured'}\n` +
    `  AI assistants: ${ai}\n  Google reviews: ${reviews}\n` +
    (r.advantages ? advantagesBlock(r.advantages) : '  page-level comparison: not possible until both sites have a completed crawl') +
    (r.notes.length ? `\n  notes: ${r.notes.join(' ')}` : '')
  );
}

export function buildPrompt(facts: ReportFacts): string {
  const you = facts.you
    ? `${facts.you.name} (${facts.you.domain}); crawled: ${facts.you.crawledAt ?? 'never'}; pages: ${facts.you.pagesCrawled ?? 'unknown'}`
    : 'Not crawled yet.';
  const rivals = facts.rivals.map((r) => rivalBlock(r, facts)).join('\n\n');

  return `Write a competitor intelligence report on why these rivals rank and what they have that my site does not.

MY SITE
${you}

RIVALS
${rivals || 'No rivals tracked.'}
${facts.notIncluded.length ? `\nNot included in this report: ${facts.notIncluded.join(', ')}` : ''}

Return JSON exactly in this shape:
{
  "executiveSummary": "4-6 sentences: who is ahead of me, the main reasons they rank, and the single most important thing to build",
  "whyTheyRank": [
    { "competitor": "name", "threat": "high|medium|low", "reasons": [ { "factor": "what they have", "evidence": "the exact numbers and URLs from the facts" } ] }
  ],
  "gaps": [
    {
      "title": "what they have that I do not, e.g. a page topic, a kind of page, structured data, depth, reviews, AI presence",
      "priority": "high|medium|low",
      "rivals": ["names of the rivals that have it"],
      "evidence": "the exact numbers and example URLs from the facts",
      "whyItHelpsThemRank": "how this wins them searches or AI answers, in plain words",
      "howToBeatIt": ["step 1", "step 2", "step 3"],
      "effort": "low|medium|high"
    }
  ],
  "whereYouLead": ["what my site has that they do not, with numbers"],
  "plan": [ { "week": "Week 1", "actions": ["..."] } ],
  "dataGaps": ["what could not be measured and what would measure it"]
}

Rules:
- Focus on their strengths and my gaps. Do not list their technical SEO problems or mine.
- One whyTheyRank entry per rival that has been crawled, 2-5 reasons each, strongest first.
- Group the gaps across rivals: a topic or page type several rivals share is one gap naming all of them. Highest priority first.
- Name the specific missing topics and URLs to build pages for. Give 3-5 concrete steps per gap to match and then beat them.
- The plan is 4 weeks, highest impact first.
- These facts come from crawling the sites, not from search rankings. Say that actual rankings need Search Console or rank tracking, and list it in dataGaps.
- Use only the facts above. If something is "unknown", "never" or "not measured", say it is not measured instead of guessing.`;
}
