import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiProvider, AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { extractAndParseJson } from '../ai-engine/utils/json-extractor.util';
import { AiVisibilityService } from './ai-visibility.service';
import {
  BusinessContextSummary,
  ReportGrowthPlaybook,
  buildPlaybookSchemaSnippet,
  formatBusinessContextForPrompt,
  normalisePlaybook,
} from '../report-context/report-playbook.types';
import { UnifiedReportContextService } from '../report-context/unified-report-context.service';

export type InsightLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface VisibilityInsights {
  projectId: string;
  status: 'READY' | 'NO_DATA';
  generatedAt: string;
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
  answer: string | null;
  findings: Array<{ title: string; detail: string; evidence: string }>;
  recommendations: Array<{
    title: string;
    category: 'CONTENT' | 'TECHNICAL' | 'AUTHORITY' | 'ON_PAGE';
    priority: InsightLevel;
    effort: InsightLevel;
    rationale: string;
    evidence: string;
  }>;
  /** Shared hyper-local business dossier (offerings, micro-areas, GBP presence). */
  businessContext?: BusinessContextSummary | null;
  /** 7-layer hyper-local AI Visibility growth playbook (possibilities, methods, AI-quotable assets, 90-day roadmap). */
  playbook?: ReportGrowthPlaybook;
}

const CACHE_TTL_MS = 30 * 60 * 1000;
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

function normLevel(v: unknown): InsightLevel {
  const s = str(v).toUpperCase();
  if (s === 'CRITICAL' || s === 'HIGH') return 'HIGH';
  if (s === 'LOW') return 'LOW';
  return 'MEDIUM';
}

function normRecCategory(v: unknown): 'CONTENT' | 'TECHNICAL' | 'AUTHORITY' | 'ON_PAGE' {
  const s = str(v).toUpperCase().replace(/[\s-]+/g, '_');
  if (s === 'CONTENT' || s === 'TECHNICAL' || s === 'AUTHORITY' || s === 'ON_PAGE') return s;
  if (s.includes('AUTH') || s.includes('LOCAL') || s.includes('REVIEW') || s.includes('OFF')) return 'AUTHORITY';
  if (s.includes('TECH') || s.includes('SCHEMA') || s.includes('ROBOT')) return 'TECHNICAL';
  if (s.includes('PAGE') || s.includes('FAQ')) return 'ON_PAGE';
  return 'CONTENT';
}

@Injectable()
export class AiVisibilityInsightsService {
  private readonly logger = new Logger(AiVisibilityInsightsService.name);
  private readonly cache = new Map<string, { value: VisibilityInsights; expiresAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: AiVisibilityService,
    private readonly router: MultiAiRouterService,
    @Optional() private readonly reportContext?: UnifiedReportContextService,
  ) {}

