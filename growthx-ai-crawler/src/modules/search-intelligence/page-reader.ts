import * as cheerio from 'cheerio';

export interface PageFacts {
  title: string | null;
  h1: string[];
  h2Count: number;
  /** Words in the main content, navigation, header and footer removed. */
  wordCount: number;
  /** schema.org types in the page's JSON-LD, e.g. "Product", "FAQPage". */
  schemaTypes: string[];
  metaRobots: string | null;
  canonical: string | null;
  /** The first words of the main content, for "does it mention the keyword early". */
  opening: string;
}

function collectTypes(node: unknown, into: Set<string>): void {
  if (Array.isArray(node)) {
    for (const item of node) collectTypes(item, into);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;
  const type = obj['@type'];
  if (typeof type === 'string') into.add(type);
  else if (Array.isArray(type)) for (const t of type) if (typeof t === 'string') into.add(t);
  if (obj['@graph']) collectTypes(obj['@graph'], into);
  if (obj.mainEntity) collectTypes(obj.mainEntity, into);
}

/**
 * The same handful of facts read the same way from any page, ours or a
 * competitor's, so the two can be set side by side without one being measured
 * by the crawler and the other by something else.
 */
export function readPage(html: string): PageFacts {
  const $ = cheerio.load(html || '');
  const title = $('head > title').first().text().trim() || $('title').first().text().trim() || null;
  const h1 = $('h1')
    .map((_, el) => $(el).text().replace(/\s+/g, ' ').trim())
    .get()
    .filter(Boolean);
  const h2Count = $('h2').length;

  const types = new Set<string>();
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      collectTypes(JSON.parse($(el).contents().text()), types);
    } catch {
      // Malformed JSON-LD carries no type we can read.
    }
  });

  const metaRobots = $('meta[name="robots" i]').attr('content')?.trim() || null;
  const canonical = $('link[rel="canonical" i]').attr('href')?.trim() || null;

  $('script, style, noscript, template, svg, nav, header, footer, aside, form, iframe').remove();
  const main = $('main').first().length ? $('main').first() : $('article').first().length ? $('article').first() : $('body');
  const text = main.text().replace(/\s+/g, ' ').trim();
  const words = text ? text.split(' ').filter((w) => /[\p{L}\p{N}]/u.test(w)) : [];

  return {
    title,
    h1,
    h2Count,
    wordCount: words.length,
    schemaTypes: [...types].sort(),
    metaRobots,
    canonical,
    opening: words.slice(0, 120).join(' '),
  };
}
