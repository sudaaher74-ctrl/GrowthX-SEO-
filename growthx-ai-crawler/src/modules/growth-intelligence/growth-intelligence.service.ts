import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SearchConsoleInsightsService } from '../integrations/google/search-console-insights.service';
import { AnalyticsInsightsService, pathKey } from '../integrations/google/analytics-insights.service';
import { OWN_SCOPE } from '../crawler/website-scope';
import { USABLE_CRAWL } from '../crawler/crawl-selection';
import { diagnosePage, gbpLandingFinding, siteRisks, THRESHOLDS } from './intelligence-rules';
import {
  CompetitorRankFact,
  Evidence,
  EvidenceSource,
  Finding,
  Movement,
  PageDiagnosis,
  PageFacts,
  SiteFacts,
  SiteTrends,
} from './intelligence.types';

const DAY = 24 * 60 * 60 * 1000;
/** Pages read in full (queries, competitors) — the rest are ranked by impressions only. */
const MAX_PAGES = 100;
const MAX_QUERY_PAGES = 25;

function movement(current: number, previous: number | null): Movement {
  return { current, previous, changePct: previous && previous > 0 ? ((current - previous) / previous) * 100 : null };
}

/**
 * Joins every source a project has onto its pages and lets the rules speak.
 *
 * This is the layer between the collectors and the customer. It reads what the
 * crawler, Search Console, Analytics, Business Profile, competitor tracking and
 * AI-visibility checks have already stored; it calls no external API and writes
 * nothing. Everything is scoped to one project the caller belongs to.
 */
