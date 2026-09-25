/**
 * What a competitor changed on their website, read from two observations of
 * the same pages.
 *
 * The Rival Radar used to list a competitor's own site problems. A customer
 * cannot act on those; what they can act on is a competitor moving — a new
 * page, a page made more detailed, a new headline aimed at different
 * searches, new details given to Google, or a page taken down that people
 * still look for. Each move names the page it was seen on and when.
 */

export type RivalMoveKind = 'NEW_PAGE' | 'EXPANDED' | 'RETITLED' | 'SCHEMA_ADDED' | 'PAGE_GONE' | 'AI_NAMED';

export interface RivalMove {
  id: string;
  kind: RivalMoveKind;
  rival: string;
  rivalDomain: string;
  url: string | null;
  /** The page's title when it was seen, for display. */
  title: string | null;
  /** When the change was first seen. */
  at: string;
  /** Where it was seen: the daily page check, a full crawl, or AI answer checks. */
  source: 'daily-check' | 'crawl' | 'ai-answers';
  /** Headline before and after, for RETITLED. */
  from?: string | null;
  to?: string | null;
  /** New structured data types, for SCHEMA_ADDED. */
  added?: string[];
  /** Word counts before and after, for EXPANDED. */
  words?: { from: number; to: number };
  /** AI answers naming them and not you, for AI_NAMED. */
  count?: number;
  questions?: string[];
  /** For a change seen between two full reads: when the earlier read was. */
  comparedWith?: string | null;
}

export interface SnapshotRow {
  url: string;
  statusCode: number;
  title: string | null;
  h1: string | null;
  schemaTypes: string[];
  wordCount: number;
  capturedAt: Date;
}

/** A page counts as expanded when it grows by both of these. */
const EXPANDED_SHARE = 0.25;
const EXPANDED_WORDS = 150;

const ok = (status: number) => status >= 200 && status < 300;
const headline = (s: Pick<SnapshotRow, 'title' | 'h1'>) => (s.title ?? s.h1 ?? '').trim();

/**
 * Moves between consecutive snapshots of each page.
 *
 * Only the change is written by the snapshotter, so consecutive rows for one
 * URL always differ. A page's first row is a new page only when the domain
 * was already being watched before it appeared; the very first check of a
 * domain is a baseline, not a burst of new pages.
 */
export function movesFromSnapshots(
  rows: SnapshotRow[],
  rival: { name: string; domain: string },
  since: Date,
): RivalMove[] {
  if (!rows.length) return [];
  const sorted = [...rows].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
  const baselineEnd = sorted[0].capturedAt.getTime() + 24 * 60 * 60 * 1000;

  const byUrl = new Map<string, SnapshotRow[]>();
  for (const row of sorted) {
    const list = byUrl.get(row.url) ?? [];
    list.push(row);
    byUrl.set(row.url, list);
  }

  const moves: RivalMove[] = [];
  const base = (kind: RivalMoveKind, row: SnapshotRow): RivalMove => ({
    id: `${kind}:${row.url}:${row.capturedAt.getTime()}`,
    kind,
    rival: rival.name,
    rivalDomain: rival.domain,
    url: row.url,
    title: headline(row) || null,
    at: row.capturedAt.toISOString(),
    source: 'daily-check',
  });

  for (const list of byUrl.values()) {
    const first = list[0];
    if (first.capturedAt >= since && first.capturedAt.getTime() > baselineEnd && ok(first.statusCode)) {
      moves.push(base('NEW_PAGE', first));
    }
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const cur = list[i];
      if (cur.capturedAt < since) continue;

      if (ok(prev.statusCode) && !ok(cur.statusCode)) {
        moves.push({ ...base('PAGE_GONE', cur), title: headline(prev) || null });
        continue;
      }
      if (!ok(cur.statusCode)) continue;

      const before = headline(prev);
      const after = headline(cur);
      if (before && after && before.toLowerCase() !== after.toLowerCase()) {
        moves.push({ ...base('RETITLED', cur), from: before, to: after });
      }
      const added = cur.schemaTypes.filter((t) => !prev.schemaTypes.includes(t));
      if (added.length) moves.push({ ...base('SCHEMA_ADDED', cur), added });
      const grew = cur.wordCount - prev.wordCount;
      if (grew >= EXPANDED_WORDS && grew >= prev.wordCount * EXPANDED_SHARE) {
        moves.push({ ...base('EXPANDED', cur), words: { from: prev.wordCount, to: cur.wordCount } });
      }
    }
  }
  return moves;
}

export interface CrawlPage {
  key: string;
  url: string;
  title: string | null;
}

const CRAWL_CHURN_MIN = 10;
const CRAWL_CHURN_SHARE = 0.25;

/** Moves between a competitor's two latest full crawls. */
export function movesFromCrawls(
  latest: Map<string, CrawlPage>,
  previous: Map<string, CrawlPage>,
  rival: { name: string; domain: string },
  at: Date,
  previousAt: Date | null = null,
): RivalMove[] {
  const moves: RivalMove[] = [];
  const base = (kind: RivalMoveKind, p: CrawlPage): RivalMove => ({
    id: `${kind}:${p.url}:crawl`,
    kind,
    rival: rival.name,
    rivalDomain: rival.domain,
    url: p.url,
    title: p.title,
    at: at.toISOString(),
    source: 'crawl',
    comparedWith: previousAt?.toISOString() ?? null,
  });
  // Two crawls rarely reach exactly the same pages. When a large share of the
  // site appears or disappears at once, that is the crawl reaching further or
  // less far, not the competitor publishing; only headline changes are kept.
  const added = [...latest.keys()].filter((k) => !previous.has(k)).length;
  const removed = [...previous.keys()].filter((k) => !latest.has(k)).length;
  const churnLimit = Math.max(CRAWL_CHURN_MIN, Math.min(latest.size, previous.size) * CRAWL_CHURN_SHARE);
  const trustAdds = added <= churnLimit;
  const trustRemovals = removed <= churnLimit;

  for (const [key, page] of latest) {
    const prev = previous.get(key);
    if (!prev) {
      if (trustAdds) moves.push(base('NEW_PAGE', page));
    }
    else if (prev.title && page.title && prev.title.trim().toLowerCase() !== page.title.trim().toLowerCase()) {
      moves.push({ ...base('RETITLED', page), from: prev.title, to: page.title });
    }
  }
  if (trustRemovals) {
    for (const [key, page] of previous) {
      if (!latest.has(key)) moves.push(base('PAGE_GONE', page));
    }
  }
  return moves;
}

/**
 * One list across sources: the same change seen by the daily check and by a
 * crawl is shown once, newest first.
 */
export function mergeMoves(moves: RivalMove[], limit: number): RivalMove[] {
  const seen = new Set<string>();
  const out: RivalMove[] = [];
  const order = { 'daily-check': 0, 'ai-answers': 1, crawl: 2 } as const;
  const sorted = [...moves].sort(
    (a, b) => b.at.localeCompare(a.at) || order[a.source] - order[b.source],
  );
  for (const m of sorted) {
    const key = `${m.kind}:${(m.url ?? m.rivalDomain).replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
    if (out.length >= limit) break;
  }
  return out;
}
