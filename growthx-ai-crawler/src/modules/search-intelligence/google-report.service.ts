import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiProvider, AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { extractAndParseJson } from '../ai-engine/utils/json-extractor.util';
import { AnalyticsReportService, Ga4Range } from '../integrations/google/analytics-report.service';
import { SearchConsoleInsightsService } from '../integrations/google/search-console-insights.service';
import { GoogleAlertsService } from './google-alerts.service';
import { GoogleKeywordsService } from './google-keywords.service';
import { GoogleOverviewService, GoogleWindow } from './google-overview.service';
import { IndexStatusService } from './index-status.service';
import { GoogleReport, GoogleReportFacts, KpiFact, RowFact, buildPrompt, normaliseAnalysis } from './google-report';

const TOP = 20;

/** One read that may fail without costing the report the others; the failure is named, not hidden. */
async function attempt<T>(what: string, notMeasured: string[], run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (err) {
    notMeasured.push(`${what} could not be read: ${(err as Error).message}`.slice(0, 200));
    return null;
  }
}

function change(delta: { kind: 'pct' | 'pts' | 'places'; value: number } | null): string | null {
  if (!delta) return null;
  const v = Math.round(delta.value * 10) / 10;
  const sign = v >= 0 ? '+' : '−';
  return `${sign}${Math.abs(v)}${delta.kind === 'pct' ? '%' : delta.kind === 'pts' ? ' points' : ' places'}`;
}

/**
 * The Google improvement report: everything stored from Search Console and
 * Google Analytics 4, read by Sarvam, and turned into where the site stands
 * and what to do first.
 *
 * The model is given measured figures only and told to use nothing else. The
 * facts are returned with the analysis, so the report is still complete when
 * the model could not be reached, and nothing is asked of the model when
 * neither source has any data.
 */
@Injectable()
export class GoogleReportService {
  private readonly logger = new Logger(GoogleReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly google: GoogleOverviewService,
    private readonly gsc: SearchConsoleInsightsService,
    private readonly reports: AnalyticsReportService,
    private readonly keywords: GoogleKeywordsService,
    private readonly alerts: GoogleAlertsService,
    private readonly indexStatus: IndexStatusService,
    private readonly router: MultiAiRouterService,
  ) {}

