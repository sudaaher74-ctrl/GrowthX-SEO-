import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { DataForSeoError, DataForSeoService, GoogleResults, NOT_CONFIGURED_MESSAGE } from './dataforseo.service';
import { bareDomain, onDomain, ownSite } from './own-site';
import { resolveMarket, SearchMarket } from './search-market';
import { classifyPage, featureLabel } from './serp-analysis';

export interface CompetitorRef {
  domain: string;
  label: string | null;
}

export interface Placement {
  position: number;
  url: string;
}

/** One side of a comparison: where you and each competitor stood. */
export interface Standing {
  checkedAt: Date;
  own: number | null;
  competitors: Record<string, Placement>;
}

export interface Overtake {
  keyword: string;
  competitor: string;
  before: { own: number | null; competitor: number | null; checkedAt: Date };
  now: { own: number | null; competitor: number | null; checkedAt: Date };
  competitorUrl: string | null;
}

const DEFAULT_TRACKED = 25;
const MAX_KEYWORD_LENGTH = 120;

/**
 * Where a competitor moved above you, or you above them, between two checks.
 * A side not in the results read counts as below everyone in them, so a
 * competitor arriving from nowhere above you is an overtake, while two sites
 * that were both absent before is not.
 */
export function findOvertakes(keyword: string, before: Standing, now: Standing): { lost: Overtake[]; won: Overtake[] } {
  const rank = (p: number | null | undefined) => (typeof p === 'number' ? p : Number.POSITIVE_INFINITY);
  const lost: Overtake[] = [];
  const won: Overtake[] = [];
  const domains = new Set([...Object.keys(before.competitors), ...Object.keys(now.competitors)]);

  for (const domain of domains) {
    const prevComp = before.competitors[domain]?.position ?? null;
    const nowComp = now.competitors[domain]?.position ?? null;
    const entry: Overtake = {
      keyword,
      competitor: domain,
      before: { own: before.own, competitor: prevComp, checkedAt: before.checkedAt },
      now: { own: now.own, competitor: nowComp, checkedAt: now.checkedAt },
      competitorUrl: now.competitors[domain]?.url ?? before.competitors[domain]?.url ?? null,
    };
    if (rank(prevComp) > rank(before.own) && rank(nowComp) < rank(now.own)) lost.push(entry);
    else if (rank(prevComp) < rank(before.own) && rank(nowComp) > rank(now.own)) won.push(entry);
  }
  return { lost, won };
}

/** Where the customer and each tracked competitor appear in one set of results. */
export function placements(results: GoogleResults, ownDomain: string, competitors: CompetitorRef[]) {
  const own = results.organic.find((r) => onDomain(r.url, ownDomain)) ?? null;
  const competitorPositions: Record<string, Placement> = {};
  for (const c of competitors) {
    const domain = bareDomain(c.domain);
    if (!domain || domain === bareDomain(ownDomain)) continue;
    const hit = results.organic.find((r) => onDomain(r.url, domain));
    if (hit) competitorPositions[domain] = { position: hit.position, url: hit.url };
  }
  return { own, competitorPositions };
}

/**
 * Rank history for the keywords a project cares about.
 *
 * Google positions cannot be looked up after the fact, so the history starts
 * with the first check and is only ever what was observed: no back-filled or
 * interpolated positions.
 */
@Injectable()
export class RankTrackingService {
  private readonly logger = new Logger(RankTrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dataforseo: DataForSeoService,
    private readonly config: ConfigService,
  ) {}

  private trackedLimit(): number {
    const n = Number(this.config.get('SERP_TRACKED_KEYWORDS_PER_PROJECT'));
    return Number.isFinite(n) && n > 0 ? Math.min(n, 200) : DEFAULT_TRACKED;
  }

  async competitorsOf(projectId: string): Promise<CompetitorRef[]> {
    const rows = await this.prisma.competitorDomain.findMany({ where: { projectId }, select: { domain: true, label: true } });
    return rows.map((r) => ({ domain: r.domain, label: r.label }));
  }

