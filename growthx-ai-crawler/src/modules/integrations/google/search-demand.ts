/**
 * Real Google search numbers for the phrases the product suggests.
 *
 * Keyword and blog ideas were Sarvam's suggestions with no numbers behind
 * them. Search Console already holds, per day, every search the customer's
 * site appeared in: how many people saw it, clicked, and at what position.
 * This is the part of that data a suggestion can honestly carry.
 *
 * What it cannot do is size a search the site has never appeared for:
 * Search Console only reports searches that showed this site. So a suggested
 * phrase gets numbers only when it IS one of those searches — same words, any
 * order — and otherwise stays marked as a suggestion. No near-match, no
 * estimate, no volume from anywhere else.
 */

export const DEMAND_DAYS = 28;

/** One search the site appeared in, over the window. */
export interface MeasuredSearch {
  query: string;
  /** Times the site was shown for it. */
  impressions: number;
  clicks: number;
  /** Impression-weighted average position; 1 is the top. */
  position: number;
  /** The page Google showed most for it, when known. */
  page: string | null;
}

export type SearchDataStatus =
  /** Search Console has never been connected for this project. */
  | 'NOT_CONNECTED'
  /** Connected, but no day of data has been stored yet. */
  | 'NO_DATA_YET'
  /** Connected once and now needs attention (expired, error). */
  | 'NEEDS_ATTENTION'
  | 'OK';

export interface SearchDemand {
  status: SearchDataStatus;
  days: number;
  /** The window the numbers cover, ISO dates; null without data. */
  range: { start: string; end: string } | null;
  /** The searches that brought the most people, most first. */
  topSearches: MeasuredSearch[];
  /**
   * Searches the site shows for but just off the first page (positions 8–20),
   * with enough people seeing them to matter: the closest wins available.
   */
  almostWinning: MeasuredSearch[];
}

/** What a suggested phrase carries when Google has numbers for it. */
export interface Measured {
  impressions: number;
  clicks: number;
  position: number;
  days: number;
  page: string | null;
}

/** Lower-case words, punctuation dropped, for comparing two phrasings of one search. */
export function searchKey(phrase: string): string {
  return phrase
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

/** Index of measured searches by their word set, for exact lookups. */
export function indexSearches(searches: MeasuredSearch[]): Map<string, MeasuredSearch> {
  const index = new Map<string, MeasuredSearch>();
  for (const s of searches) {
    const key = searchKey(s.query);
    const existing = index.get(key);
    // Two spellings of the same words: keep the one more people saw.
    if (key && (!existing || s.impressions > existing.impressions)) index.set(key, s);
  }
  return index;
}

/** Google's numbers for a phrase, when it is one of the searches the site appeared in; otherwise null. */
export function measure(phrase: string, index: Map<string, MeasuredSearch>, days = DEMAND_DAYS): Measured | null {
  const hit = index.get(searchKey(phrase));
  if (!hit) return null;
  return { impressions: hit.impressions, clicks: hit.clicks, position: round1(hit.position), days, page: hit.page };
}

export const round1 = (n: number) => Math.round(n * 10) / 10;

/** Lines for a model prompt: the real searches, so its suggestions start from them. */
export function demandPromptLines(demand: SearchDemand, pathOf: (url: string) => string = (u) => u): string {
  if (demand.status !== 'OK' || (demand.topSearches.length === 0 && demand.almostWinning.length === 0)) return '';
  const line = (s: MeasuredSearch) =>
    `- "${s.query}": shown ${s.impressions} times, ${s.clicks} clicks, average position ${round1(s.position)}${s.page ? `, page ${pathOf(s.page)}` : ''}`;
  return [
    `REAL GOOGLE SEARCHES THIS WEBSITE ALREADY APPEARS IN (Google Search Console, last ${demand.days} days)`,
    ...demand.topSearches.slice(0, 15).map(line),
    ...(demand.almostWinning.length
      ? ['', 'SEARCHES IT ALMOST WINS (just off the first page of Google)', ...demand.almostWinning.slice(0, 10).map(line)]
      : []),
  ].join('\n');
}
