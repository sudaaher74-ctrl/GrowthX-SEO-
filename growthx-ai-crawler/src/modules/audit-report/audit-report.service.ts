import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiProvider, AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { extractAndParseJson } from '../ai-engine/utils/json-extractor.util';
import { IssueCountService } from '../issues/issue-count.service';
import { IssueGroupService } from '../issues/issue-group.service';

/** Problems sent to the model and listed in the report, most harmful first. */
const GROUPS_KEPT = 25;
const EXAMPLES_KEPT = 3;
/** The thresholds the audit's own rules use. */
export const THIN_WORDS = 250;
export const SLOW_MS = 1000;

export interface AuditProblem {
  /** Plain title with the page count in it, as the audit shows it. */
  title: string;
  severity: string;
  pages: number;
  /** What it costs, in plain words. */
  why: string;
  /** What to do, and who does it. */
  action: string;
  exampleUrls: string[];
  issueType: string;
}

export interface AuditFacts {
  site: { name: string; domain: string; crawledAt: string | null; healthScore: number | null } | null;
  pages: {
    read: number;
    broken: number;
    slow: number;
    averageResponseMs: number | null;
    thin: number;
    medianWords: number | null;
    missingTitle: number;
    missingDescription: number;
    missingHeadline: number;
    hiddenFromGoogle: number;
    withGoogleDetails: number;
  } | null;
  problemsBySeverity: Record<string, number>;
  problems: AuditProblem[];
  /** Problems beyond the ones listed. */
  moreProblems: number;
}

export type Priority = 'high' | 'medium' | 'low';

export interface AuditFix {
  title: string;
  priority: Priority;
  whatIsWrong: string;
  whyItMatters: string;
  steps: string[];
  /** Who can do it: the owner in their website builder, or a web developer. */
  whoCanFix: 'you' | 'developer';
  effort: 'low' | 'medium' | 'high';
  pages: number;
}

export interface AuditAnalysis {
  summary: string;
  /** The health score explained in a sentence or two. */
  scoreExplained: string;
  fixes: AuditFix[];
  quickWins: string[];
  whatIsGood: string[];
  plan: Array<{ week: string; actions: string[] }>;
  dataGaps: string[];
}

export interface WebsiteAuditReport {
  generatedAt: string;
  facts: AuditFacts;
  analysis: AuditAnalysis | null;
  model: string | null;
  analysisError: string | null;
  snapshotId?: string | null;
}

const PRIORITIES: Priority[] = ['high', 'medium', 'low'];
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : []);
const list = (v: unknown): any[] => (Array.isArray(v) ? v : []);

export function normaliseAuditAnalysis(raw: unknown): AuditAnalysis {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const fixes = list(r.fixes).map((f): AuditFix => {
    const p = str(f?.priority).toLowerCase();
    const effort = str(f?.effort).toLowerCase();
    const who = str(f?.whoCanFix).toLowerCase();
    return {
      title: str(f?.title, 'Untitled problem'),
      priority: p === 'critical' ? 'high' : (PRIORITIES as string[]).includes(p) ? (p as Priority) : 'medium',
      whatIsWrong: str(f?.whatIsWrong),
      whyItMatters: str(f?.whyItMatters),
      steps: strList(f?.steps),
      whoCanFix: who.includes('dev') ? 'developer' : 'you',
      effort: effort === 'low' || effort === 'high' ? effort : 'medium',
      pages: typeof f?.pages === 'number' && f.pages >= 0 ? Math.round(f.pages) : 0,
    };
  });
  fixes.sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority));
  return {
    summary: str(r.summary),
    scoreExplained: str(r.scoreExplained),
    fixes,
    quickWins: strList(r.quickWins),
    whatIsGood: strList(r.whatIsGood),
    plan: list(r.plan).map((w, i) => ({ week: str(w?.week, `Week ${i + 1}`), actions: strList(w?.actions) })),
    dataGaps: strList(r.dataGaps),
  };
}