  /** Stores one set of Google results as a snapshot, with who stood where. */
  async record(projectId: string, market: SearchMarket, results: GoogleResults, ownDomain: string, competitors: CompetitorRef[]) {
    const { own, competitorPositions } = placements(results, ownDomain, competitors);
    return this.prisma.serpSnapshot.create({
      data: {
        projectId,
        keyword: results.keyword,
        country: market.country,
        language: market.language,
        device: results.device,
        results: results.organic.slice(0, 20).map((r) => ({ ...r, format: classifyPage(r.url, r.title) })) as unknown as Prisma.InputJsonValue,
        features: results.features,
        ownPosition: own?.position ?? null,
        ownUrl: own?.url ?? null,
        competitorPositions: competitorPositions as unknown as Prisma.InputJsonValue,
        costUsd: results.costUsd,
      },
    });
  }

  /** Checks one keyword in Google now and stores the result. */
  async checkKeyword(projectId: string, keyword: string) {
    if (!this.dataforseo.isConfigured()) throw new ServiceUnavailableException(NOT_CONFIGURED_MESSAGE);
    const site = await ownSite(this.prisma, projectId);
    if (!site) throw new NotFoundException('Add your website to this project first.');
    const market = await resolveMarket(this.prisma, projectId);
    const competitors = await this.competitorsOf(projectId);
    try {
      const results = await this.dataforseo.googleResults(keyword, market);
      const snapshot = await this.record(projectId, market, results, site.website.domain, competitors);
      return { snapshot, results, market, site, competitors };
    } catch (error) {
      if (error instanceof DataForSeoError) {
        await this.prisma.serpSnapshot.create({
          data: { projectId, keyword, country: market.country, language: market.language, error: error.message.slice(0, 500) },
        });
        throw new ServiceUnavailableException(error.message);
      }
      throw error;
    }
  }

  async list(projectId: string) {
    const [keywords, market] = await Promise.all([
      this.prisma.trackedKeyword.findMany({ where: { projectId, isActive: true }, orderBy: { createdAt: 'asc' } }),
      resolveMarket(this.prisma, projectId),
    ]);
    const snapshots = keywords.length
      ? await this.prisma.serpSnapshot.findMany({
          where: { projectId, keyword: { in: keywords.map((k) => k.keyword) }, error: null, checkedAt: { gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) } },
          orderBy: { checkedAt: 'desc' },
          select: { keyword: true, checkedAt: true, ownPosition: true, ownUrl: true, competitorPositions: true, features: true, country: true },
        })
      : [];
    const byKeyword = new Map<string, typeof snapshots>();
    for (const s of snapshots) {
      const list = byKeyword.get(s.keyword) ?? [];
      if (list.length < 2) list.push(s);
      byKeyword.set(s.keyword, list);
    }

    const lost: Overtake[] = [];
    const won: Overtake[] = [];
    const rows = keywords.map((k) => {
      const [latest, previous] = byKeyword.get(k.keyword) ?? [];
      if (latest && previous) {
        const moves = findOvertakes(k.keyword, standing(previous), standing(latest));
        lost.push(...moves.lost);
        won.push(...moves.won);
      }
      return {
        id: k.id,
        keyword: k.keyword,
        source: k.source,
        lastCheckedAt: latest?.checkedAt ?? null,
        position: latest?.ownPosition ?? null,
        url: latest?.ownUrl ?? null,
        previousPosition: previous?.ownPosition ?? null,
        previousCheckedAt: previous?.checkedAt ?? null,
        competitors: (latest?.competitorPositions as unknown as Record<string, Placement> | undefined) ?? {},
        features: (latest?.features ?? []).map(featureLabel),
        checkedInMarket: latest?.country ?? null,
      };
    });

