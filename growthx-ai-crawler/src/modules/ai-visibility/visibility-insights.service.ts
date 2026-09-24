import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { extractAndParseJson } from '../ai-engine/utils/json-extractor.util';
import { AiVisibilityService } from './ai-visibility.service';
import { normalizeDomain } from './citation/citation-detector';
import { brandTerms, questionGroup } from './questions/question-group';

export type InsightCategory = 'CONTENT' | 'TECHNICAL' | 'AUTHORITY' | 'ON_PAGE';
export type InsightLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface InsightFinding {
  title: string;
  detail: string;
  /** The measured fact this rests on — a prompt, a competitor, an issue. */
  evidence: string;
}

export interface InsightRecommendation {
  title: string;
  category: InsightCategory;
  priority: InsightLevel;
  effort: InsightLevel;
  rationale: string;
  evidence: string;
}

export interface VisibilityInsights {
  projectId: string;
  /**
   * NO_DATA: nothing has been measured yet, so no analysis is generated —
   * advice with nothing under it would read as a finding and not be one.
   */
  status: 'READY' | 'NO_DATA';
  generatedAt: string;
  /** The model that wrote the analysis. Null when none was generated. */
  model: string | null;
  question: string | null;
  basedOn: {
    periodDays: number;
    checks: number;
    cited: number;
    failedChecks: number;
    prompts: number;
    competitors: number;
    crawlIssues: number;
  };
  summary: string | null;
  /** Direct answer to `question`, when one was asked. */
  answer: string | null;
  findings: InsightFinding[];
  recommendations: InsightRecommendation[];
}

const PERIOD_DAYS = 28;
const EXCERPT_FOR_MODEL = 500;
const CACHE_LIMIT = 200;

const CATEGORIES: readonly InsightCategory[] = ['CONTENT', 'TECHNICAL', 'AUTHORITY', 'ON_PAGE'];
const LEVELS: readonly InsightLevel[] = ['HIGH', 'MEDIUM', 'LOW'];

const INSIGHTS_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    answer: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          evidence: { type: 'string' },
        },
        required: ['title', 'detail', 'evidence'],
      },
    },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          category: { type: 'string', enum: [...CATEGORIES] },
          priority: { type: 'string', enum: [...LEVELS] },
          effort: { type: 'string', enum: [...LEVELS] },
          rationale: { type: 'string' },
          evidence: { type: 'string' },
        },
        required: ['title', 'category', 'priority', 'effort', 'rationale', 'evidence'],
      },
    },
  },
  required: ['summary', 'findings', 'recommendations'],
};

/**
 * AI-written analysis of a project's measured AI visibility.
 *
 * Everything the model sees is data this platform measured — citation checks
 * and their answers, tracked competitors, crawl issues — and it is told to
 * ground every finding in that data and invent nothing. When nothing has been
 * measured yet no analysis is generated at all.
 */
