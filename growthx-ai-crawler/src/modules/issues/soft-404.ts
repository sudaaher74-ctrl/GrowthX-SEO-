/**
 * A soft 404: the server answers 200 OK, but what it serves is a "page not
 * found" page.
 *
 * Google treats these as errors and drops them from the index, but no status
 * code says so, so an audit that only reads status codes counts them as
 * healthy pages. The usual causes are a catch-all route in a single-page app,
 * a CMS that renders its not-found template without setting the status, and
 * deleted products whose URL still answers.
 *
 * Detection reads what a visitor would read. A title or main heading that IS a
 * not-found message is the strong signal; a near-empty page whose text says the
 * page does not exist is the other. A page that merely mentions 404 — an
 * article about fixing 404 errors — has a longer heading and plenty of text,
 * and is left alone.
 */

export interface Soft404Input {
  statusCode: number;
  title: string | null | undefined;
  h1: string[] | null | undefined;
  /** Words of main content, as the content analyser counts them. */
  wordCount: number;
  /** Visible body text. Only its first few hundred characters are read. */
  bodyText: string | null | undefined;
}

export interface Soft404Result {
  /** Which signals matched, in plain words, so the finding can quote them. */
  signals: string[];
}

/** Below this many words, a page that says it does not exist is taken at its word. */
const NEAR_EMPTY_WORDS = 150;

/**
 * Whole-segment matches only. A title is split on its separators first, so
 * "Page not found | Northwind" matches while "How to fix a page not found error
 * on WordPress" does not.
 */
const NOT_FOUND_SEGMENT: RegExp[] = [
  /^(error\s*)?404(\s*error)?(\s*page)?(\s*[-:!.]?\s*(page\s+)?not\s+found)?[!.]?$/,
  /^(oops[!,.]?\s*)?(the\s+|this\s+)?page\s+(was\s+)?not\s+found[!.]?$/,
  /^not\s+found[!.]?$/,
  /^(sorry[!,.]?\s*)?(the\s+|this\s+)?page\s+(you(\s+(are|were)|'re)\s+looking\s+for\s+)?(does\s+not|doesn't|no\s+longer)\s+exists?[!.]?$/,
  /^(sorry[!,.]?\s*)?(the\s+|this\s+)?page\s+(could\s+not|couldn't|cannot|can't)\s+be\s+found[!.]?$/,
  /^(sorry[!,.]?\s*)?we\s+(could\s+not|couldn't|cannot|can't)\s+find\s+(that|this|the)\s+page[!.]?$/,
  /^nothing\s+(was\s+)?found(\s+for\s+.*)?[!.]?$/,
  /^(product|item|post|article)\s+not\s+found[!.]?$/,
  // Common non-English templates.
  /^p[aá]gina\s+no\s+encontrada[!.]?$/,
  /^page\s+introuvable[!.]?$/,
  /^seite\s+nicht\s+gefunden[!.]?$/,
  /^पृष्ठ\s+नहीं\s+मिला[!।.]?$/,
];

/** Phrases that, on a near-empty page, say the page does not exist. */
const NOT_FOUND_BODY: RegExp[] = [
  /\bpage\s+(was\s+)?not\s+found\b/,
  /\b(error\s*)?404\b.{0,40}\bnot\s+found\b/,
  /\bpage\s+(you(\s+(are|were)|'re)\s+looking\s+for\s+)?(does\s+not|doesn't|no\s+longer)\s+exists?\b/,
  /\bpage\s+(you(\s+(are|were)|'re)\s+looking\s+for\s+)?(could\s+not|couldn't|cannot|can't)\s+be\s+found\b/,
  /\bwe\s+(could\s+not|couldn't|cannot|can't)\s+find\s+(that|this|the)\s+page\b/,
];

const SEPARATORS = /\s+[|–—\-:·•»]\s+|\s*[|–—·•»]\s*/;

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function segmentMatches(text: string | null | undefined): string | null {
  if (!text) return null;
  const whole = normalise(text);
  if (!whole) return null;
  const segments = [whole, ...whole.split(SEPARATORS).map((s) => s.trim()).filter(Boolean)];
  for (const segment of segments) {
    if (NOT_FOUND_SEGMENT.some((re) => re.test(segment))) return segment;
  }
  return null;
}

/**
 * Returns the matched signals when the page reads as "not found", or null.
 * Only ever fires on a 200: a real 404 is already reported as a broken page.
 */
export function detectSoft404(input: Soft404Input): Soft404Result | null {
  if (input.statusCode !== 200) return null;

  const signals: string[] = [];

  const titleHit = segmentMatches(input.title);
  if (titleHit) signals.push(`Title reads "${input.title!.trim()}"`);

  const h1Hit = (input.h1 ?? []).map((h) => ({ h, hit: segmentMatches(h) })).find((x) => x.hit);
  if (h1Hit) signals.push(`Main heading reads "${h1Hit.h.trim()}"`);

  if (input.wordCount < NEAR_EMPTY_WORDS && input.bodyText) {
    const body = normalise(input.bodyText).slice(0, 600);
    const bodyHit = NOT_FOUND_BODY.map((re) => body.match(re)).find(Boolean);
    if (bodyHit) signals.push(`Only ${input.wordCount} words of content, including "${bodyHit[0]}"`);
  }

  return signals.length > 0 ? { signals } : null;
}
