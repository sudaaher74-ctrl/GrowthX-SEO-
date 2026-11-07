/**
 * Keyword ideas for a business, and the rules for putting two lists together.
 *
 * Ideas are suggestions to track, not measurements. They carry no search volume
 * and no difficulty, because the models that write them do not know either and
 * a made-up number is worse than none. Volume is only ever shown when a keyword
 * data provider reports it.
 */

export const IDEA_KINDS = ['near_me', 'city', 'product', 'question', 'comparison'] as const;
export type IdeaKind = (typeof IDEA_KINDS)[number];

export const IDEA_INTENTS = ['local', 'transactional', 'commercial', 'informational'] as const;
export type IdeaIntent = (typeof IDEA_INTENTS)[number];

export type IdeaSource = 'TEMPLATE' | 'GEMINI';

export interface KeywordIdea {
  keyword: string;
  kind: IdeaKind;
  intent: IdeaIntent;
  /** One line on why a customer would search this, when the model gave one. */
  reason: string | null;
  source: IdeaSource;
  /** Already on the project's tracked list. */
  tracked: boolean;
  /** Where Search Console says the site stands for this exact search, when it has been shown. */
  searchConsole: { position: number; clicks: number; impressions: number } | null;
}

const MAX_KEYWORD_LENGTH = 80;
const MAX_WORDS = 9;

/** Lower-cases and collapses whitespace so "Milk  Delivery" and "milk delivery" are one keyword. */
export function normalizeKeyword(value: string): string {
  return value.toLowerCase().replace(/["“”]/g, '').replace(/\s+/g, ' ').replace(/^['\s]+|['\s]+$/g, '').trim();
}

export function isUsableKeyword(value: string): boolean {
  const k = normalizeKeyword(value);
  if (k.length < 3 || k.length > MAX_KEYWORD_LENGTH) return false;
  if (k.split(' ').length > MAX_WORDS) return false;
  // A keyword is words a person types, not a URL or a sentence ending in a stop.
  return !/[<>{}|\\]|https?:\/\//.test(k);
}

/**
 * The local-intent phrases every local business is searched with, built from
 * what the business offers. Free and instant, and the fallback when no model is
 * available. Without a city only the "near me" forms are produced.
 */
export function localTemplates(offerings: string[], city: string | null): Array<Pick<KeywordIdea, 'keyword' | 'kind' | 'intent'>> {
  const out: Array<Pick<KeywordIdea, 'keyword' | 'kind' | 'intent'>> = [];
  const place = city ? normalizeKeyword(city) : '';
  for (const raw of offerings.slice(0, 6)) {
    const offer = normalizeKeyword(raw);
    if (!offer) continue;
    out.push({ keyword: `${offer} near me`, kind: 'near_me', intent: 'local' });
    out.push({ keyword: `buy ${offer} online`, kind: 'product', intent: 'transactional' });
    if (place) {
      out.push({ keyword: `${offer} in ${place}`, kind: 'city', intent: 'local' });
      out.push({ keyword: `best ${offer} in ${place}`, kind: 'city', intent: 'commercial' });
      out.push({ keyword: `${offer} delivery in ${place}`, kind: 'city', intent: 'transactional' });
    }
  }
  return out;
}

export interface IdeaContext {
  trackedKeywords: Iterable<string>;
  searchConsole: Array<{ query: string; position: number; clicks: number; impressions: number }>;
}

/**
 * Merges ideas into one list: unusable ones dropped, duplicates collapsed (the
 * first wins, so model ideas, which come first, keep their reasons), and each
 * idea marked with whether it is tracked and where Search Console has it.
 */
export function mergeIdeas(
  lists: Array<Array<{ keyword: string; kind: IdeaKind; intent: IdeaIntent; reason?: string | null; source: IdeaSource }>>,
  context: IdeaContext,
  limit = 80,
): KeywordIdea[] {
  const tracked = new Set([...context.trackedKeywords].map(normalizeKeyword));
  const gsc = new Map(context.searchConsole.map((row) => [normalizeKeyword(row.query), row]));
  const seen = new Set<string>();
  const out: KeywordIdea[] = [];

  for (const list of lists) {
    for (const idea of list) {
      if (!isUsableKeyword(idea.keyword)) continue;
      const keyword = normalizeKeyword(idea.keyword);
      if (seen.has(keyword)) continue;
      seen.add(keyword);
      const seenInGoogle = gsc.get(keyword);
      out.push({
        keyword,
        kind: idea.kind,
        intent: idea.intent,
        reason: idea.reason?.trim() || null,
        source: idea.source,
        tracked: tracked.has(keyword),
        searchConsole: seenInGoogle
          ? { position: seenInGoogle.position, clicks: seenInGoogle.clicks, impressions: seenInGoogle.impressions }
          : null,
      });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** Keeps a model's value only when it is one of the allowed ones. */
export function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}
