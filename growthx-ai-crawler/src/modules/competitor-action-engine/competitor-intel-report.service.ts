import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiProvider, AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { extractAndParseJson } from '../ai-engine/utils/json-extractor.util';
import { CompetitorSeoReportService, IssueGroup, SideBySide } from './competitor-seo-report.service';

/** Rivals read into one report; the rest are named as not included. */
export const MAX_RIVALS = 7;
/** Issue kinds per site sent to the model, worst first. */
const ISSUES_PER_SITE = 8;

export interface ReportSite {
  name: string;
  domain: string;
  crawledAt: string | null;
  pagesCrawled: number | null;
  healthScore: number | null;
  issues: IssueGroup[];
  coverage: Array<{ label: string; count: number }>;
}

export interface ReportFacts {
  you: ReportSite | null;
  rivals: Array<ReportSite & { comparison: SideBySide[]; notes: string[] }>;
  notIncluded: string[];
}

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface ReportProblem {
  title: string;
  severity: Severity;
  /** "Your site", or the rival it is about. */
  where: string;
  evidence: string;
  whyItMatters: string;
  fix: string[];
  effort: 'low' | 'medium' | 'high';
}

export interface ReportAnalysis {
  executiveSummary: string;
  problems: ReportProblem[];
  competitorInsights: Array<{ competitor: string; theyLead: string[]; youLead: string[]; copyThis: string }>;
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
}

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low'];
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v.trim() : fallback);
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : []);

/**
 * Coerces whatever the model returned into the report's shape. A missing
 * field becomes empty rather than failing the whole report, and severities
 * outside the four known ones are read as medium.
 */
export function normaliseAnalysis(raw: unknown): ReportAnalysis {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const problems = (Array.isArray(r.problems) ? r.problems : []).map((p: any): ReportProblem => {
    const severity = str(p?.severity).toLowerCase() as Severity;
    const effort = str(p?.effort).toLowerCase();
    return {
      title: str(p?.title, 'Untitled problem'),
      severity: SEVERITIES.includes(severity) ? severity : 'medium',
      where: str(p?.where, 'Your site'),
      evidence: str(p?.evidence),
      whyItMatters: str(p?.whyItMatters),
      fix: strList(p?.fix),
      effort: effort === 'low' || effort === 'high' ? effort : 'medium',
    };
  });
  problems.sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));

  return {
    executiveSummary: str(r.executiveSummary),
    problems,
    competitorInsights: (Array.isArray(r.competitorInsights) ? r.competitorInsights : []).map((c: any) => ({
      competitor: str(c?.competitor),
      theyLead: strList(c?.theyLead),
      youLead: strList(c?.youLead),
      copyThis: str(c?.copyThis),
    })),
    plan: (Array.isArray(r.plan) ? r.plan : []).map((w: any, i: number) => ({
      week: str(w?.week, `Week ${i + 1}`),
      actions: strList(w?.actions),
    })),
    dataGaps: strList(r.dataGaps),
  };
}