  async getInsights(
    projectId: string,
    options?: { question?: string; organizationId?: string; forceRefresh?: boolean },
  ): Promise<VisibilityInsights> {
    const cleanQuestion = options?.question?.trim() || null;

    const [report, questionAnalysis, citations, businessContext, projectMeta] = await Promise.all([
      this.visibility.getReport(projectId, 28),
      this.visibility.getQuestionAnalysis(projectId).catch(() => ({ questions: [] as any[] })),
      this.visibility.getCitationsIntelligence(projectId).catch(() => ({ totalCitations: 0, citationsByDomain: [] as any[] })),
      this.reportContext ? this.reportContext.buildForProject(projectId) : Promise.resolve(null),
      this.prisma.project
        ?.findUnique({
          where: { id: projectId },
          select: { organizationId: true },
        })
        .catch(() => null),
    ]);

    const organizationId = options?.organizationId || projectMeta?.organizationId;
    const questions = Array.isArray((questionAnalysis as any)?.questions) ? (questionAnalysis as any).questions : [];
    const missedQuestions = questions.filter((q: any) => q.outcome === 'NOT_CITED');
    const basedOn = {
      periodDays: 28,
      checks: report.summary.checked,
      cited: report.summary.cited,
      failedChecks: report.summary.failedChecks,
      prompts: questions.length,
      competitors: report.shareOfVoice.filter((s) => Boolean(s.domain)).length,
      crawlIssues: businessContext?.crossModuleSnapshot.openHighIssues ?? 0,
    };

    const emptyResponse: VisibilityInsights = {
      projectId,
      status: 'NO_DATA',
      generatedAt: new Date().toISOString(),
      model: null,
      question: cleanQuestion,
      basedOn,
      summary: null,
      answer: null,
      findings: [],
      recommendations: [],
      ...(businessContext ? { businessContext } : {}),
    };

    if (report.summary.checked === 0) {
      return emptyResponse;
    }

    const cacheKey = `${projectId}::${report.periodEnd}::${report.summary.checked}::${cleanQuestion ?? ''}`;
    if (!options?.forceRefresh) {
      const hit = this.cache.get(cacheKey);
      if (hit && Date.now() < hit.expiresAt) return hit.value;
    }

    try {
      const prompt = this.buildPrompt(
        report,
        questions,
        missedQuestions,
        citations,
        businessContext,
        cleanQuestion,
      );
      const completion = await this.router.generate({
        prompt,
        systemInstruction:
          'You are an AI Search & Local Entity Visibility strategist writing an actionable citation playbook for a business owner. ' +
          'Explain why ChatGPT, Gemini, Claude, and Perplexity recommend rivals over this business, and give concrete on-site + off-site local authority playbooks and AI-quotable copy-paste blocks. ' +
          'Use only the measured facts provided. Never invent rankings, traffic, or review counts. Reply with valid JSON only.',
        task: AiTask.AI_VISIBILITY_ANALYSIS,
        provider: AiProvider.GEMINI,
        model: 'gemini-3.1-flash-lite',
        allowFallback: false,
        organizationId,
        projectId,
        maxTokens: 6000,
        cacheable: !options?.forceRefresh,
      });

      if (completion.refused || !completion.text.trim()) {
        return emptyResponse;
      }

      const raw = extractAndParseJson(completion.text) as Record<string, unknown>;
      const summary = str(raw?.summary) || null;
      const answer = str(raw?.answer) || null;
      const findings = arr(raw?.findings)
        .map((f) => ({
          title: str(f?.title),
          detail: str(f?.detail),
          evidence: str(f?.evidence),
        }))
        .filter((f) => f.title && f.detail)
        .slice(0, 8);
      const recommendations = arr(raw?.recommendations)
        .map((r) => ({
          title: str(r?.title),
          category: normRecCategory(r?.category),
          priority: normLevel(r?.priority),
          effort: normLevel(r?.effort),
          rationale: str(r?.rationale),
          evidence: str(r?.evidence),
        }))
        .filter((r) => r.title && r.rationale)
        .slice(0, 8);
      const playbook = normalisePlaybook(raw?.playbook);

      if (!summary && findings.length === 0 && recommendations.length === 0 && !playbook) {
        return emptyResponse;
      }

      const result: VisibilityInsights = {
        projectId,
        status: 'READY',
        generatedAt: new Date().toISOString(),
        model: completion.model,
        question: cleanQuestion,
        basedOn,
        summary,
        answer,
        findings,
        recommendations,
        ...(businessContext ? { businessContext } : {}),
        ...(playbook ? { playbook } : {}),
      };

      if (this.cache.size >= 200) {
        const oldest = this.cache.keys().next().value;
        if (oldest) this.cache.delete(oldest);
      }
      this.cache.set(cacheKey, { value: result, expiresAt: Date.now() + CACHE_TTL_MS });
      return result;
    } catch (err) {
      this.logger.warn(`[${projectId}] AI visibility insights generation failed: ${(err as Error).message}`);
      return emptyResponse;
    }
  }