function median(values: number[]): number | null {
  const s = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/**
 * The whole Website Audit as one report a business owner can read: every
 * problem the crawl found in plain words, with who can fix it and how, and
 * a 4-week plan, written by Sarvam from the measured facts only.
 */
@Injectable()
export class AuditReportService {
  private readonly logger = new Logger(AuditReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly counts: IssueCountService,
    private readonly groups: IssueGroupService,
    private readonly router: MultiAiRouterService,
  ) {}

  async gatherFacts(projectId: string): Promise<AuditFacts> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true, websites: { select: { id: true, domain: true }, take: 1 } },
    });
    const website = project?.websites[0];
    const [counts, groupList] = await Promise.all([
      this.counts.countsForProject(projectId),
      this.groups.groupsForProject(projectId, { limit: 200 }),
    ]);

    let pages: AuditFacts['pages'] = null;
    if (website) {
      const job = await this.prisma.crawlJob.findFirst({
        where: { websiteId: website.id, status: 'COMPLETED' },
        orderBy: { finishedAt: 'desc' },
        select: { id: true },
      });
      if (job) {
        const rows = await this.prisma.page.findMany({
          where: { crawlJobId: job.id },
          select: {
            statusCode: true,
            responseTimeMs: true,
            wordCount: true,
            title: true,
            metaDescription: true,
            h1: true,
            indexability: true,
            _count: { select: { schemas: true } },
          },
        });
        const ok = rows.filter((p) => p.statusCode >= 200 && p.statusCode < 300);
        const times = ok.map((p) => p.responseTimeMs).filter((t) => t > 0);
        pages = {
          read: ok.length,
          broken: rows.filter((p) => p.statusCode >= 400).length,
          slow: ok.filter((p) => p.responseTimeMs > SLOW_MS).length,
          averageResponseMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
          thin: ok.filter((p) => p.wordCount > 0 && p.wordCount < THIN_WORDS).length,
          medianWords: median(ok.map((p) => p.wordCount)),
          missingTitle: ok.filter((p) => !(p.title ?? '').trim()).length,
          missingDescription: ok.filter((p) => !(p.metaDescription ?? '').trim()).length,
          missingHeadline: ok.filter((p) => !p.h1?.length).length,
          hiddenFromGoogle: ok.filter((p) => /NOINDEX|NON_INDEXABLE|BLOCKED/i.test(p.indexability ?? '')).length,
          withGoogleDetails: ok.filter((p) => p._count.schemas > 0).length,
        };
      }
    }

    const problems: AuditProblem[] = groupList.groups.slice(0, GROUPS_KEPT).map((g) => ({
      title: g.title,
      severity: g.severity,
      pages: g.affectedCount,
      why: g.summary,
      action: g.action,
      exampleUrls: g.sampleUrls.slice(0, EXAMPLES_KEPT),
      issueType: g.issueType,
    }));

    return {
      site: website
        ? { name: project?.name ?? website.domain, domain: website.domain, crawledAt: counts.crawledAt, healthScore: counts.healthScore }
        : null,
      pages,
      problemsBySeverity: counts.bySeverity as unknown as Record<string, number>,
      problems,
      moreProblems: Math.max(0, groupList.groups.length - problems.length),
    };
  }

  async generate(projectId: string, organizationId?: string): Promise<WebsiteAuditReport> {
    const facts = await this.gatherFacts(projectId);
    const base = { generatedAt: new Date().toISOString(), facts };
    let report: WebsiteAuditReport;

    if (!facts.site?.crawledAt) {
      report = { ...base, analysis: null, model: null, analysisError: "Your website hasn't been read yet. Run the audit first." };
    } else {
      try {
        const completion = await this.router.generate({
          prompt: buildAuditPrompt(facts),
          systemInstruction:
            'You are a friendly website expert explaining an audit to a business owner who knows nothing about SEO. ' +
            'Use simple everyday words, no jargon. Use only the facts given. Reply with valid JSON only.',
          task: AiTask.SEO_ANALYSIS,
          provider: AiProvider.SARVAM,
          // The customer asked for Sarvam; another vendor's text would be
          // presented under the wrong name.
          allowFallback: false,
          organizationId,
          projectId,
          maxTokens: 6000,
        });
        report =
          completion.refused || !completion.text.trim()
            ? { ...base, analysis: null, model: completion.model, analysisError: 'Sarvam returned no analysis. Try again.' }
            : { ...base, analysis: normaliseAuditAnalysis(extractAndParseJson(completion.text)), model: completion.model, analysisError: null };
      } catch (err) {
        this.logger.warn(`[${projectId}] audit report analysis failed: ${(err as Error).message}`);
        report = {
          ...base,
          analysis: null,
          model: null,
          analysisError: `The analysis could not be written: ${(err as Error).message}`.slice(0, 400),
        };
      }
    }
    return { ...report, snapshotId: await this.store(projectId, report) };
  }

  async latest(projectId: string): Promise<WebsiteAuditReport | null> {
    const row = await this.prisma.auditReportSnapshot.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, report: true },
    });
    return row ? { ...(row.report as unknown as WebsiteAuditReport), snapshotId: row.id } : null;
  }

  private async store(projectId: string, report: WebsiteAuditReport): Promise<string | null> {
    try {
      const row = await this.prisma.auditReportSnapshot.create({ data: { projectId, report: report as any }, select: { id: true } });
      return row.id;
    } catch (err) {
      this.logger.warn(`[${projectId}] audit report could not be stored: ${(err as Error).message}`);
      return null;
    }
  }
}

