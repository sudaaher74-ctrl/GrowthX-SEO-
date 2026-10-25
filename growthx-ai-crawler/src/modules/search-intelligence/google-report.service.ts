import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiProvider, AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { extractAndParseJson } from '../ai-engine/utils/json-extractor.util';
import { AnalyticsReportService, Ga4Range } from '../integrations/google/analytics-report.service';
import { SearchConsoleInsightsService } from '../integrations/google/search-console-insights.service';
import { FindingSyncService } from '../opportunities/finding-sync.service';
import { GoogleAlertsService } from './google-alerts.service';
import { GoogleKeywordsService } from './google-keywords.service';
import { GoogleOverviewService, GoogleWindow } from './google-overview.service';
import { IndexStatusService } from './index-status.service';
import {
  BusinessTrafficContext,
  GoogleReport,
  GoogleReportFacts,
  KpiFact,
  LocationTrafficGap,
  RowFact,
  buildPrompt,
  enrichAnalysisWithBusinessGaps,
  normaliseAnalysis,
} from './google-report';

const TOP = 20;

const KNOWN_CITIES = [
  'Mumbai', 'Navi Mumbai', 'Thane', 'Pune', 'Nashik', 'Nagpur', 'Aurangabad', 'Chhatrapati Sambhajinagar',
  'Kolhapur', 'Solapur', 'Sangli', 'Satara', 'Ahmednagar', 'Jalgaon', 'Ratnagiri', 'Baramati',
  'Delhi', 'New Delhi', 'Noida', 'Gurugram', 'Gurgaon', 'Bengaluru', 'Bangalore', 'Hyderabad',
  'Chennai', 'Kolkata', 'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Jaipur', 'Lucknow', 'Indore',
  'Bhopal', 'Chandigarh', 'Kochi', 'Coimbatore', 'Visakhapatnam', 'Patna', 'Guwahati',
  'Dubai', 'Abu Dhabi', 'London', 'Manchester', 'New York', 'San Francisco', 'Los Angeles',
  'Chicago', 'Austin', 'Seattle', 'Toronto', 'Vancouver', 'Sydney', 'Melbourne', 'Singapore',
];

