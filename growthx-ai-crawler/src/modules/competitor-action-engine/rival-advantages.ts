import { canonicalUrl } from '../crawler/canonical-url';
import { isCrawlablePage } from '../crawler/crawlable';
import { closestMatch, distinctiveTokens, MATCH_THRESHOLD, siteBoilerplate } from '../content-intelligence/topic-match';
import { PAGE_TYPE_LABELS } from './competitor-seo-report.service';

/**
 * What a rival's site has that the customer's does not, counted from the two
 * crawls.
 *
 * The competitor report used to list each rival's own SEO problems. A
 * customer cannot act on a rival's broken canonicals; they can act on the
 * topics, page kinds and structured data that rival has and they lack. Those
 * are the on-site reasons a rival is likely to rank where the customer does
 * not, and every item here names the pages it was counted from.
 */

export interface AdvantagePage {
  url: string;
  title: string | null;
  pageType: string;
  wordCount: number;
  h2: string[];
  h3: string[];
  schemaTypes: string[];
}

export interface RivalAdvantages {
  /** Their pages whose topic no page of yours covers, most substantial first. */
  missingTopics: Array<{ title: string; url: string; pageType: string; wordCount: number }>;
  missingTopicsTotal: number;
  /** Your pages whose topic they do not cover: where you lead. */
  yourUniqueTopicsTotal: number;
  /** Kinds of page they have more of. */
  pageTypes: Array<{ pageType: string; label: string; you: number; them: number }>;
  /** Structured data types they use on more pages than you. */
  schema: Array<{ type: string; you: number; them: number; exampleUrl: string }>;
  depth: {
    yourMedianWords: number | null;
    theirMedianWords: number | null;
    /** Pages of LONG_PAGE_WORDS or more: the in-depth guides that rank for broad terms. */
    yourLongPages: number;
    theirLongPages: number;
  };
  /** Questions they answer in headings, the shape AI answers and FAQ results pull from. */
  questions: { theirs: string[]; theirCount: number; yourCount: number };
}

export const LONG_PAGE_WORDS = 1000;
const MISSING_TOPICS_KEPT = 15;
const QUESTIONS_KEPT = 8;
/** Page kinds that are never a ranking topic: every site has one of each. */
const NOT_TOPICS = new Set(['LEGAL', 'HOME', 'ABOUT', 'CONTACT']);

/** One entry per real page: files dropped, URL variants merged. */
export function dedupePages<T extends { url: string }>(pages: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const page of pages) {
    if (!isCrawlablePage(page.url)) continue;
    const key = canonicalUrl(page.url);
    if (!byKey.has(key)) byKey.set(key, page);
  }
  return [...byKey.values()];
}

function median(values: number[]): number | null {
  const sorted = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function questionsOf(pages: AdvantagePage[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const page of pages) {
    for (const heading of [...page.h2, ...page.h3]) {
      const text = heading.replace(/\s+/g, ' ').trim();
      if (!text.endsWith('?') || text.length < 12 || text.length > 160) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(text);
    }
  }
  return out;
}

function countBy<T>(items: T[], key: (item: T) => string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) for (const k of new Set(key(item))) counts.set(k, (counts.get(k) ?? 0) + 1);
  return counts;
}

export function computeAdvantages(ours: AdvantagePage[], theirs: AdvantagePage[]): RivalAdvantages {
  const ourBoilerplate = siteBoilerplate(ours);
  const theirBoilerplate = siteBoilerplate(theirs);
  const isTopic = (p: AdvantagePage) => !NOT_TOPICS.has(p.pageType) && (p.title ?? '').trim().length > 0;

  /** Pages on one side whose topic nothing on the other side covers. */
  const uncovered = (
    side: AdvantagePage[],
    other: AdvantagePage[],
    boilerplate: { theirs: Set<string>; ours: Set<string> },
  ) =>
    side.filter((page) => {
      // A page with no topic words of its own (a bare brand title) is never a gap.
      if (!isTopic(page) || distinctiveTokens(page, boilerplate.theirs).size === 0) return false;
      const match = closestMatch(page, other, boilerplate);
      return match === null || match.score < MATCH_THRESHOLD;
    });

  const missing = uncovered(theirs, ours, { theirs: theirBoilerplate, ours: ourBoilerplate }).sort(
    (a, b) => b.wordCount - a.wordCount,
  );
  const yourUnique = uncovered(ours, theirs, { theirs: ourBoilerplate, ours: theirBoilerplate });

  const ourTypes = countBy(ours, (p) => [p.pageType]);
  const theirTypes = countBy(theirs, (p) => [p.pageType]);
  const pageTypes = [...theirTypes.entries()]
    .filter(([type, them]) => type !== 'OTHER' && them > (ourTypes.get(type) ?? 0))
    .map(([pageType, them]) => ({ pageType, label: PAGE_TYPE_LABELS[pageType] ?? pageType, you: ourTypes.get(pageType) ?? 0, them }))
    .sort((a, b) => b.them - b.you - (a.them - a.you));

  const ourSchema = countBy(ours, (p) => p.schemaTypes);
  const theirSchema = countBy(theirs, (p) => p.schemaTypes);
  const schema = [...theirSchema.entries()]
    .filter(([type, them]) => type !== 'OTHER' && them > (ourSchema.get(type) ?? 0))
    .map(([type, them]) => ({
      type,
      you: ourSchema.get(type) ?? 0,
      them,
      exampleUrl: theirs.find((p) => p.schemaTypes.includes(type))?.url ?? '',
    }))
    .sort((a, b) => a.you - b.you || b.them - a.them);

  const ourQuestions = questionsOf(ours);
  const theirQuestions = questionsOf(theirs);

  return {
    missingTopics: missing.slice(0, MISSING_TOPICS_KEPT).map((p) => ({
      title: (p.title ?? '').trim(),
      url: p.url,
      pageType: p.pageType,
      wordCount: p.wordCount,
    })),
    missingTopicsTotal: missing.length,
    yourUniqueTopicsTotal: yourUnique.length,
    pageTypes,
    schema,
    depth: {
      yourMedianWords: median(ours.map((p) => p.wordCount)),
      theirMedianWords: median(theirs.map((p) => p.wordCount)),
      yourLongPages: ours.filter((p) => p.wordCount >= LONG_PAGE_WORDS).length,
      theirLongPages: theirs.filter((p) => p.wordCount >= LONG_PAGE_WORDS).length,
    },
    questions: { theirs: theirQuestions.slice(0, QUESTIONS_KEPT), theirCount: theirQuestions.length, yourCount: ourQuestions.length },
  };
}
