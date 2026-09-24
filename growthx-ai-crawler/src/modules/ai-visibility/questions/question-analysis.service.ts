import { Injectable, NotFoundException } from '@nestjs/common';
import { AiAssistant } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { MultiAiRouterService } from '../../ai-search/multi-ai-router/multi-ai-router.service';
import { measurableAssistantsFor } from '../assistants';
import { normalizeDomain } from '../citation/citation-detector';
import { CandidatePage, PageSignals, bestPage, pageSignals } from './page-signals';
import { QuestionGroup, brandTerms, questionGroup } from './question-group';
import { QuestionSuggestion, suggestQuestions } from './question-suggestions';

/** What was measured for one question: the latest answer, or why there is none. */
export interface QuestionAnswer {
  assistant: AiAssistant;
  model: string | null;
  checkedAt: Date;
  cited: boolean;
  position: number | null;
  competitorsCited: string[];
  answerExcerpt: string | null;
}

export interface OwnPageMatch {
  url: string;
  title: string | null;
  /** 0..1, how well the page's title, headings and URL cover the question. */
  matchScore: number;
  signals: PageSignals;
  /** Open issues the latest audit found on this page. */
  issues: Array<{ issueType: string; severity: string; description: string }>;
}

export interface RivalEvidence {
  domain: string;
  label: string;
  /** False when the rival's site has not been crawled, so there is no page to compare. */
  crawled: boolean;
  page: { url: string; title: string | null; matchScore: number; signals: PageSignals } | null;
}

/** One signal where the rival's page and the customer's differ. */
export interface SignalComparison {
  signal: 'DIRECT_ANSWER' | 'FAQ' | 'SCHEMA' | 'TERM_COVERAGE';
  label: string;
  you: string;
  rival: string;
  rivalDomain: string;
  /** True when the rival's page has what the customer's lacks. */
  rivalAhead: boolean;
}

/** NOT_APPLICABLE: a reputation question, which the brand's name answers, not a page. */
export type PageVerdict = 'CONTENT_GAP' | 'PAGE_HAS_ISSUES' | 'PAGE_FOUND' | 'NOT_APPLICABLE';
export type AnswerOutcome = 'NOT_MEASURED' | 'FAILED' | 'CITED' | 'NOT_CITED';

export interface QuestionAnalysis {
  id: string;
  text: string;
  cluster: string | null;
  group: QuestionGroup;
  outcome: AnswerOutcome;
  answer: QuestionAnswer | null;
  failure: string | null;
  verdict: PageVerdict;
  ownPage: OwnPageMatch | null;
  rivals: RivalEvidence[];
  comparison: SignalComparison[];
}

export interface QuestionAnalysisReport {
  projectId: string;
  /** False when the customer's site has never finished an audit crawl. */
  auditAvailable: boolean;
  auditedPages: number;
  competitorsTracked: number;
  competitorsCrawled: number;
  questions: QuestionAnalysis[];
}

const PAGE_FIELDS = {
  id: true,
  url: true,
  title: true,
  metaDescription: true,
  h1: true,
  h2: true,
  h3: true,
  pageType: true,
  wordCount: true,
} as const;

const MAX_OWN_PAGES = 2000;
const MAX_RIVAL_PAGES = 500;
const MAX_QUESTIONS = 50;

/**
 * Joins AI Visibility to the Website Audit and Competitor Intelligence.
 *
 * For every tracked question: whether the latest answer cited the customer,
 * which of the customer's pages should answer it (and what the audit found
 * wrong with that page), and — when the answer named a rival — the rival's
 * page, compared on the signals an answer engine can actually read.
 *
 * Every field comes from a stored crawl or a stored answer. When a crawl is
 * missing the result says so rather than filling the gap.
 */