function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function titleCaseCity(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ');
}

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
    @Optional() private readonly findingSync?: FindingSyncService,
  ) {}

  async gatherFacts(projectId: string, days: GoogleWindow = 28, customCities?: string[]): Promise<GoogleReportFacts> {
    const notMeasured: string[] = [];
    const [overview, project] = await Promise.all([
      this.google.overview(projectId, days),
      this.prisma.project.findUnique({
        where: { id: projectId },
        select: {
          name: true,
          businessProfile: true,
          websites: { select: { id: true, domain: true }, take: 1 },
        },
      }),
    ]);
    const sc = overview.sources.searchConsole;
    const ga = overview.sources.analytics;
    const searchOn = sc.connected && sc.hasData;

    const asRows = (rows: Array<{ key: string; clicks: number; impressions: number; ctr: number; position: number }>, extra?: (r: any) => string): RowFact[] =>
      rows.map((r) => ({ key: r.key, clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position, extra: extra?.(r) }));

    const [queries, pages, striking, ctr, declining, kw, alerts, index, ga4, business] = await Promise.all([
      searchOn ? attempt('Top queries', notMeasured, () => this.gsc.top(projectId, 'QUERY', { days, limit: TOP })) : null,
      searchOn ? attempt('Top pages', notMeasured, () => this.gsc.top(projectId, 'PAGE', { days, limit: TOP })) : null,
      searchOn ? attempt('Queries near page one', notMeasured, () => this.gsc.strikingDistance(projectId, { days, limit: 15 })) : null,
      searchOn ? attempt('Click-through opportunities', notMeasured, () => this.gsc.ctrOpportunities(projectId, { days, limit: 10 })) : null,
      searchOn ? attempt('Declining queries', notMeasured, () => this.gsc.declining(projectId, { days, limit: 10 })) : null,
      searchOn ? attempt('New and rising keywords', notMeasured, () => this.keywords.keywords(projectId, days)) : null,
      searchOn || ga.hasData ? attempt('Alerts', notMeasured, () => this.alerts.alerts(projectId, days)) : null,
      sc.connected ? attempt('Index status', notMeasured, () => this.indexStatus.report(projectId)) : null,
      ga.connected ? attempt('Analytics report', notMeasured, () => this.reports.read(projectId, `${days}d` as Ga4Range)) : null,
      this.gatherBusinessFromAudit(projectId, project, customCities),
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
    const topQueriesList = asRows(queries ?? []);
    const locationGaps = this.computeLocationGaps(days, business, traffic, topQueriesList, kpis);

    return {
      days,
      site: project?.websites[0]?.domain ?? null,
      searchConsole: { connected: sc.connected, hasData: sc.hasData, lastSyncedAt: sc.lastSyncedAt, propertyName: sc.propertyName },
      analytics: { connected: ga.connected, hasData: ga.hasData, lastSyncedAt: ga.lastSyncedAt, propertyName: ga.propertyName },
      kpis,
      topQueries: topQueriesList,
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
      business,
      locationGaps,
      notMeasured,
    };
  }

  async generate(
    projectId: string,
    organizationId?: string,
    days: GoogleWindow = 28,
    customCities?: string[],
  ): Promise<GoogleReport> {
    const report = await this.write(projectId, organizationId, days, customCities);
    const snapshotId = await this.store(projectId, report);
    let forwardedToFixEngine = (report.analysis?.priorities.length ?? 0) + (report.facts.locationGaps?.filter((g) => g.status !== 'ACTIVE').length ?? 0);
    if (this.findingSync) {
      try {
        const synced = await this.findingSync.syncProject(projectId);
        forwardedToFixEngine = Math.max(forwardedToFixEngine, synced.created + synced.updated);
      } catch (err) {
        this.logger.warn(`[${projectId}] Traffic report sync to Fix Engine failed: ${(err as Error).message}`);
      }
    }
    return { ...report, snapshotId, forwardedToFixEngine };
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

  private async write(
    projectId: string,
    organizationId: string | undefined,
    days: GoogleWindow,
    customCities?: string[],
  ): Promise<GoogleReport> {
    const facts = await this.gatherFacts(projectId, days, customCities);
    const base = { generatedAt: new Date().toISOString(), facts };

    const noGoogleData =
      (!facts.searchConsole.connected || !facts.searchConsole.hasData) &&
      (!facts.analytics.connected || !facts.analytics.hasData);
    const hasBusinessContext = Boolean(facts.business && (facts.business.pagesAudited > 0 || facts.business.businessName || facts.business.targetCities.length > 0));

    if (noGoogleData && !hasBusinessContext) {
      return {
        ...base,
        analysis: enrichAnalysisWithBusinessGaps(null, facts),
        model: 'GrowthX Business & Traffic Planner',
        analysisError: null,
      };
    }

    try {
      const completion = await this.router.generate({
        prompt: buildPrompt(facts),
        systemInstruction:
          'You are a senior SEO strategist writing for a business owner. Read their Website Audit business context, Google Search Console, and Google Analytics 4 ' +
          'figures, say plainly where the site stands, identify any cities/markets where the business operates that have 0 clicks or low traffic, and say what to do first. Use only the facts given. ' +
          'Never invent rankings, traffic, revenue or numbers not in the facts. Reply with valid JSON only.',
        task: AiTask.SEO_ANALYSIS,
        provider: AiProvider.SARVAM,
        allowFallback: true,
        organizationId,
        projectId,
        maxTokens: 6000,
      });
      if (completion.refused || !completion.text.trim()) {
        return {
          ...base,
          analysis: enrichAnalysisWithBusinessGaps(null, facts),
          model: completion.model || 'GrowthX Business & Traffic Planner',
          analysisError: null,
        };
      }
      const parsed = normaliseAnalysis(extractAndParseJson(completion.text));
      return {
        ...base,
        analysis: enrichAnalysisWithBusinessGaps(parsed, facts),
        model: completion.model,
        analysisError: null,
      };
    } catch (err) {
      this.logger.warn(`[${projectId}] Google report AI analysis fallback used: ${(err as Error).message}`);
      return {
        ...base,
        analysis: enrichAnalysisWithBusinessGaps(null, facts),
        model: 'GrowthX Business & Traffic Planner',
        analysisError: null,
      };
    }
  }

  /**
   * Reads the user's business profile and Website Audit crawl pages to understand
   * what the business sells, its core service pages, and which cities/locations it serves.
   */
  private async gatherBusinessFromAudit(
    projectId: string,
    project: {
      name: string;
      businessProfile: any;
      websites: Array<{ id: string; domain: string }>;
    } | null,
    customCities?: string[],
  ): Promise<BusinessTrafficContext | null> {
    if (!project) return null;
    const website = project.websites[0];
    const profile = project.businessProfile;

    let pagesAudited = 0;
    let crawledAt: string | null = null;
    let healthScore: number | null = null;
    const auditedPages: Array<{ path: string; title: string }> = [];
    const detectedCities = new Set<string>();
    const detectedOfferings = new Set<string>();
    let fallbackSummary: string | null = null;

    const addCity = (c: string | null | undefined) => {
      if (!c) return;
      const cleaned = titleCaseCity(c.replace(/[^a-zA-Z\s-]/g, ''));
      if (cleaned.length >= 3 && cleaned.length <= 40) {
        detectedCities.add(cleaned);
      }
    };

    if (Array.isArray(customCities)) {
      for (const c of customCities) addCity(c);
    }

    if (profile?.city) addCity(profile.city);
    if (Array.isArray(profile?.signals)) {
      for (const sig of profile.signals as string[]) {
        if (typeof sig === 'string' && sig.startsWith('targetCities:')) {
          sig
            .slice('targetCities:'.length)
            .split(',')
            .forEach((c) => addCity(c));
        }
      }
    }
    if (Array.isArray(profile?.offerings)) {
      for (const o of profile.offerings) {
        if (typeof o === 'string' && o.trim()) detectedOfferings.add(o.trim());
      }
    }

    // Persist custom target cities onto ProjectBusinessProfile if provided by the user
    if (Array.isArray(customCities) && customCities.length > 0 && website) {
      const normalizedCustom = customCities.map((c) => titleCaseCity(c)).filter(Boolean);
      if (normalizedCustom.length > 0) {
        try {
          const existingSignals = Array.isArray(profile?.signals)
            ? (profile.signals as string[]).filter((s) => !s.startsWith('targetCities:'))
            : [];
          const nextSignals = [...existingSignals, `targetCities:${normalizedCustom.join(',')}`];
          await this.prisma.projectBusinessProfile.upsert({
            where: { projectId },
            update: {
              city: normalizedCustom[0],
              signals: nextSignals,
            },
            create: {
              projectId,
              domain: website.domain,
              businessName: profile?.businessName || project.name || website.domain,
              industry: profile?.industry || 'Business Services',
              city: normalizedCustom[0],
              signals: nextSignals,
            },
          });
        } catch (err) {
          this.logger.debug(`Could not persist custom target cities for ${projectId}: ${(err as Error).message}`);
        }
      }
    }

    if (website) {
      try {
        const crawlJob = await this.prisma.crawlJob.findFirst({
          where: { websiteId: website.id, status: 'COMPLETED' },
          orderBy: { finishedAt: 'desc' },
          select: { id: true, finishedAt: true, healthScore: true, pagesCrawled: true },
        });
        if (crawlJob) {
          crawledAt = crawlJob.finishedAt ? crawlJob.finishedAt.toISOString() : null;
          healthScore = crawlJob.healthScore ?? null;
          const crawledPages = await this.prisma.page.findMany({
            where: { crawlJobId: crawlJob.id, statusCode: { gte: 200, lt: 300 } },
            take: 60,
            orderBy: { url: 'asc' },
            select: {
              url: true,
              title: true,
              h1: true,
              h2: true,
              metaDescription: true,
              pageType: true,
              schemas: { select: { schemaType: true, rawJson: true } },
            },
          });
          pagesAudited = crawlJob.pagesCrawled || crawledPages.length;

          const textCorpus: string[] = [];
          for (const p of crawledPages) {
            let path = p.url;
            try {
              path = new URL(p.url).pathname || '/';
            } catch {
              // keep raw path
            }
            const title = (p.title ?? '').trim();
            if (title && auditedPages.length < 15) {
              auditedPages.push({ path, title });
            }
            if (path === '/' && p.metaDescription && !fallbackSummary) {
              fallbackSummary = p.metaDescription.trim();
            }
            if (title && detectedOfferings.size < 6 && !['LEGAL', 'CONTACT', 'STATIC'].includes(p.pageType)) {
              const cleanHeading = (p.h1?.[0] || title.split('|')[0].split('–')[0].split('-')[0] || '').trim();
              if (cleanHeading && cleanHeading.length > 3 && cleanHeading.length < 65) {
                detectedOfferings.add(cleanHeading);
              }
            }
            textCorpus.push(title, ...(p.h1 ?? []), ...(p.h2 ?? []).slice(0, 5), p.metaDescription ?? '', path);

            for (const s of p.schemas ?? []) {
              const raw = s.rawJson as Record<string, any> | null;
              if (!raw || typeof raw !== 'object') continue;
              const addr = raw.address;
              if (addr && typeof addr === 'object' && typeof addr.addressLocality === 'string') {
                addCity(addr.addressLocality);
              }
              const area = raw.areaServed;
              if (typeof area === 'string') addCity(area);
              else if (Array.isArray(area)) {
                for (const a of area) {
                  if (typeof a === 'string') addCity(a);
                  else if (a && typeof a.name === 'string') addCity(a.name);
                }
              } else if (area && typeof area.name === 'string') {
                addCity(area.name);
              }
            }
          }

          const joinedLower = ` ${textCorpus.join(' ').toLowerCase()} `;
          for (const city of KNOWN_CITIES) {
            const pattern = new RegExp(`\\b${city.toLowerCase()}\\b`, 'i');
            if (pattern.test(joinedLower)) {
              addCity(city);
            }
          }
        }
      } catch (err) {
        this.logger.debug(`Website Audit page read skipped in GoogleReportService: ${(err as Error).message}`);
      }
    }

    const targetCities = Array.from(detectedCities).slice(0, 8);
    return {
      businessName: profile?.businessName || project.name || website?.domain || null,
      industry: profile?.industry || null,
      summary: profile?.summary || fallbackSummary || null,
      businessModel: profile?.businessModel || null,
      targetAudience: profile?.targetAudience || null,
      businessGoal: profile?.businessGoal || null,
      offerings: Array.from(detectedOfferings).slice(0, 8),
      targetCities,
      primaryCity: targetCities[0] || profile?.city || null,
      state: profile?.state || null,
      country: profile?.country || null,
      seedKeywords: Array.isArray(profile?.seedKeywords) ? profile.seedKeywords : [],
      pagesAudited,
      crawledAt,
      healthScore,
      auditedPages,
    };
  }

  /**
   * Compares the cities/markets where the user's business operates (from Website Audit & Business Profile)
   * against actual GA4 visitor sessions and Google Search Console clicks, highlighting areas with 0 clicks
   * or low traffic and creating a concrete plan to improve traffic quality and local acquisition.
   */
  private computeLocationGaps(
    days: number,
    business: BusinessTrafficContext | null,
    traffic: GoogleReportFacts['traffic'],
    topQueries: RowFact[],
    kpis: KpiFact[],
  ): LocationTrafficGap[] {
    const offerings = business?.offerings?.length
      ? business.offerings.slice(0, 3)
      : business?.industry
        ? [business.industry]
        : ['core products and services'];
    const offeringText = offerings.slice(0, 2).join(' & ');
    const brand = business?.businessName || 'your business';

    const locations: Array<{ name: string; source: LocationTrafficGap['source'] }> = [];
    const seen = new Set<string>();
    const pushLoc = (name: string | null | undefined, source: LocationTrafficGap['source']) => {
      if (!name || !name.trim()) return;
      const key = name.trim().toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      locations.push({ name: name.trim(), source });
    };

    for (const c of business?.targetCities ?? []) {
      pushLoc(c, c === business?.primaryCity ? 'business_profile' : 'website_audit');
    }
    if (locations.length === 0 && business?.state) {
      pushLoc(business.state, 'business_profile');
    }
    if (locations.length === 0 && business?.country) {
      pushLoc(business.country, 'business_profile');
    }
    if (locations.length === 0 && traffic?.countries?.length) {
      pushLoc(traffic.countries[0].country, 'target_market');
    }
    if (locations.length === 0) {
      pushLoc('Primary Local Market', 'target_market');
    }

    const totalSearchClicks = kpis.find((k) => k.label.toLowerCase().includes('click'))?.value ?? 0;
    const totalImpressions = kpis.find((k) => k.label.toLowerCase().includes('impression'))?.value ?? 0;

    return locations.map(({ name: location, source }): LocationTrafficGap => {
      const locLower = location.toLowerCase();
      const citySessions = (traffic?.cities ?? [])
        .filter((c) => c.city.toLowerCase().includes(locLower) || locLower.includes(c.city.toLowerCase()))
        .reduce((sum, c) => sum + (c.sessions || 0), 0);
      const countrySessions = (traffic?.countries ?? [])
        .filter((c) => c.country.toLowerCase() === locLower)
        .reduce((sum, c) => sum + (c.sessions || 0), 0);
      const sessions = citySessions || countrySessions;

      const matchingQueries = topQueries.filter((q) => q.key.toLowerCase().includes(locLower));
      const queryClicks = matchingQueries.reduce((sum, q) => sum + (q.clicks || 0), 0);
      const queryImpressions = matchingQueries.reduce((sum, q) => sum + (q.impressions || 0), 0);

      // If this is the sole/primary market and total clicks are 0, reflect the overall impression count
      const searchClicks = matchingQueries.length > 0 ? queryClicks : locations.length === 1 ? (totalSearchClicks ?? 0) : 0;
      const searchImpressions = matchingQueries.length > 0 ? queryImpressions : locations.length === 1 ? (totalImpressions ?? 0) : 0;

      const matchingPages = (business?.auditedPages ?? [])
        .filter((p) => p.path.toLowerCase().includes(locLower) || p.title.toLowerCase().includes(locLower))
        .map((p) => p.path);

      const status: LocationTrafficGap['status'] =
        searchClicks === 0 && sessions === 0
          ? 'NO_CLICKS'
          : searchClicks === 0 || sessions < 5
            ? 'LOW_TRAFFIC'
            : 'ACTIVE';

      const targetUrl = matchingPages[0] || `/locations/${slugify(location)}`;

      const finding =
        status === 'NO_CLICKS'
          ? `Website Audit shows ${brand} targets ${location} for ${offeringText}, but Traffic recorded 0 search clicks and 0 visitor sessions from ${location} in the last ${days} days.`
          : status === 'LOW_TRAFFIC'
            ? `Your business serves ${location} (${offeringText}), but Traffic recorded only ${sessions} visitor session${sessions === 1 ? '' : 's'} and ${searchClicks} search click${searchClicks === 1 ? '' : 's'}${searchImpressions > 0 ? ` (${searchImpressions} impressions)` : ''} in the last ${days} days.`
            : `${location} is actively sending traffic (${sessions} sessions, ${searchClicks} search clicks in ${days} days).`;

      const plan =
        status === 'NO_CLICKS'
          ? `Launch local search capture for ${location}: build or optimize ${targetUrl} around "${offeringText} in ${location}", add LocalBusiness areaServed schema, and align titles/meta descriptions with high-intent buyer searches in ${location}.`
          : status === 'LOW_TRAFFIC'
            ? `Convert existing search visibility in ${location} into clicks and qualified sessions by upgrading page titles, local trust signals, and internal links to ${matchingPages[0] || '/'}.`
            : `Scale high-converting traffic from ${location} by expanding commercial keyword coverage and conversion paths on ${matchingPages[0] || '/'}.`;

      const recommendedSteps = [
        `Optimize ${matchingPages[0] || `your primary service page (or create ${targetUrl})`} with "${offeringText} in ${location}" in the page title, H1 headline, and opening paragraph.`,
        `Add LocalBusiness / Service JSON-LD schema declaring areaServed: "${location}" and include local delivery, service coverage, or customer proof for ${location}.`,
        `Target high-intent local search terms ("best ${offerings[0]} in ${location}", "${offerings[0]} near ${location}") in meta descriptions to lift Google CTR from 0% and submit in Search Console.`,
      ];

      return {
        location,
        source,
        sessions,
        searchClicks,
        searchImpressions,
        status,
        finding,
        plan,
        recommendedSteps,
        relevantOfferings: offerings,
        matchingPages,
      };
    });
  }
}