  async gatherFacts(projectId: string, days: GoogleWindow = 28): Promise<GoogleReportFacts> {
    const notMeasured: string[] = [];
    const [overview, project] = await Promise.all([
      this.google.overview(projectId, days),
      this.prisma.project.findUnique({ where: { id: projectId }, select: { websites: { select: { domain: true }, take: 1 } } }),
    ]);
    const sc = overview.sources.searchConsole;
    const ga = overview.sources.analytics;
    const searchOn = sc.connected && sc.hasData;

    const asRows = (rows: Array<{ key: string; clicks: number; impressions: number; ctr: number; position: number }>, extra?: (r: any) => string): RowFact[] =>
      rows.map((r) => ({ key: r.key, clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position, extra: extra?.(r) }));

    const [queries, pages, striking, ctr, declining, kw, alerts, index, ga4] = await Promise.all([
      searchOn ? attempt('Top queries', notMeasured, () => this.gsc.top(projectId, 'QUERY', { days, limit: TOP })) : null,
      searchOn ? attempt('Top pages', notMeasured, () => this.gsc.top(projectId, 'PAGE', { days, limit: TOP })) : null,
      searchOn ? attempt('Queries near page one', notMeasured, () => this.gsc.strikingDistance(projectId, { days, limit: 15 })) : null,
      searchOn ? attempt('Click-through opportunities', notMeasured, () => this.gsc.ctrOpportunities(projectId, { days, limit: 10 })) : null,
      searchOn ? attempt('Declining queries', notMeasured, () => this.gsc.declining(projectId, { days, limit: 10 })) : null,
      searchOn ? attempt('New and rising keywords', notMeasured, () => this.keywords.keywords(projectId, days)) : null,
      searchOn || ga.hasData ? attempt('Alerts', notMeasured, () => this.alerts.alerts(projectId, days)) : null,
      sc.connected ? attempt('Index status', notMeasured, () => this.indexStatus.report(projectId)) : null,
      ga.connected ? attempt('Analytics report', notMeasured, () => this.reports.read(projectId, `${days}d` as Ga4Range)) : null,
    ]);

    if (!sc.connected) notMeasured.push('Search Console is not connected, so nothing about search visibility is measured.');
    else if (!sc.hasData) notMeasured.push('Search Console is connected but nothing has been fetched from it yet.');
    if (!ga.connected) notMeasured.push('Google Analytics 4 is not connected, so nothing about visitors is measured.');
    else if (!ga.hasData) notMeasured.push('Google Analytics 4 is connected but has recorded no sessions for this period.');
    if (searchOn && declining?.length === 0 && !overview.kpis.some((k) => k.source === 'GSC' && k.delta)) {
      notMeasured.push('No earlier Search Console period is stored, so losses and gains cannot be compared yet.');
    }

    const kpis: KpiFact[] = overview.kpis.map((k) => ({
      label: k.label,
      source: k.source,
      format: k.format,
      value: k.value,
      previous: k.previous,
      change: change(k.delta),
      note: k.note,
    }));

    const data = ga4 && ga4.data && !ga4.data.empty ? ga4.data : null;
    const total = data ? data.channels.reduce((s, c) => s + c.sessions, 0) || data.totals.sessions : 0;
    const traffic = data
      ? {
          sessions: data.totals.sessions,
          users: data.totals.activeUsers,
          engagementRate: data.totals.engagementRate,
          keyEvents: data.totals.keyEvents,
          channels: [...data.channels]
            .sort((a, b) => b.sessions - a.sessions)
            .slice(0, 8)
            .map((c) => ({
              channel: c.channel,
              sessions: c.sessions,
              share: total > 0 ? c.sessions / total : 0,
              engagementRate: c.engagementRate ?? null,
              keyEvents: c.keyEvents ?? null,
            })),
          landingPages: [...data.landingPages].sort((a, b) => b.sessions - a.sessions).slice(0, TOP),
          sources: [...(data.sources ?? [])]
            .sort((a, b) => b.sessions - a.sessions)
            .slice(0, 15)
            .map((x) => ({ ...x, share: total > 0 ? x.sessions / total : 0 })),
          countries: [...data.countries].sort((a, b) => b.sessions - a.sessions).slice(0, 5).map((c) => ({ country: c.country, sessions: c.sessions })),
          cities: [...(data.cities ?? [])].sort((a, b) => b.sessions - a.sessions).slice(0, 8).map((c) => ({ city: c.city, country: c.country, sessions: c.sessions })),
        }
      : null;

    const alertList = alerts?.comparable ? alerts.alerts.slice(0, 8).map((a: any) => `${a.title}. ${a.detail}`) : [];

    return {
      days,
      site: project?.websites[0]?.domain ?? null,
      searchConsole: { connected: sc.connected, hasData: sc.hasData, lastSyncedAt: sc.lastSyncedAt, propertyName: sc.propertyName },
      analytics: { connected: ga.connected, hasData: ga.hasData, lastSyncedAt: ga.lastSyncedAt, propertyName: ga.propertyName },
      kpis,
      topQueries: asRows(queries ?? []),
      topPages: asRows(pages ?? []),
      strikingDistance: asRows(striking ?? []),
      ctrOpportunities: asRows(ctr ?? [], (r) => `expected CTR about ${(r.expectedCtr * 100).toFixed(1)}% here, roughly ${r.estimatedMissedClicks} clicks missed`),
      decliningQueries: (declining ?? []).map((q) => ({
        query: q.query,
        previousPosition: q.previousPosition,
        currentPosition: q.currentPosition,
        previousClicks: q.previousClicks,
        currentClicks: q.currentClicks,
      })),
      newQueries: (kw?.new ?? []).slice(0, 8).map((q) => q.query),
      cannibalization: (kw?.cannibalization ?? []).slice(0, 5).map((c) => `"${c.query}" is answered by ${c.pages.map((p) => p.page).join(' and ')}`),
      index:
        index && index.connected && index.totals.asked > 0
          ? {
              asked: index.totals.asked,
              indexed: index.totals.indexed,
              notIndexed: index.totals.notIndexed,
              indexableButNotIndexed: index.indexableButNotIndexed.length,
              canonicalOverridden: index.canonicalOverridden.length,
              topReasons: index.groups
                .filter((g) => g.verdict !== 'PASS')
                .slice(0, 4)
                .map((g) => ({ state: g.coverageState, count: g.count })),
            }
          : null,
      alerts: alertList,
      traffic,
      notMeasured,
    };
  }