export function buildAuditPrompt(f: AuditFacts): string {
  const p = f.pages;
  const pages = p
    ? [
        `pages read: ${p.read}`,
        `broken pages (error when opened): ${p.broken}`,
        `slow pages (over ${SLOW_MS / 1000} second to respond): ${p.slow}; average response ${p.averageResponseMs ?? 'unknown'} ms`,
        `thin pages (under ${THIN_WORDS} words): ${p.thin}; typical page length ${p.medianWords ?? 'unknown'} words`,
        `pages with no title: ${p.missingTitle}; no search description: ${p.missingDescription}; no main headline: ${p.missingHeadline}`,
        `pages hidden from Google: ${p.hiddenFromGoogle}; pages giving Google extra details: ${p.withGoogleDetails}`,
      ].join('\n')
    : 'Page details not available.';
  const problems = f.problems.length
    ? f.problems
        .map((x, i) => `${i + 1}. [${x.severity}] ${x.title} (${x.pages} pages). Why: ${x.why}. What to do: ${x.action}. e.g. ${x.exampleUrls.join(', ') || 'none'}`)
        .join('\n')
    : 'No open problems.';
  const sev = Object.entries(f.problemsBySeverity)
    .map(([k, v]) => `${k.toLowerCase()} ${v}`)
    .join(', ');

  return `Write a website audit report for a business owner who does not know SEO.

WEBSITE
${f.site ? `${f.site.name} (${f.site.domain}); read on ${f.site.crawledAt ?? 'never'}; health score ${f.site.healthScore ?? 'unknown'}/100` : 'Not set up.'}

PAGES
${pages}

PROBLEMS FOUND (most harmful first; findings by severity: ${sev || 'none'})
${problems}
${f.moreProblems ? `\n...and ${f.moreProblems} smaller problems not listed.` : ''}

Return JSON exactly in this shape:
{
  "summary": "4-6 simple sentences: how healthy the website is, the biggest problems, and what to do first",
  "scoreExplained": "what the health score means for this business, in 1-2 sentences",
  "fixes": [
    {
      "title": "the problem in plain words",
      "priority": "high|medium|low",
      "whatIsWrong": "what is wrong, with the number of pages and an example address",
      "whyItMatters": "how it loses them customers or visibility on Google",
      "steps": ["step 1", "step 2", "step 3"],
      "whoCanFix": "you|developer",
      "effort": "low|medium|high",
      "pages": 0
    }
  ],
  "quickWins": ["things they can do today in under an hour"],
  "whatIsGood": ["what the website already does well, from the numbers"],
  "plan": [ { "week": "Week 1", "actions": ["..."] } ],
  "dataGaps": ["what this audit could not measure, e.g. Google rankings need Search Console"]
}

Rules:
- One fix per problem listed, most harmful first. Steps must be concrete, 2-5 each, in simple words.
- whoCanFix is "you" when it can be done in a website builder's page settings or editor, otherwise "developer".
- Never use jargon like canonical, schema, meta, H1, crawl, indexing, 4xx or 5xx. Say what it means instead.
- Use only the facts above. If something is unknown, say it was not measured.`;
}