/**
 * The full competitor report: what the crawls found on your site and each
 * rival's, and a written analysis of it by Sarvam.
 *
 * The model is given the measured facts and told to use nothing else, so
 * every number in the analysis traces back to a crawl. The facts are returned
 * alongside it and are downloadable even when the analysis could not be made.
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
        select: { id: true, domain: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    let you: ReportSite | null = null;
    const website = project?.websites[0];
    if (website) {
      const job = await this.prisma.crawlJob.findFirst({
        where: { websiteId: website.id, status: 'COMPLETED' },
        orderBy: { finishedAt: 'desc' },
        select: { finishedAt: true, pagesCrawled: true, healthScore: true },
      });
      you = {
        name: project?.name ?? website.domain,
        domain: website.domain,
        crawledAt: job?.finishedAt?.toISOString() ?? null,
        pagesCrawled: job?.pagesCrawled ?? null,
        healthScore: job?.healthScore ?? null,
        issues: (await this.seoReport.issuesFor(website.id)).slice(0, ISSUES_PER_SITE),
        coverage: [],
      };
    }

    const rivals: ReportFacts['rivals'] = [];
    for (const c of competitors.slice(0, MAX_RIVALS)) {
      const r = await this.seoReport.report(projectId, c.id);
      rivals.push({
        name: r.competitor.name,
        domain: r.competitor.domain,
        crawledAt: r.crawl.crawledAt,
        pagesCrawled: r.crawl.pagesCrawled,
        healthScore: r.crawl.healthScore,
        issues: r.issues.slice(0, ISSUES_PER_SITE),
        coverage: r.coverage.map(({ label, count }) => ({ label, count })),
        comparison: r.comparison,
        notes: r.notes,
      });
    }

    return { you, rivals, notIncluded: competitors.slice(MAX_RIVALS).map((c) => c.domain) };
  }

  async generate(projectId: string, organizationId?: string): Promise<CompetitorIntelReport> {
    const facts = await this.gatherFacts(projectId);
    const base = { generatedAt: new Date().toISOString(), facts };

    try {
      const completion = await this.router.generate({
        prompt: buildPrompt(facts),
        systemInstruction:
          'You are a senior SEO strategist writing for a business owner. Use only the facts given. ' +
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

function siteBlock(s: ReportSite): string {
  const issues = s.issues.length
    ? s.issues.map((i) => `  - [${i.severity}] ${i.issueType} on ${i.pages} page(s): ${i.description}. Fix: ${i.recommendation}. e.g. ${i.exampleUrls.slice(0, 2).join(', ')}`).join('\n')
    : '  - none recorded';
  const coverage = s.coverage.length ? s.coverage.map((c) => `${c.label}: ${c.count}`).join(', ') : 'not broken down';
  return (
    `${s.name} (${s.domain})\n` +
    `  crawled: ${s.crawledAt ?? 'never'}; pages: ${s.pagesCrawled ?? 'unknown'}; health score: ${s.healthScore ?? 'unknown'}/100\n` +
    `  page coverage: ${coverage}\n  open issues:\n${issues}`
  );
}

export function buildPrompt(facts: ReportFacts): string {
  const rivals = facts.rivals
    .map((r) => {
      const cmp = r.comparison
        .map((c) => `  - ${c.label}: them ${c.them ?? 'unknown'}, you ${c.you ?? 'unknown'} (leader: ${c.leader})`)
        .join('\n');
      const notes = r.notes.length ? `\n  notes: ${r.notes.join(' ')}` : '';
      return `${siteBlock(r)}\n  side by side with you:\n${cmp || '  - not measured'}${notes}`;
    })
    .join('\n\n');

  return `Write a detailed competitor intelligence report from these crawl facts.

YOUR SITE
${facts.you ? siteBlock(facts.you) : 'Not crawled yet.'}

RIVALS
${rivals || 'No rivals tracked.'}
${facts.notIncluded.length ? `\nNot included in this report: ${facts.notIncluded.join(', ')}` : ''}

Return JSON exactly in this shape:
{
  "executiveSummary": "4-6 sentences: are they winning or losing, against whom, and the single most important thing to do",
  "problems": [
    {
      "title": "short name of the problem",
      "severity": "critical|high|medium|low",
      "where": "Your site, or the rival's name",
      "evidence": "the exact numbers and example URLs from the facts",
      "whyItMatters": "what it costs in search visibility, in plain words",
      "fix": ["step 1", "step 2", "step 3"],
      "effort": "low|medium|high"
    }
  ],
  "competitorInsights": [
    { "competitor": "name", "theyLead": ["..."], "youLead": ["..."], "copyThis": "one thing worth copying from them" }
  ],
  "plan": [ { "week": "Week 1", "actions": ["..."] } ],
  "dataGaps": ["what could not be measured and what would measure it"]
}

Rules:
- Cover every issue listed for your site as a problem, worst first; add rival problems only where they reveal an opening for you.
- Give 3-5 concrete fix steps per problem, specific to the pages named.
- One competitorInsights entry per rival that has been crawled.
- The plan is 4 weeks, highest impact first.
- Use only the facts above. If something is "unknown" or "never", say it is not measured instead of guessing.`;
}