@Injectable()
export class GrowthIntelligenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly search: SearchConsoleInsightsService,
    private readonly analytics: AnalyticsInsightsService,
  ) {}

  /** "Why is my website not growing?" — the whole project, ranked. */
  async report(organizationId: string, projectId: string, days = 28, limit = 15) {
    await this.assertProject(organizationId, projectId);
    const ctx = await this.gather(projectId, days);

    const diagnoses = ctx.pages
      .map((facts) => diagnosePage(facts, ctx.site))
      .filter((d) => d.findings.length > 0)
      .sort(
        (a, b) =>
          b.priority.potentialClicks - a.priority.potentialClicks ||
          b.corroboratingSources.length - a.corroboratingSources.length,
      );

    const risks = siteRisks(ctx.trends);
    const gbp = gbpLandingFinding(ctx.trends, ctx.site);
    const siteLevel = [...risks.findings, ...gbp.findings, ...ctx.aiFindings.findings, ...ctx.crawlProblems.findings];
    const evidence = new Map<string, Evidence>();
    for (const e of [...risks.evidence, ...gbp.evidence, ...ctx.aiFindings.evidence, ...ctx.crawlProblems.evidence]) evidence.set(e.id, e);
    for (const d of diagnoses) for (const e of d.evidence) evidence.set(e.id, e);

    const all: Finding[] = [...diagnoses.flatMap((d) => d.findings), ...siteLevel];
    const by = (c: Finding['category']) => all.filter((f) => f.category === c);
    const potentialClicks = diagnoses.reduce((s, d) => s + d.priority.potentialClicks, 0);
    const connectedSources = (Object.entries(ctx.site.sources) as [EvidenceSource, { connected: boolean }][])
      .filter(([, v]) => v.connected)
      .map(([k]) => k);

    return {
      question: 'Why is my website not growing?',
      windowDays: days,
      generatedAt: new Date().toISOString(),
      sources: ctx.site.sources,
      answer: {
        summary: this.summary(diagnoses, all, potentialClicks, connectedSources),
        confidenceNote:
          'Findings rest on the sources listed against each one. Where sources agree, confidence is higher; where only one source speaks, it is low. Nothing here proves cause.',
      },
      counts: { problems: by('PROBLEM').length, opportunities: by('OPPORTUNITY').length, risks: by('RISK').length },
      estimatedExtraClicks: potentialClicks,
      risks: by('RISK'),
      problems: by('PROBLEM').slice(0, 50),
      opportunities: by('OPPORTUNITY').slice(0, 50),
      pages: diagnoses.slice(0, limit),
      evidence: Object.fromEntries(evidence),
      notMeasured: (Object.entries(ctx.site.sources) as [EvidenceSource, { connected: boolean; note: string | null }][])
        .filter(([, v]) => !v.connected)
        .map(([source, v]) => ({ source, reason: v.note })),
      methodology: {
        thresholds: THRESHOLDS,
        notes: [
          'Click estimates come from a general CTR-by-position curve and are estimates, not forecasts.',
          'Pages are ranked by estimated extra clicks, then by the number of independent sources that agree. There is no blended score.',
          'Analytics landing-page figures cover all channels; they are not split to organic search.',
          'Risks are raised only from two real stored periods; a period with no earlier comparison raises nothing.',
        ],
      },
    };
  }

  /** One page's diagnosis, whether or not it is among the top ranked. */
  async page(organizationId: string, projectId: string, url: string, days = 28): Promise<PageDiagnosis> {
    await this.assertProject(organizationId, projectId);
    const ctx = await this.gather(projectId, days, url);
    const key = pathKey(url);
    const facts = ctx.pages.find((p) => pathKey(p.url) === key) ?? this.emptyFacts(url);
    return diagnosePage(facts, ctx.site);
  }

  private summary(diagnoses: PageDiagnosis[], all: Finding[], potentialClicks: number, connected: EvidenceSource[]): string {
    if (connected.length === 0) return 'No data source is connected yet, so there is nothing to explain.';
    const risks = all.filter((f) => f.category === 'RISK');
    const parts: string[] = [
      `Using ${connected.join(', ')}: ${diagnoses.length} page${diagnoses.length === 1 ? '' : 's'} with findings` +
        (potentialClicks ? `, an estimated ${potentialClicks.toLocaleString('en-US')} extra clicks available in the analysed window` : '') +
        '.',
    ];
    if (diagnoses[0]) parts.push(`Largest opportunity: ${diagnoses[0].path} — ${diagnoses[0].headline}`);
    if (risks.length) parts.push(`${risks.length} risk${risks.length === 1 ? '' : 's'} to watch: ${risks.slice(0, 3).map((r) => r.what).join(' ')}`);
    if (!diagnoses.length && !risks.length) parts.push('The connected data shows nothing that stands out yet.');
    return parts.join(' ');
  }

  private async assertProject(organizationId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, organizationId }, select: { id: true } });
    if (!project) throw new NotFoundException('Project not found');
  }

  private emptyFacts(url: string): PageFacts {
    return { url, path: pathKey(url), search: null, analytics: null, crawl: null, competitors: null, ai: null };
  }

  // ── Gathering ──────────────────────────────────────────────────────────

  private async gather(projectId: string, days: number, onlyUrl?: string) {
    const now = Date.now();
    const start = new Date(now - days * DAY);
    const priorStart = new Date(now - 2 * days * DAY);

    const [integrations, job, keywordGaps, checks, priorChecks, searchSummary, analyticsSummary, profile] = await Promise.all([
      this.prisma.integration.findMany({
        // Provider only: tokens live on this table and never leave it.
        where: { projectId, status: 'CONNECTED', selectedResourceId: { not: null } },
        select: { provider: true },
      }),
      this.prisma.crawlJob.findFirst({
        where: { ...USABLE_CRAWL, website: { projectId, scope: OWN_SCOPE } },
        orderBy: { finishedAt: 'desc' },
        select: { id: true, finishedAt: true },
      }),
      this.competitorRanks(projectId),
      this.prisma.promptCheck.findMany({
        where: { trackedPrompt: { projectId }, checkedAt: { gte: start }, error: null },
        select: { cited: true, citedUrl: true, competitorsCited: true },
      }),
      this.prisma.promptCheck.findMany({
        where: { trackedPrompt: { projectId }, checkedAt: { gte: priorStart, lt: start }, error: null },
        select: { cited: true },
      }),
      this.search.summary(projectId, days).catch(() => null),
      this.analytics.summary(projectId, days).catch(() => null),
      this.prisma.gbpLocationProfile.findFirst({ where: { projectId }, select: { websiteUri: true } }),
    ]);

    const connected = new Set(integrations.map((i) => i.provider));
    const has = (ok: boolean, missing: string) => ({ connected: ok, note: ok ? null : missing });
    const site: SiteFacts = {
      engagementRate: analyticsSummary?.engagementRate.current ?? null,
      conversionTracking: analyticsSummary?.conversionTrackingConfigured ?? false,
      sources: {
        CRAWL: has(Boolean(job), 'No completed crawl of the website yet.'),
        GSC: has(connected.has('search_console') && Boolean(searchSummary), 'Search Console is not connected, or has not synced yet.'),
        GA4: has(connected.has('analytics') && Boolean(analyticsSummary), 'Google Analytics is not connected, or has not synced yet.'),
        GBP: has(connected.has('business_profile'), 'Google Business Profile is not connected.'),
        COMPETITORS: has(keywordGaps !== null, 'No competitor keyword data has been collected yet. Add competitors and refresh the keyword gap.'),
        AI_VISIBILITY: has(checks.length > 0, 'AI visibility has not been measured yet.'),
      },
    };

    // Pages: Search Console's list is the spine; crawl-only pages get facts only if asked for.
    const gscPages: Awaited<ReturnType<SearchConsoleInsightsService['top']>> = await this.search
      .top(projectId, 'PAGE', { days, limit: MAX_PAGES })
      .catch(() => []);
    const visits = await this.analytics.visitsByPage(projectId, days).catch(() => null);
    const urls = new Set<string>(gscPages.map((p) => p.key));
    if (onlyUrl) urls.add(onlyUrl);

    const crawl = job ? await this.crawlFacts(job.id, [...urls]) : new Map();

    const queryTargets = new Set(
      [...gscPages].sort((a, b) => b.impressions - a.impressions).slice(0, MAX_QUERY_PAGES).map((p) => p.key),
    );
    if (onlyUrl) queryTargets.add(onlyUrl);
    const queries = new Map<string, Awaited<ReturnType<SearchConsoleInsightsService['queriesForPage']>>>();
    await Promise.all(
      [...queryTargets].map(async (u) => queries.set(u, await this.search.queriesForPage(projectId, u, { days, limit: 25 }).catch(() => []))),
    );

    const aiSummary = checks.length
      ? {
          checks: checks.length,
          citedChecks: checks.filter((c) => c.cited).length,
          competitors: [...new Set(checks.flatMap((c) => c.competitorsCited))],
        }
      : null;

    const pages: PageFacts[] = [...urls].map((url) => {
      const g = gscPages.find((p) => p.key === url);
      const key = pathKey(url);
      const v = visits?.get(key) ?? null;
      return {
        url,
        path: key,
        search: g ? { clicks: g.clicks, impressions: g.impressions, ctr: g.ctr, position: g.position, queries: queries.get(url) ?? [] } : null,
        analytics: v ? { sessions: v.sessions, engagementRate: v.engagementRate, conversions: v.conversions } : null,
        crawl: crawl.get(key) ?? null,
        competitors: keywordGaps,
        ai: aiSummary
          ? {
              checks: aiSummary.checks,
              citedChecks: aiSummary.citedChecks,
              citedThisPage: checks.filter((c) => c.cited && c.citedUrl && pathKey(c.citedUrl) === key).length,
              competitorsCited: aiSummary.competitors,
            }
          : null,
      };
    });

    const trends = await this.trends(projectId, days, start, priorStart, searchSummary, analyticsSummary, checks, priorChecks, profile?.websiteUri ?? null, visits);
    const aiFindings = this.aiSiteFinding(aiSummary);
    const crawlProblems = job ? await this.crawlProblems(job.id) : { findings: [], evidence: [] };
    return { site, pages, trends, aiFindings, crawlProblems };
  }

  private async crawlFacts(jobId: string, urls: string[]) {
    const keys = new Set(urls.map(pathKey));
    const rows = await this.prisma.page.findMany({
      where: { crawlJobId: jobId },
      select: {
        id: true, url: true, title: true, metaDescription: true, h1: true, wordCount: true, pageType: true, indexability: true,
      },
    });
    const wanted = rows.filter((r) => keys.has(pathKey(r.url)));
    const ids = wanted.map((r) => r.id);

    const [inbound, schemas, issues] = await Promise.all([
      this.prisma.link.groupBy({
        by: ['targetUrl'],
        where: { linkType: 'INTERNAL', sourcePage: { crawlJobId: jobId } },
        _count: { _all: true },
      }),
      this.prisma.schema.findMany({ where: { pageId: { in: ids } }, select: { pageId: true, schemaType: true } }),
      this.prisma.issue.findMany({
        where: { crawlJobId: jobId, pageId: { in: ids }, status: 'OPEN' },
        select: { id: true, pageId: true, issueType: true, severity: true, description: true, recommendation: true, evidence: true, aiFixAvailable: true },
      }),
    ]);
    const inboundByKey = new Map<string, number>();
    for (const row of inbound) {
      const k = pathKey(row.targetUrl);
      inboundByKey.set(k, (inboundByKey.get(k) ?? 0) + row._count._all);
    }

    const out = new Map<string, NonNullable<PageFacts['crawl']>>();
    for (const r of wanted) {
      out.set(pathKey(r.url), {
        title: r.title,
        metaDescription: r.metaDescription,
        h1Count: r.h1.length,
        wordCount: r.wordCount,
        pageType: r.pageType,
        indexability: r.indexability,
        inboundLinks: inboundByKey.get(pathKey(r.url)) ?? 0,
        schemaTypes: [...new Set(schemas.filter((s) => s.pageId === r.id).map((s) => s.schemaType))],
        issues: issues
          .filter((i) => i.pageId === r.id)
          .map((i) => ({
            id: i.id,
            type: i.issueType,
            severity: i.severity as Finding['severity'],
            description: i.description,
            recommendation: i.recommendation,
            evidence: i.evidence,
            aiFixAvailable: i.aiFixAvailable,
          })),
      });
    }
    return out;
  }

  /** Critical and high crawl issues anywhere on the site, including pages with no traffic. */
  private async crawlProblems(jobId: string) {
    const rows = await this.prisma.issue.findMany({
      where: { crawlJobId: jobId, status: 'OPEN', severity: { in: ['CRITICAL', 'HIGH'] } },
      orderBy: [{ severity: 'asc' }],
      take: 30,
      select: { id: true, issueType: true, severity: true, affectedUrl: true, description: true, recommendation: true, evidence: true, aiFixAvailable: true },
    });
    const out = { findings: [] as Finding[], evidence: [] as Evidence[] };
    for (const r of rows) {
      const evidenceId = `crawl#${r.id}`;
      out.evidence.push({ id: evidenceId, source: 'CRAWL', text: `${r.description}${r.evidence ? ` Evidence: ${r.evidence}` : ''}`, data: { issueType: r.issueType, url: r.affectedUrl } });
      out.findings.push({
        id: `crawl#f${r.id}`,
        type: r.issueType,
        category: 'PROBLEM',
        severity: r.severity as Finding['severity'],
        url: r.affectedUrl,
        what: r.description,
        why: 'Found by the crawler; it affects how search engines or visitors read this page.',
        evidenceIds: [evidenceId],
        action: r.recommendation,
        expectedImpact: null,
        measurement: ['Re-crawl this page and confirm the issue no longer appears.'],
        potentialClicks: null,
        fixIssueId: r.aiFixAvailable ? r.id : null,
      });
    }
    return out;
  }

  private aiSiteFinding(ai: { checks: number; citedChecks: number; competitors: string[] } | null) {
    const out = { findings: [] as Finding[], evidence: [] as Evidence[] };
    if (!ai || ai.checks < THRESHOLDS.minAiChecks) return out;
    const rate = ai.citedChecks / ai.checks;
    if (rate >= 0.25) return out;
    const evidenceId = 'site#AI_VISIBILITY_LOW#e';
    out.evidence.push({
      id: evidenceId,
      source: 'AI_VISIBILITY',
      text: `AI assistants named the brand in ${ai.citedChecks} of ${ai.checks} checks (${(rate * 100).toFixed(0)}%).${ai.competitors.length ? ` Competitors named: ${ai.competitors.slice(0, 5).join(', ')}.` : ''}`,
      data: { checks: ai.checks, citedChecks: ai.citedChecks },
    });
    out.findings.push({
      id: 'site#AI_VISIBILITY_LOW',
      type: 'AI_VISIBILITY_LOW',
      category: 'PROBLEM',
      severity: 'MEDIUM',
      url: null,
      what: `The brand is rarely named by AI assistants for the questions being tracked (${ai.citedChecks} of ${ai.checks}).`,
      why: 'People asking AI assistants for recommendations are being pointed to other businesses.',
      evidenceIds: [evidenceId],
      action: 'See which answers cite competitors, and improve the pages those questions should lead to.',
      expectedImpact: null,
      measurement: ['Re-run the same questions and compare how often the brand is named.'],
      potentialClicks: null,
    });
    return out;
  }

  private async competitorRanks(projectId: string): Promise<CompetitorRankFact[] | null> {
    const snapshots = await this.prisma.keywordGapSnapshot.findMany({
      where: { projectId, error: null },
      orderBy: { fetchedAt: 'desc' },
      take: 20,
      select: { competitorDomain: true, rows: true },
    });
    if (snapshots.length === 0) return null;
    const seen = new Set<string>();
    const out: CompetitorRankFact[] = [];
    for (const snap of snapshots) {
      if (seen.has(snap.competitorDomain)) continue; // newest snapshot per competitor only
      seen.add(snap.competitorDomain);
      for (const row of (snap.rows as any[]) ?? []) {
        if (typeof row?.keyword !== 'string' || typeof row?.competitorPosition !== 'number') continue;
        out.push({
          keyword: row.keyword,
          competitor: snap.competitorDomain,
          competitorPosition: row.competitorPosition,
          competitorUrl: row.competitorUrl ?? null,
          ownPosition: typeof row.ownPosition === 'number' ? row.ownPosition : null,
        });
      }
    }
    return out;
  }

  private async trends(
    projectId: string,
    days: number,
    start: Date,
    priorStart: Date,
    searchSummary: Awaited<ReturnType<SearchConsoleInsightsService['summary']>>,
    analyticsSummary: Awaited<ReturnType<AnalyticsInsightsService['summary']>>,
    checks: { cited: boolean }[],
    priorChecks: { cited: boolean }[],
    gbpWebsite: string | null,
    visits: Awaited<ReturnType<AnalyticsInsightsService['visitsByPage']>>,
  ): Promise<SiteTrends> {
    const gbpSum = async (metric: string, from: Date, to: Date) => {
      const agg = await this.prisma.gbpDailyMetric.aggregate({
        where: { projectId, metric, date: { gte: from, lt: to } },
        _sum: { value: true },
        _count: { _all: true },
      });
      return agg._count._all > 0 ? (agg._sum.value ?? 0) : null;
    };
    const now = new Date();
    const gbp = async (metric: string): Promise<Movement | null> => {
      const [cur, prev] = await Promise.all([gbpSum(metric, start, now), gbpSum(metric, priorStart, start)]);
      return cur === null ? null : movement(cur, prev);
    };
    const [gbpWebsiteClicks, gbpCalls] = await Promise.all([gbp('WEBSITE_CLICKS'), gbp('CALL_CLICKS')]);

    const rate = (rows: { cited: boolean }[]) => (rows.length >= THRESHOLDS.minAiChecks ? (rows.filter((r) => r.cited).length / rows.length) * 100 : null);
    const aiNow = rate(checks);
    const aiBefore = rate(priorChecks);

    let gbpLanding: SiteTrends['gbpLanding'] = null;
    if (gbpWebsite && gbpWebsiteClicks) {
      const key = pathKey(gbpWebsite);
      const v = visits?.get(key) ?? null;
      gbpLanding = { websiteClicks: gbpWebsiteClicks.current, path: key, engagementRate: v?.engagementRate ?? null, conversions: v?.conversions ?? null };
    }

    return {
      searchClicks: searchSummary ? { current: searchSummary.clicks.current, previous: searchSummary.clicks.previous, changePct: searchSummary.clicks.changePct } : null,
      conversions: analyticsSummary?.conversions ? { current: analyticsSummary.conversions.current, previous: analyticsSummary.conversions.previous, changePct: analyticsSummary.conversions.changePct } : null,
      gbpWebsiteClicks,
      gbpCalls,
      aiCitationRatePct: aiNow === null ? null : { current: aiNow, previous: aiBefore, changePct: null },
      gbpLanding,
    };
  }
}
