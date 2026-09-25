import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import * as cheerio from 'cheerio';
import { PrismaService } from '../../database/prisma.service';
import { DiscoveryService } from '../crawler/discovery/discovery.service';
import { FetcherService } from '../crawler/fetcher.service';

export interface PageFacts {
  statusCode: number;
  title: string | null;
  h1: string | null;
  metaDescription: string | null;
  schemaTypes: string[];
  wordCount: number;
}

/** What is worth comparing day to day on a rival page, from its HTML. */
export function extractPageFacts(html: string, statusCode: number): PageFacts {
  const $ = cheerio.load(html || '');
  const text = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim() || null;

  const types = new Set<string>();
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      collectTypes(JSON.parse($(el).contents().text()), types);
    } catch {
      // Malformed JSON-LD is common on real sites; it contributes no types.
    }
  });

  $('script, style, noscript, svg').remove();
  const body = text($('body').text()) ?? '';

  return {
    statusCode,
    title: text($('title').first().text()),
    h1: text($('h1').first().text()),
    metaDescription: text($('meta[name="description"]').attr('content')),
    schemaTypes: [...types].sort(),
    wordCount: body ? body.split(' ').length : 0,
  };
}

function collectTypes(node: unknown, into: Set<string>) {
  if (Array.isArray(node)) {
    node.forEach((n) => collectTypes(n, into));
    return;
  }
  if (!node || typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;
  const t = obj['@type'];
  if (typeof t === 'string') into.add(t);
  if (Array.isArray(t)) t.forEach((x) => typeof x === 'string' && into.add(x));
  if (obj['@graph']) collectTypes(obj['@graph'], into);
}

export function factsHash(facts: PageFacts): string {
  return createHash('sha256').update(JSON.stringify(facts)).digest('hex');
}

/**
 * Takes a daily snapshot of each rival's pages.
 *
 * A third party never asked to be fetched, so this is deliberately small: a
 * bounded number of URLs, plain HTTP rather than a headless browser, one page
 * at a time with a pause, and robots.txt respected. Only a page whose facts
 * changed is written, so a quiet rival costs almost nothing to keep.
 */
@Injectable()
export class RivalSnapshotService {
  private readonly logger = new Logger(RivalSnapshotService.name);

  static readonly MAX_PAGES = 50;
  static readonly PAUSE_MS = 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly discovery: DiscoveryService,
    private readonly fetcher: FetcherService,
  ) {}

  /** Politeness delay between fetches; overridden in tests. */
  protected pause(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async snapshotDomain(domain: string): Promise<{ fetched: number; written: number; skippedByRobots: number }> {
    const start = `https://${domain.replace(/^https?:\/\//, '').replace(/\/+$/, '')}/`;
    const host = new URL(start).hostname.replace(/^www\./, '');
    const seeds = await this.discovery.discoverSeeds(start, { useSitemap: true });

    const urls: string[] = [];
    for (const u of [start, ...seeds.urls.map((s) => s.normalizedUrl || s.url)]) {
      try {
        if (new URL(u).hostname.replace(/^www\./, '') !== host) continue;
      } catch {
        continue;
      }
      if (!urls.includes(u)) urls.push(u);
      if (urls.length >= RivalSnapshotService.MAX_PAGES) break;
    }

    let fetched = 0;
    let written = 0;
    let skippedByRobots = 0;
    for (const url of urls) {
      if (this.discovery.isAllowed(seeds.robots, url)?.allowed === false) {
        skippedByRobots += 1;
        continue;
      }
      try {
        const res = await this.fetcher.fetchPage(url, false);
        fetched += 1;
        const facts = extractPageFacts(res.html, res.statusCode);
        const contentHash = factsHash(facts);
        const last = await this.prisma.rivalPageSnapshot.findFirst({
          where: { domain: host, url },
          orderBy: { capturedAt: 'desc' },
          select: { contentHash: true },
        });
        if (last?.contentHash !== contentHash) {
          await this.prisma.rivalPageSnapshot.create({ data: { domain: host, url, contentHash, ...facts } });
          written += 1;
        }
      } catch (err) {
        this.logger.warn(`[${host}] ${url} could not be snapshotted: ${(err as Error).message}`);
      }
      await this.pause(Math.max(RivalSnapshotService.PAUSE_MS, seeds.crawlDelayMs ?? 0));
    }

    return { fetched, written, skippedByRobots };
  }
}