  async generate(projectId: string, organizationId?: string, days: GoogleWindow = 28): Promise<GoogleReport> {
    const report = await this.write(projectId, organizationId, days);
    return { ...report, snapshotId: await this.store(projectId, report) };
  }

  /** The most recently generated report for a project, or null when none was ever made. */
  async latest(projectId: string): Promise<GoogleReport | null> {
    const row = await this.prisma.googleReportSnapshot.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, report: true },
    });
    return row ? { ...(row.report as unknown as GoogleReport), snapshotId: row.id } : null;
  }

  /** Kept so the report can be read again; a failed save never loses the report itself. */
  private async store(projectId: string, report: GoogleReport): Promise<string | null> {
    try {
      const row = await this.prisma.googleReportSnapshot.create({ data: { projectId, report: report as any }, select: { id: true } });
      return row.id;
    } catch (err) {
      this.logger.warn(`[${projectId}] Google report could not be stored: ${(err as Error).message}`);
      return null;
    }
  }

  private async write(projectId: string, organizationId: string | undefined, days: GoogleWindow): Promise<GoogleReport> {
    const facts = await this.gatherFacts(projectId, days);
    const base = { generatedAt: new Date().toISOString(), facts };

    const noData = (!facts.searchConsole.connected || !facts.searchConsole.hasData) && (!facts.analytics.connected || !facts.analytics.hasData);
    if (noData) {
      return {
        ...base,
        analysis: null,
        model: null,
        analysisError: 'Neither Search Console nor Google Analytics 4 has any data yet, so there is nothing to analyse. Connect them in Integrations and refresh the data.',
      };
    }

    try {
      const completion = await this.router.generate({
        prompt: buildPrompt(facts),
        systemInstruction:
          'You are a senior SEO strategist writing for a business owner. Read their Google Search Console and Google Analytics 4 ' +
          'figures, say plainly where the site stands, and say what to do first. Use only the facts given. ' +
          'Never invent rankings, traffic, revenue or numbers not in the facts. Reply with valid JSON only.',
        task: AiTask.SEO_ANALYSIS,
        provider: AiProvider.SARVAM,
        // The customer asked for Sarvam; a different vendor's analysis would be presented under the wrong name.
        allowFallback: false,
        organizationId,
        projectId,
        maxTokens: 6000,
      });
      if (completion.refused || !completion.text.trim()) {
        return { ...base, analysis: null, model: completion.model, analysisError: 'Sarvam returned no analysis. Try again.' };
      }
      return { ...base, analysis: normaliseAnalysis(extractAndParseJson(completion.text)), model: completion.model, analysisError: null };
    } catch (err) {
      this.logger.warn(`[${projectId}] Google report analysis failed: ${(err as Error).message}`);
      return {
        ...base,
        analysis: null,
        model: null,
        analysisError: `The analysis could not be written: ${(err as Error).message}`.slice(0, 400),
      };
    }
  }
}