@Injectable()
export class QuestionAnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MultiAiRouterService,
  ) {}

  async analyze(projectId: string): Promise<QuestionAnalysisReport> {
    const ctx = await this.loadContext(projectId);

    const prompts = await this.prisma.trackedPrompt.findMany({
      where: { projectId, isActive: true },
      include: { checks: { orderBy: { checkedAt: 'desc' }, take: 40 } },
      orderBy: { createdAt: 'asc' },
      take: MAX_QUESTIONS,
    });
    const measurable = new Set(measurableAssistantsFor(this.router));

    // Choose pages first, then load the heavy HTML only for the chosen ones.
    const drafts = prompts.map((prompt) => {
      // A real answer counts whichever assistant gave it; only a failure from
      // an assistant this deployment no longer asks is stale. Same rule as the
      // report, so the two never disagree about what was measured.
      const success = prompt.checks.find((c) => !c.error) ?? null;
      const failure = success ? null : (prompt.checks.find((c) => c.error && measurable.has(c.assistant)) ?? null);
      const group = questionGroup(prompt.text, ctx.brand);
      // A reputation question is answered by the brand's name, not by a page:
      // matching it would pick whichever page has the brand in its title.
      const own = group === 'BUYER' ? bestPage(prompt.text, ctx.ownPages) : null;
      const rivalDomains = success ? success.competitorsCited : [];
      const rivals = rivalDomains.map((domain) => {
        const competitor = ctx.competitors.find((c) => c.domain === normalizeDomain(domain));
        const pages = competitor ? (ctx.rivalPages.get(competitor.id) ?? null) : null;
        return {
          domain,
          label: competitor?.label ?? domain,
          crawled: Boolean(pages && pages.length > 0),
          match: pages ? bestPage(prompt.text, pages) : null,
        };
      });
      return { prompt, group, success, failure, own, rivals };
    });

    const pageIds = new Set<string>();
    for (const d of drafts) {
      if (d.own) pageIds.add(d.own.page.id);
      for (const r of d.rivals) if (r.match) pageIds.add(r.match.page.id);
    }
    const detail = await this.pageDetail([...pageIds]);
    const issues = await this.issuesFor(ctx.ownCrawlIds, drafts.flatMap((d) => (d.own ? [d.own.page] : [])));

    const questions: QuestionAnalysis[] = drafts.map(({ prompt, group, success, failure, own, rivals }) => {
      const signalsFor = (page: CandidatePage) => {
        const extra = detail.get(page.id);
        return pageSignals(prompt.text, page, extra?.html ?? null, extra?.schemaTypes ?? []);
      };

      const ownPage: OwnPageMatch | null = own
        ? {
            url: own.page.url,
            title: own.page.title,
            matchScore: Math.round(own.score * 100) / 100,
            signals: signalsFor(own.page),
            issues: issues.get(own.page.id) ?? [],
          }
        : null;

      const rivalEvidence: RivalEvidence[] = rivals.map((r) => ({
        domain: r.domain,
        label: r.label,
        crawled: r.crawled,
        page: r.match
          ? {
              url: r.match.page.url,
              title: r.match.page.title,
              matchScore: Math.round(r.match.score * 100) / 100,
              signals: signalsFor(r.match.page),
            }
          : null,
      }));

      return {
        id: prompt.id,
        text: prompt.text,
        cluster: prompt.cluster,
        group,
        outcome: success ? (success.cited ? 'CITED' : 'NOT_CITED') : failure ? 'FAILED' : 'NOT_MEASURED',
        answer: success
          ? {
              assistant: success.assistant,
              model: success.model,
              checkedAt: success.checkedAt,
              cited: success.cited,
              position: success.position,
              competitorsCited: success.competitorsCited,
              answerExcerpt: success.answerExcerpt,
            }
          : null,
        failure: failure?.error ?? null,
        verdict:
          group === 'REPUTATION'
            ? 'NOT_APPLICABLE'
            : !ownPage
              ? 'CONTENT_GAP'
              : ownPage.issues.length > 0
                ? 'PAGE_HAS_ISSUES'
                : 'PAGE_FOUND',
        ownPage,
        rivals: rivalEvidence,
        comparison: compareSignals(ownPage?.signals ?? null, rivalEvidence),
      };
    });

    return {
      projectId,
      auditAvailable: ctx.ownCrawlIds.length > 0,
      auditedPages: ctx.ownPages.length,
      competitorsTracked: ctx.competitors.length,
      competitorsCrawled: [...ctx.rivalPages.values()].filter((p) => p.length > 0).length,
      questions,
    };
  }

  /** Buyer questions drawn from the customer's own pages, rivals' pages and open content gaps. */
  async suggestions(projectId: string): Promise<{
    suggestions: QuestionSuggestion[];
    basedOn: { ownPages: number; rivalPages: number; contentGaps: number };
  }> {
    const ctx = await this.loadContext(projectId);
    const [tracked, gaps] = await Promise.all([
      this.prisma.trackedPrompt.findMany({ where: { projectId }, select: { text: true } }),
      this.prisma.contentGap.findMany({
        where: { projectId, status: 'OPEN' },
        select: { title: true, relatedKeywords: true },
        orderBy: { opportunityScore: 'desc' },
        take: 20,
      }),
    ]);

    const rivalPages = ctx.competitors.flatMap((c) =>
      (ctx.rivalPages.get(c.id) ?? []).map((p) => ({ ...p, competitorDomain: c.domain })),
    );

    return {
      suggestions: suggestQuestions({
        ownPages: ctx.ownPages,
        rivalPages,
        contentGaps: gaps,
        brand: ctx.brand,
        city: ctx.city,
        alreadyTracked: tracked.map((t) => t.text),
      }),
      basedOn: { ownPages: ctx.ownPages.length, rivalPages: rivalPages.length, contentGaps: gaps.length },
    };
  }

  /** The brand spellings for this project, for classifying questions elsewhere. */
  async brandFor(projectId: string): Promise<string[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true, websites: { select: { domain: true } } },
    });
    if (!project) throw new NotFoundException('Project not found');
    return brandTerms(project.name, project.websites.map((w) => normalizeDomain(w.domain)).filter(Boolean));
  }

  private async loadContext(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        name: true,
        websites: { select: { id: true, domain: true } },
        competitors: { select: { id: true, domain: true, label: true, name: true, websiteId: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');

    const ownDomains = project.websites.map((w) => normalizeDomain(w.domain)).filter(Boolean);
    const ownCrawlIds = (
      await Promise.all(project.websites.map((w) => this.latestCompletedCrawl(w.id)))
    ).filter((id): id is string => Boolean(id));

    const ownPages = ownCrawlIds.length
      ? await this.prisma.page.findMany({
          where: { crawlJobId: { in: ownCrawlIds }, statusCode: { gte: 200, lt: 300 } },
          select: PAGE_FIELDS,
          take: MAX_OWN_PAGES,
        })
      : [];

    const rivalPages = new Map<string, CandidatePage[]>();
    for (const competitor of project.competitors) {
      const crawlId = competitor.websiteId ? await this.latestCompletedCrawl(competitor.websiteId) : null;
      rivalPages.set(
        competitor.id,
        crawlId
          ? await this.prisma.page.findMany({
              where: { crawlJobId: crawlId, statusCode: { gte: 200, lt: 300 } },
              select: PAGE_FIELDS,
              take: MAX_RIVAL_PAGES,
            })
          : [],
      );
    }

    const location = await this.prisma.localLocation.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      select: { address: true },
    });

    return {
      brand: brandTerms(project.name, ownDomains),
      ownCrawlIds,
      ownPages,
      competitors: project.competitors.map((c) => ({
        id: c.id,
        domain: normalizeDomain(c.domain),
        label: c.label || c.name || normalizeDomain(c.domain),
      })),
      rivalPages,
      city: cityFrom(location?.address),
    };
  }

  private async latestCompletedCrawl(websiteId: string): Promise<string | null> {
    const job = await this.prisma.crawlJob.findFirst({
      where: { websiteId, status: 'COMPLETED' },
      orderBy: { finishedAt: 'desc' },
      select: { id: true },
    });
    return job?.id ?? null;
  }

  private async pageDetail(ids: string[]) {
    const out = new Map<string, { html: string | null; schemaTypes: string[] }>();
    if (ids.length === 0) return out;
    const rows = await this.prisma.page.findMany({
      where: { id: { in: ids } },
      select: { id: true, rawHtml: true, renderedHtml: true, schemas: { select: { schemaType: true } } },
    });
    for (const row of rows) {
      out.set(row.id, {
        html: row.renderedHtml ?? row.rawHtml ?? null,
        schemaTypes: row.schemas.map((s) => s.schemaType),
      });
    }
    return out;
  }

  private async issuesFor(crawlIds: string[], pages: CandidatePage[]) {
    const out = new Map<string, Array<{ issueType: string; severity: string; description: string }>>();
    if (crawlIds.length === 0 || pages.length === 0) return out;
    const byUrl = new Map(pages.map((p) => [p.url, p.id]));
    const rows = await this.prisma.issue.findMany({
      where: {
        crawlJobId: { in: crawlIds },
        status: 'OPEN',
        OR: [{ pageId: { in: pages.map((p) => p.id) } }, { affectedUrl: { in: [...byUrl.keys()] } }],
      },
      select: { pageId: true, affectedUrl: true, issueType: true, severity: true, description: true },
      orderBy: { severity: 'asc' },
    });
    for (const row of rows) {
      const pageId = row.pageId ?? byUrl.get(row.affectedUrl);
      if (!pageId) continue;
      const list = out.get(pageId) ?? [];
      if (!list.some((i) => i.issueType === row.issueType)) {
        list.push({ issueType: row.issueType, severity: row.severity, description: row.description });
      }
      out.set(pageId, list);
    }
    return out;
  }
}

