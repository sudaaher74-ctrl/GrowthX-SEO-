import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { DataForSeoError, DataForSeoService, NOT_CONFIGURED_MESSAGE, RankedKeyword } from './dataforseo.service';
import { bareDomain, ownSite } from './own-site';
import { resolveMarket } from './search-market';

export interface GapRow {
  keyword: string;
  searchVolume: number | null;
  competitorPosition: number;
  competitorUrl: string | null;
  /** Your position, null when you are not in Google's top 100 for it. */
  ownPosition: number | null;
  /** Where your position came from. */
  ownSource: 'GOOGLE_RANKINGS' | 'SEARCH_CONSOLE' | null;
  /** MISSING: you do not rank at all. BEHIND: you rank, but well below them. */
  status: 'MISSING' | 'BEHIND';
  intent: string | null;
}

const CACHE_DAYS = 7;
const MAX_COMPETITORS = 5;

function key(keyword: string): string {
  return keyword.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * The keywords a competitor ranks for that you do not, or rank far below them
 * on. Your side is taken from Google's rankings for your domain and, where
 * those miss a search, from Search Console, so a search you do appear for is
 * never reported as missing.
 */
export function computeGaps(
  competitor: RankedKeyword[],
  own: RankedKeyword[],
  searchConsole: Map<string, number>,
): GapRow[] {
  const ownByKey = new Map(own.map((k) => [key(k.keyword), k.position]));
  const rows: GapRow[] = [];
  for (const k of competitor) {
    const id = key(k.keyword);
    const fromGoogle = ownByKey.get(id);
    const fromGsc = searchConsole.get(id);
    const ownPosition = fromGoogle ?? (fromGsc !== undefined ? Math.round(fromGsc) : null);
    const ownSource = fromGoogle !== undefined ? 'GOOGLE_RANKINGS' : fromGsc !== undefined ? 'SEARCH_CONSOLE' : null;

    let status: GapRow['status'] | null = null;
    if (ownPosition === null) status = 'MISSING';
    else if (k.position <= 10 && ownPosition > 20) status = 'BEHIND';
    if (!status) continue;

    rows.push({
      keyword: k.keyword,
      searchVolume: k.searchVolume,
      competitorPosition: k.position,
      competitorUrl: k.url,
      ownPosition,
      ownSource,
      status,
      intent: k.intent,
    });
  }
  return rows.sort((a, b) => (b.searchVolume ?? -1) - (a.searchVolume ?? -1) || a.competitorPosition - b.competitorPosition);
}

@Injectable()
export class KeywordGapService {
  private readonly logger = new Logger(KeywordGapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dataforseo: DataForSeoService,
  ) {}

  /** Search Console positions for every search the site appeared in over 90 days. */
  private async searchConsolePositions(projectId: string): Promise<Map<string, number>> {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.gscDailyMetric.findMany({
      where: { projectId, grain: 'QUERY', date: { gte: since }, query: { not: null }, impressions: { gt: 0 } },
      select: { query: true, impressions: true, position: true },
    });
    const acc = new Map<string, { weighted: number; impressions: number }>();
    for (const r of rows) {
      const id = key(r.query!);
      const a = acc.get(id) ?? { weighted: 0, impressions: 0 };
      a.weighted += r.position * r.impressions;
      a.impressions += r.impressions;
      acc.set(id, a);
    }
    return new Map([...acc.entries()].map(([k, a]) => [k, a.weighted / a.impressions]));
  }

  /** The latest stored gaps for each tracked competitor. Reads only; spends nothing. */
  async latest(projectId: string) {
    const [competitors, market] = await Promise.all([
      this.prisma.competitorDomain.findMany({ where: { projectId }, select: { domain: true, label: true }, take: MAX_COMPETITORS }),
      resolveMarket(this.prisma, projectId),
    ]);
    const perCompetitor = [];
    for (const c of competitors) {
      const domain = bareDomain(c.domain) ?? c.domain;
      const snap = await this.prisma.keywordGapSnapshot.findFirst({
        where: { projectId, competitorDomain: domain },
        orderBy: { fetchedAt: 'desc' },
      });
      perCompetitor.push(this.present(domain, c.label, snap));
    }
    return { connected: this.dataforseo.isConfigured(), market, competitors: perCompetitor, shared: sharedGaps(perCompetitor) };
  }

  private present(domain: string, label: string | null, snap: { fetchedAt: Date; rows: Prisma.JsonValue; competitorKeywordsRead: number; ownKeywordsRead: number; error: string | null; country: string } | null) {
    const rows = ((snap?.rows as unknown as GapRow[]) ?? []).slice(0, 200);
    return {
      domain,
      label,
      fetchedAt: snap?.fetchedAt ?? null,
      country: snap?.country ?? null,
      error: snap?.error ?? null,
      competitorKeywordsRead: snap?.competitorKeywordsRead ?? 0,
      ownKeywordsRead: snap?.ownKeywordsRead ?? 0,
      missing: rows.filter((r) => r.status === 'MISSING').length,
      behind: rows.filter((r) => r.status === 'BEHIND').length,
      rows,
    };
  }

  /**
   * Fetches fresh gaps from Google rankings for one competitor, or all of
   * them. A competitor fetched in the last week is served from what is
   * stored unless `refresh` is set, since every fetch is paid.
   */
  async refresh(projectId: string, options: { competitorDomain?: string; force?: boolean } = {}) {
    if (!this.dataforseo.isConfigured()) throw new ServiceUnavailableException(NOT_CONFIGURED_MESSAGE);
    const site = await ownSite(this.prisma, projectId);
    if (!site) throw new NotFoundException('Add your website to this project first.');
    const market = await resolveMarket(this.prisma, projectId);

    const all = await this.prisma.competitorDomain.findMany({ where: { projectId }, select: { domain: true, label: true } });
    const wanted = options.competitorDomain ? bareDomain(options.competitorDomain) : null;
    const competitors = all
      .map((c) => ({ domain: bareDomain(c.domain) ?? c.domain, label: c.label }))
      .filter((c) => !wanted || c.domain === wanted)
      .slice(0, MAX_COMPETITORS);
    if (competitors.length === 0) {
      throw new BadRequestException(wanted ? `${wanted} is not one of this project's competitors.` : 'Add a competitor first.');
    }

    const freshSince = new Date(Date.now() - CACHE_DAYS * 24 * 60 * 60 * 1000);
    const stale = [];
    for (const c of competitors) {
      const recent = options.force
        ? null
        : await this.prisma.keywordGapSnapshot.findFirst({
            where: { projectId, competitorDomain: c.domain, fetchedAt: { gte: freshSince }, error: null, country: market.country, language: market.language },
            select: { id: true },
          });
      if (!recent) stale.push(c);
    }
    if (stale.length === 0) return { fetched: 0, fromCache: competitors.length };

    const ownDomain = bareDomain(site.website.domain) ?? site.website.domain;
    let own;
    try {
      own = await this.dataforseo.rankedKeywords(ownDomain, { ...market, limit: 1000, maxPosition: 100 });
    } catch (error) {
      if (error instanceof DataForSeoError) throw new ServiceUnavailableException(error.message);
      throw error;
    }
    const gsc = await this.searchConsolePositions(projectId);

    let fetched = 0;
    for (const c of stale) {
      try {
        const theirs = await this.dataforseo.rankedKeywords(c.domain, { ...market, limit: 300, maxPosition: 20 });
        const rows = computeGaps(theirs.items, own.items, gsc);
        await this.prisma.keywordGapSnapshot.create({
          data: {
            projectId,
            competitorDomain: c.domain,
            country: market.country,
            language: market.language,
            rows: rows as unknown as Prisma.InputJsonValue,
            competitorKeywordsRead: theirs.items.length,
            ownKeywordsRead: own.items.length,
            costUsd: (theirs.costUsd ?? 0) + (fetched === 0 ? (own.costUsd ?? 0) : 0),
          },
        });
        fetched++;
      } catch (error: any) {
        const message = error instanceof DataForSeoError ? error.message : `Could not read ${c.domain}: ${error?.message ?? 'failed'}`;
        await this.prisma.keywordGapSnapshot.create({
          data: { projectId, competitorDomain: c.domain, country: market.country, language: market.language, error: message.slice(0, 500) },
        });
        if (error instanceof DataForSeoError && (error.code === 401 || error.code === 402)) break;
      }
    }
    this.logger.log(`[${projectId}] Keyword gaps: ${fetched} of ${stale.length} competitor(s) fetched.`);
    return { fetched, fromCache: competitors.length - stale.length };
  }
}

/** Keywords two or more competitors rank for that you are missing: the clearest gaps. */
export function sharedGaps(perCompetitor: Array<{ domain: string; rows: GapRow[] }>) {
  const byKeyword = new Map<string, { keyword: string; searchVolume: number | null; competitors: Array<{ domain: string; position: number; url: string | null }> }>();
  for (const c of perCompetitor) {
    for (const r of c.rows) {
      if (r.status !== 'MISSING') continue;
      const id = key(r.keyword);
      const entry = byKeyword.get(id) ?? { keyword: r.keyword, searchVolume: r.searchVolume, competitors: [] };
      entry.competitors.push({ domain: c.domain, position: r.competitorPosition, url: r.competitorUrl });
      byKeyword.set(id, entry);
    }
  }
  return [...byKeyword.values()]
    .filter((e) => e.competitors.length >= 2)
    .sort((a, b) => b.competitors.length - a.competitors.length || (b.searchVolume ?? -1) - (a.searchVolume ?? -1))
    .slice(0, 50);
}
