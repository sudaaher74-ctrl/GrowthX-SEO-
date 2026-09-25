import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { canonicalUrl } from '../crawler/canonical-url';
import { isCrawlablePage } from '../crawler/crawlable';
import { normalizeDomain } from '../ai-visibility/citation/citation-detector';
import { CrawlPage, RivalMove, mergeMoves, movesFromCrawls, movesFromSnapshots } from './rival-moves';

/** How far back the feed looks. */
export const WINDOW_DAYS = 30;
/** Per competitor, so one busy site cannot push a quiet one out of the feed. */
const PER_RIVAL_LIMIT = 40;
const SNAPSHOT_ROWS_PER_RIVAL = 3000;
const QUESTIONS_KEPT = 3;

export interface RivalMovesResponse {
  moves: RivalMove[];
  windowDays: number;
  /** When each competitor was last checked, so a quiet feed can be told from an unwatched one. */
  watching: Array<{
    name: string;
    domain: string;
    /** The newer of the two below. */
    lastCheckedAt: string | null;
    /** When their whole website was last read, and how many pages. */
    lastCrawlAt: string | null;
    pagesRead: number | null;
    /** When the daily check last saw a page change (it writes nothing when nothing changed). */
    lastChangeAt: string | null;
  }>;
}

/**
 * What competitors changed recently: the Rival Radar feed.
 *
 * Read from three places that already record it: the daily page check of
 * each competitor, the difference between their last two full crawls, and
 * the AI answer checks that named them and not you.
 */
@Injectable()
export class RivalMovesService {
  constructor(private readonly prisma: PrismaService) {}

  async feed(projectId: string, now = new Date()): Promise<RivalMovesResponse> {
    const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const competitors = await this.prisma.competitorDomain.findMany({
      where: { projectId },
      select: { domain: true, name: true, label: true, websiteId: true },
      orderBy: { createdAt: 'asc' },
    });

    const moves: RivalMove[] = [];
    const watching: RivalMovesResponse['watching'] = [];

    for (const c of competitors) {
      const domain = normalizeDomain(c.domain);
      const rival = { name: c.name || c.label || domain, domain };

      const rows = await this.prisma.rivalPageSnapshot.findMany({
        where: { domain },
        orderBy: { capturedAt: 'desc' },
        take: SNAPSHOT_ROWS_PER_RIVAL,
        select: { url: true, statusCode: true, title: true, h1: true, schemaTypes: true, wordCount: true, capturedAt: true },
      });
      moves.push(...movesFromSnapshots(rows, rival, since));

      let lastCrawl: Date | null = null;
      let pagesRead: number | null = null;
      if (c.websiteId) {
        const jobs = await this.prisma.crawlJob.findMany({
          where: { websiteId: c.websiteId, status: 'COMPLETED' },
          orderBy: { finishedAt: 'desc' },
          take: 2,
          select: { id: true, finishedAt: true, pagesCrawled: true },
        });
        lastCrawl = jobs[0]?.finishedAt ?? null;
        pagesRead = jobs[0]?.pagesCrawled ?? null;
        if (jobs.length === 2 && jobs[0].finishedAt && jobs[0].finishedAt >= since) {
          const [latest, previous] = await Promise.all([this.pagesOf(jobs[0].id), this.pagesOf(jobs[1].id)]);
          moves.push(...movesFromCrawls(latest, previous, rival, jobs[0].finishedAt, jobs[1].finishedAt));
        }
      }

      const lastSnapshot = rows[0]?.capturedAt ?? null;
      const last = [lastSnapshot, lastCrawl].filter((d): d is Date => d != null).sort((a, b) => b.getTime() - a.getTime())[0];
      watching.push({
        ...rival,
        lastCheckedAt: last?.toISOString() ?? null,
        lastCrawlAt: lastCrawl?.toISOString() ?? null,
        pagesRead,
        lastChangeAt: lastSnapshot?.toISOString() ?? null,
      });
    }

    moves.push(...(await this.aiMoves(projectId, competitors.map((c) => ({ name: c.name || c.label || normalizeDomain(c.domain), domain: normalizeDomain(c.domain) })), since)));

    const merged = mergeMoves(moves, Number.MAX_SAFE_INTEGER);
    const perRival = new Map<string, number>();
    const capped = merged.filter((m) => {
      const n = (perRival.get(m.rivalDomain) ?? 0) + 1;
      perRival.set(m.rivalDomain, n);
      return n <= PER_RIVAL_LIMIT;
    });
    return { moves: capped, windowDays: WINDOW_DAYS, watching };
  }

  private async pagesOf(crawlJobId: string): Promise<Map<string, CrawlPage>> {
    const pages = await this.prisma.page.findMany({
      where: { crawlJobId, statusCode: { gte: 200, lt: 300 } },
      select: { url: true, title: true },
    });
    const byKey = new Map<string, CrawlPage>();
    for (const p of pages) {
      if (!isCrawlablePage(p.url)) continue;
      const key = canonicalUrl(p.url);
      if (!byKey.has(key)) byKey.set(key, { key, url: p.url, title: p.title });
    }
    return byKey;
  }

  /** Recent AI answers that named a competitor and not you, one move per competitor. */
  private async aiMoves(projectId: string, rivals: Array<{ name: string; domain: string }>, since: Date): Promise<RivalMove[]> {
    if (!rivals.length) return [];
    const checks = await this.prisma.promptCheck.findMany({
      where: { trackedPrompt: { projectId }, checkedAt: { gte: since }, error: null, cited: false },
      orderBy: { checkedAt: 'desc' },
      take: 500,
      select: { checkedAt: true, competitorsCited: true, trackedPrompt: { select: { text: true } } },
    });
    const moves: RivalMove[] = [];
    for (const r of rivals) {
      const hits = checks.filter((c) => c.competitorsCited.some((d) => normalizeDomain(d) === r.domain));
      if (!hits.length) continue;
      const questions = [...new Set(hits.map((h) => h.trackedPrompt.text))].slice(0, QUESTIONS_KEPT);
      moves.push({
        id: `AI_NAMED:${r.domain}`,
        kind: 'AI_NAMED',
        rival: r.name,
        rivalDomain: r.domain,
        url: null,
        title: null,
        at: hits[0].checkedAt.toISOString(),
        source: 'ai-answers',
        count: hits.length,
        questions,
      });
    }
    return moves;
  }
}