@Injectable()
export class VisibilityInsightsService {
  private readonly logger = new Logger(VisibilityInsightsService.name);
  /** Keyed on the underlying data, so a page reload does not re-bill the model. */
  private readonly cache = new Map<string, VisibilityInsights>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MultiAiRouterService,
    private readonly visibility: AiVisibilityService,
  ) {}

  async getInsights(projectId: string, rawQuestion?: string): Promise<VisibilityInsights> {
    const question = rawQuestion?.trim().slice(0, 500) || null;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        websites: { select: { domain: true } },
        competitors: { select: { domain: true, label: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');

    const report = await this.visibility.getReport(projectId, PERIOD_DAYS);
    const prompts = await this.prisma.trackedPrompt.findMany({
      where: { projectId, isActive: true },
      include: {
        checks: { where: { error: null }, orderBy: { checkedAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'asc' },
      take: 25,
    });
    const latestCrawl = await this.prisma.crawlJob.findFirst({
      where: { website: { projectId }, status: 'COMPLETED' },
      orderBy: { finishedAt: 'desc' },
      include: {
        issues: {
          select: { severity: true, issueType: true, description: true },
          orderBy: { severity: 'asc' },
          take: 10,
        },
      },
    });
    const issues = latestCrawl?.issues ?? [];

    const basedOn = {
      periodDays: PERIOD_DAYS,
      checks: report.summary.checked,
      cited: report.summary.cited,
      failedChecks: report.summary.failedChecks,
      prompts: prompts.length,
      competitors: project.competitors.length,
      crawlIssues: issues.length,
    };

    const empty: VisibilityInsights = {
      projectId,
      status: 'NO_DATA',
      generatedAt: new Date().toISOString(),
      model: null,
      question,
      basedOn,
      summary: null,
      answer: null,
      findings: [],
      recommendations: [],
    };
    if (report.summary.checked === 0) return empty;

    const latestCheckAt = prompts
      .map((p) => p.checks[0]?.checkedAt?.getTime() ?? 0)
      .reduce((a, b) => Math.max(a, b), 0);
    const cacheKey = [projectId, question ?? '', latestCheckAt, report.summary.checked, basedOn.competitors, latestCrawl?.id ?? ''].join('|');
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const domain = normalizeDomain(project.websites[0]?.domain ?? '');
    const brand = project.name || domain;
    const brandSpellings = brandTerms(project.name, project.websites.map((w) => normalizeDomain(w.domain)));
    const data = {
      business: { name: brand, domain },
      periodDays: PERIOD_DAYS,
      summary: report.summary,
      byAssistant: report.byAssistant,
      shareOfVoice: report.shareOfVoice,
      trackedCompetitors: project.competitors.map((c) => c.label || c.domain),
      prompts: prompts.map((p) => {
        const check = p.checks[0];
        return {
          prompt: p.text,
          // REPUTATION questions name the brand, so an answer repeating it is
          // not a citation win; only BUYER questions count toward share.
          group: questionGroup(p.text, brandSpellings),
          assistant: check?.assistant ?? null,
          businessCited: check ? check.cited : null,
          position: check?.position ?? null,
          competitorsCited: check?.competitorsCited ?? [],
          answerExcerpt: check?.answerExcerpt?.slice(0, EXCERPT_FOR_MODEL) ?? null,
        };
      }),
      crawlIssues: issues.map((i) => ({ severity: i.severity, type: i.issueType, description: i.description })),
    };

    const completion = await this.router.generate({
      task: AiTask.REASONING,
      organizationId: project.organizationId,
      projectId,
      systemInstruction:
        'You are an AI-visibility analyst. You are given measured data: questions a buyer might ask, ' +
        'whether AI assistants cited the business in their answers, which competitors they named instead, ' +
        "and issues found on the business's website. Use ONLY this data. Never invent numbers, percentages, " +
        'search volumes, projected gains, rankings or facts about the business or its competitors. Every finding ' +
        'and recommendation must name the specific evidence it rests on (a prompt, a competitor, an answer, an issue). ' +
        'If the data cannot support a conclusion, say so plainly. Questions marked REPUTATION name the business, ' +
        'so being cited in their answers is expected and is not evidence of visibility; judge visibility on BUYER ' +
        'questions. Return only JSON.',
      prompt:
        `Measured AI visibility data:\n${JSON.stringify(data, null, 1)}\n\n` +
        (question
          ? `The business asks: "${question}". Put a direct answer, grounded in the data, in "answer".\n`
          : '') +
        'Return JSON with "summary" (2-3 sentences on where the business stands), ' +
        '"findings" (up to 5: title, detail, evidence), and "recommendations" (up to 6: title, ' +
        'category CONTENT|TECHNICAL|AUTHORITY|ON_PAGE, priority HIGH|MEDIUM|LOW, effort HIGH|MEDIUM|LOW, rationale, evidence).',
      jsonSchema: INSIGHTS_SCHEMA,
      maxTokens: 4000,
    });

    const parsed = extractAndParseJson<any>(completion.text) ?? {};
    const insights: VisibilityInsights = {
      ...empty,
      status: 'READY',
      model: completion.model,
      summary: text(parsed.summary),
      answer: question ? text(parsed.answer) : null,
      findings: list(parsed.findings)
        .map((f) => ({ title: text(f.title) ?? '', detail: text(f.detail) ?? '', evidence: text(f.evidence) ?? '' }))
        .filter((f) => f.title && f.detail)
        .slice(0, 5),
      recommendations: list(parsed.recommendations)
        .map((r) => ({
          title: text(r.title) ?? '',
          category: oneOf(r.category, CATEGORIES, 'CONTENT'),
          priority: oneOf(r.priority, LEVELS, 'MEDIUM'),
          effort: oneOf(r.effort, LEVELS, 'MEDIUM'),
          rationale: text(r.rationale) ?? '',
          evidence: text(r.evidence) ?? '',
        }))
        .filter((r) => r.title && r.rationale)
        .slice(0, 6),
    };

    if (this.cache.size >= CACHE_LIMIT) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(cacheKey, insights);
    return insights;
  }
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function list(value: unknown): any[] {
  return Array.isArray(value) ? value.filter((v) => v && typeof v === 'object') : [];
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const upper = typeof value === 'string' ? value.trim().toUpperCase().replace(/[\s-]+/g, '_') : '';
  return (allowed as readonly string[]).includes(upper) ? (upper as T) : fallback;
}