/**
 * Where the rival's page has something the customer's lacks. Only rivals with
 * a crawled, matching page are compared; the rest have nothing to compare.
 */
export function compareSignals(own: PageSignals | null, rivals: RivalEvidence[]): SignalComparison[] {
  const out: SignalComparison[] = [];
  const yesNo = (v: boolean) => (v ? 'Yes' : 'No');
  for (const rival of rivals) {
    const theirs = rival.page?.signals;
    if (!theirs) continue;
    const mine = own;
    const rows: SignalComparison[] = [
      {
        signal: 'DIRECT_ANSWER',
        label: 'Short direct answer near the top',
        you: mine ? yesNo(mine.directAnswer) : 'No page',
        rival: yesNo(theirs.directAnswer),
        rivalDomain: rival.domain,
        rivalAhead: theirs.directAnswer && !mine?.directAnswer,
      },
      {
        signal: 'FAQ',
        label: 'FAQ (markup or question headings)',
        you: mine ? yesNo(mine.faq) : 'No page',
        rival: yesNo(theirs.faq),
        rivalDomain: rival.domain,
        rivalAhead: theirs.faq && !mine?.faq,
      },
      {
        signal: 'SCHEMA',
        label: 'Structured data',
        you: mine ? mine.schemaTypes.join(', ') || 'None' : 'No page',
        rival: theirs.schemaTypes.join(', ') || 'None',
        rivalDomain: rival.domain,
        rivalAhead: theirs.schemaTypes.length > 0 && (mine?.schemaTypes.length ?? 0) === 0,
      },
      {
        signal: 'TERM_COVERAGE',
        label: "Uses the question's terms",
        you: mine ? `${Math.round(mine.termCoverage * 100)}%` : 'No page',
        rival: `${Math.round(theirs.termCoverage * 100)}%`,
        rivalDomain: rival.domain,
        rivalAhead: theirs.termCoverage > (mine?.termCoverage ?? 0),
      },
    ];
    out.push(...rows);
  }
  return out;
}

/** The city from a postal address, second-from-last part ("..., Pune, 411001" -> "Pune"). */
function cityFrom(address?: string | null): string | null {
  if (!address) return null;
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  const city = parts.length >= 2 ? parts[parts.length - 2] : null;
  if (!city || /\d/.test(city) || city.length > 40) return null;
  return city;
}