    return {
      connected: this.dataforseo.isConfigured(),
      market,
      limit: this.trackedLimit(),
      keywords: rows,
      overtakenBy: lost,
      youOvertook: won,
    };
  }

  async add(projectId: string, keywords: string[], source = 'USER') {
    const clean = [...new Set(keywords.map((k) => k.trim().toLowerCase()).filter((k) => k.length >= 2 && k.length <= MAX_KEYWORD_LENGTH))];
    if (clean.length === 0) throw new BadRequestException('Give at least one keyword of 2 to 120 characters.');
    const active = await this.prisma.trackedKeyword.count({ where: { projectId, isActive: true } });
    const room = this.trackedLimit() - active;
    if (room <= 0) throw new BadRequestException(`This project already tracks ${active} keywords, the most allowed. Remove some first.`);
    const toAdd = clean.slice(0, room);
    for (const keyword of toAdd) {
      await this.prisma.trackedKeyword.upsert({
        where: { projectId_keyword: { projectId, keyword } },
        create: { projectId, keyword, source },
        update: { isActive: true },
      });
    }
    return { added: toAdd.length, skipped: clean.length - toAdd.length };
  }

  async remove(projectId: string, id: string) {
    const { count } = await this.prisma.trackedKeyword.updateMany({ where: { id, projectId }, data: { isActive: false } });
    if (count === 0) throw new NotFoundException('Tracked keyword not found.');
    return { removed: true };
  }

  /** The searches the site already gets seen for, as a starting keyword set. */
  async seedFromSearchConsole(projectId: string): Promise<number> {
    const since = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
    const top = await this.prisma.gscDailyMetric.groupBy({
      by: ['query'],
      where: { projectId, grain: 'QUERY', date: { gte: since }, query: { not: null } },
      _sum: { impressions: true },
      orderBy: { _sum: { impressions: 'desc' } },
      take: Math.min(this.trackedLimit(), 15),
    });
    const keywords = top.map((t) => t.query!).filter((q) => q && q.length >= 2 && q.length <= MAX_KEYWORD_LENGTH);
    if (keywords.length === 0) return 0;
    const { added } = await this.add(projectId, keywords, 'SEARCH_CONSOLE');
    return added;
  }

  /** Checks every tracked keyword now. Seeds from Search Console on a first run. */
  async checkAll(projectId: string) {
    if (!this.dataforseo.isConfigured()) throw new ServiceUnavailableException(NOT_CONFIGURED_MESSAGE);
    let keywords = await this.prisma.trackedKeyword.findMany({ where: { projectId, isActive: true }, orderBy: { createdAt: 'asc' }, take: this.trackedLimit() });
    if (keywords.length === 0) {
      await this.seedFromSearchConsole(projectId);
      keywords = await this.prisma.trackedKeyword.findMany({ where: { projectId, isActive: true }, orderBy: { createdAt: 'asc' }, take: this.trackedLimit() });
    }
    if (keywords.length === 0) {
      throw new BadRequestException('No keywords to check yet. Add a few, or connect Search Console so they can be taken from the searches you already appear in.');
    }

    let checked = 0;
    const failed: string[] = [];
    for (const k of keywords) {
      try {
        await this.checkKeyword(projectId, k.keyword);
        checked++;
      } catch (error: any) {
        failed.push(`${k.keyword}: ${error?.message ?? 'failed'}`);
        // Credentials or credit problems fail every keyword the same way.
        if (/login and password|run out of credit|not connected/i.test(error?.message ?? '')) break;
      }
    }
    this.logger.log(`[${projectId}] Rank check: ${checked} keyword(s) checked, ${failed.length} failed.`);
    return { checked, failed };
  }
}

function standing(s: { checkedAt: Date; ownPosition: number | null; competitorPositions: Prisma.JsonValue }): Standing {
  return {
    checkedAt: s.checkedAt,
    own: s.ownPosition,
    competitors: (s.competitorPositions as unknown as Record<string, Placement>) ?? {},
  };
}