  private buildPrompt(
    report: Awaited<ReturnType<AiVisibilityService['getReport']>>,
    questions: any[],
    missedQuestions: any[],
    citations: { totalCitations: number; citationsByDomain: Array<{ domain: string; count: number; ownCited: boolean }> },
    businessContext: BusinessContextSummary | null,
    customQuestion: string | null,
  ): string {
    const contextBlock = formatBusinessContextForPrompt(businessContext);
    const byAssistant = report.byAssistant
      .map((a) => `  - ${a.assistant} (${a.model}): ${a.cited}/${a.checked} cited (${a.citationSharePct}%)`)
      .join('\n');
    const sov = report.shareOfVoice
      .slice(0, 10)
      .map((s) => `  - ${s.label}${s.domain ? ` (${s.domain})` : ''}: ${s.mentions} mentions (${s.sharePct}% share)`)
      .join('\n');
    const topCitations = citations.citationsByDomain
      .slice(0, 10)
      .map((c) => `  - ${c.domain}: ${c.count} citations${c.ownCited ? ' (your site)' : ''}`)
      .join('\n');
    const missedLines = missedQuestions
      .slice(0, 12)
      .map((q) => {
        const rivals = q.answer?.competitorsCited?.length ? ` | rivals cited: ${q.answer.competitorsCited.join(', ')}` : '';
        const page = q.ownPage?.url ? ` | your page: ${q.ownPage.url} (words=${q.ownPage.signals?.wordCount ?? '?'}, faq=${q.ownPage.signals?.faq ? 'yes' : 'no'}, directAnswer=${q.ownPage.signals?.directAnswer ? 'yes' : 'no'})` : ' | your page: NONE (content gap)';
        return `  - "${q.text}"${rivals}${page}`;
      })
      .join('\n');

    return `You are analyzing real, measured AI Assistant Visibility data for a business over the last 28 days.
${contextBlock}
MEASURED AI VISIBILITY SCORECARD (last 28 days)
  answers checked: ${report.summary.checked}
  answers naming this brand: ${report.summary.cited}
  citation share: ${report.summary.citationSharePct}%
  average recommendation position: ${report.summary.averagePosition ?? 'not measured'}
  tracked buyer questions: ${questions.length} (${missedQuestions.length} missed)

BY AI ASSISTANT
${byAssistant || '  none'}

COMPETITOR SHARE OF VOICE IN AI ANSWERS
${sov || '  none'}

TOP THIRD-PARTY & BRAND DOMAINS CITED BY AI ENGINES
${topCitations || '  none recorded'}

MISSED BUYER QUESTIONS (WHERE AI RECOMMENDED RIVALS OR OMITTED THIS BRAND)
${missedLines || '  none — every tracked question cited your brand'}
${customQuestion ? `\nOWNER FOLLOW-UP QUESTION TO ANSWER DIRECTLY: "${customQuestion}"\n` : ''}
Return JSON exactly in this shape:
{
  "summary": "4-5 plain sentences explaining current AI recommendation visibility, who AI recommends instead, why they win, and the #1 on-site + off-site move to capture recommendations.",
  "answer": ${customQuestion ? '"Direct grounded answer to the owner follow-up question"' : 'null'},
  "findings": [
    { "title": "Sharp finding", "detail": "Plain-English explanation tied to this business & area", "evidence": "Exact numbers, missed questions, or cited rivals from above" }
  ],
  "recommendations": [
    {
      "title": "Actionable recommendation",
      "category": "CONTENT | TECHNICAL | AUTHORITY | ON_PAGE",
      "priority": "HIGH | MEDIUM | LOW",
      "effort": "HIGH | MEDIUM | LOW",
      "rationale": "Why this directly increases citations across ChatGPT, Gemini, and Perplexity for this business",
      "evidence": "Measured fact supporting it"
    }
  ],
  ${buildPlaybookSchemaSnippet('ai-visibility')}
}

Rules:
- Address BOTH on-site answer clarity (AI-quotable product/pricing/area proof blocks, FAQPage JSON-LD, /llms.txt) AND off-site local entity authority (Google Business Profile reviews with area/product mentions, trusted local directories, consistent NAP, local community/press mentions).
- In readyToUseAssets, include copy-paste AI-Quotable FAQ/Summary blocks answering the actual missed buyer questions above.
- Use only the facts given. Never invent citation counts, rankings, or review numbers.`;
  }
}
