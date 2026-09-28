/**
 * Business → Marketing Strategy: what each competitor sells and pushes, how
 * their prices compare with yours, and what to do about it.
 *
 * Two halves, kept apart on purpose:
 *
 * - Facts, counted here from what the crawls stored: products and prices from
 *   both catalogs, and — for each competitor — the products their own website
 *   promotes hardest, with the evidence (how many of their pages link to it,
 *   whether the homepage does, which of their articles point at it, and the
 *   words they link to it with).
 * - A strategy written by Sarvam from those facts, checked against them: a
 *   product it talks about must be one of the products listed, or it is
 *   dropped.
 *
 * Nobody outside a business can see its sales, so nothing here claims to.
 * What a site links to from its homepage, its menus and its articles is what
 * it is trying hardest to sell — a real signal, reported as exactly that.
 */

import { demandPromptLines, indexSearches, Measured, measure, SearchDemand } from '../integrations/google/search-demand';

/** Page kinds that are never a product for sale. */
const NOT_A_PRODUCT = new Set(['HOME', 'BLOG', 'LEGAL', 'STATIC', 'CONTACT', 'ABOUT', 'FAQ', 'CASE_STUDY']);

export const PUSHED_PER_RIVAL = 6;
const PRODUCTS_SAMPLED = 25;
const RIVAL_PRODUCTS_KEPT = 8;
const KEYWORDS_KEPT = 8;
const BLOGS_KEPT = 5;
const ACTIONS_KEPT = 5;
const PRICING_KEPT = 4;

export interface StrategyProduct {
  name: string;
  url: string;
  /** As the page showed it, e.g. "₹198.00"; null when the page shows no price. */
  price: string | null;
  category: string | null;
}

export interface RivalPush {
  url: string;
  name: string;
  /** Why this page is on the list: a recognised product, a product-type page, or a much-linked page that may be one. */
  source: 'catalog' | 'product-page' | 'linked-page';
  price: string | null;
  /** Distinct pages of their own site that link to it. */
  linkedFrom: number;
  onHomepage: boolean;
  /** Their articles that link to it. */
  fromArticles: Array<{ title: string; url: string }>;
  /** Words their pages use when linking to it. */
  linkWords: string[];
  headline: string | null;
}

export interface PriceBand {
  min: number;
  max: number;
  count: number;
  currency: string;
}

export interface PriceRow {
  category: string;
  you: PriceBand | null;
  them: Array<{ competitor: string; band: PriceBand }>;
}

export interface StrategyCompetitor {
  id: string;
  name: string;
  domain: string;
  pagesRead: number;
  productCount: number;
  pricedCount: number;
  products: StrategyProduct[];
  pushed: RivalPush[];
  positioning: Positioning | null;
}

export interface Positioning {
  valueProps: string[];
  promos: string[];
  tone: string | null;
}

export interface StrategyFacts {
  business: { name: string | null; domain: string | null };
  you: { productCount: number; pricedCount: number; products: StrategyProduct[]; positioning: Positioning | null };
  competitors: StrategyCompetitor[];
  prices: PriceRow[];
  /** Real Google searches the site appears in (Search Console). Absent on reports written before it existed. */
  search?: SearchDemand;
}

export interface RivalProductPlay {
  competitor: string;
  url: string;
  whyItWorks: string;
  keywords: string[];
  counter: string[];
}

export interface StrategyKeyword {
  phrase: string;
  why: string;
  forProduct: string | null;
  /** Google's numbers when this is one of the searches the site already appears in; null means a suggestion only. */
  measured?: Measured | null;
}

export interface StrategyBlogPost {
  title: string;
  covers: string;
  keyword: string;
}

export interface StrategyAction {
  title: string;
  why: string;
  steps: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface MarketingStrategy {
  summary: string;
  rivalProducts: RivalProductPlay[];
  pricing: string[];
  keywords: StrategyKeyword[];
  blogPosts: StrategyBlogPost[];
  positioning: { yourEdge: string; theirAngle: string; message: string } | null;
  actions: StrategyAction[];
}

export interface BusinessStrategyReport {
  generatedAt: string;
  facts: StrategyFacts;
  strategy: MarketingStrategy | null;
  /** Why the strategy could not be written, when it could not. The facts stand either way. */
  strategyError: string | null;
  model: string | null;
}

// ---------------------------------------------------------------- facts

export interface CatalogRow {
  url: string;
  name: string | null;
  priceStatus: string;
  priceMinorUnits: number | null;
  currency: string | null;
  category: string | null;
}

export interface CrawledPage {
  url: string;
  title: string | null;
  h1: string[];
  pageType: string;
}

export interface LinkRow {
  targetUrl: string;
  anchorText: string | null;
  sourceUrl: string;
  sourceTitle: string | null;
  sourceType: string;
}

const SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'AED ' };

export function formatPrice(minor: number | null, currency: string | null): string | null {
  if (minor == null) return null;
  const amount = (minor / 100).toFixed(minor % 100 === 0 ? 0 : 2);
  const code = (currency ?? '').toUpperCase();
  return `${SYMBOLS[code] ?? (code ? `${code} ` : '')}${amount}`;
}

const cleanText = (v: string | null | undefined) => (v ?? '').replace(/\s+/g, ' ').trim();

export function toStrategyProducts(rows: CatalogRow[]): StrategyProduct[] {
  return rows
    .map((r) => ({
      name: cleanText(r.name) || pathName(r.url),
      url: r.url,
      price: r.priceStatus === 'FOUND' ? formatPrice(r.priceMinorUnits, r.currency) : null,
      category: r.category,
    }))
    .slice(0, PRODUCTS_SAMPLED);
}

/** A readable name from an address, for a product page with no name of its own. */
export function pathName(url: string): string {
  try {
    const last = new URL(url).pathname.split('/').filter(Boolean).pop() ?? '';
    return decodeURIComponent(last).replace(/\.(php|html?|aspx?)$/i, '').replace(/[-_]+/g, ' ').trim() || url;
  } catch {
    return url;
  }
}

/**
 * The products a competitor's own website pushes hardest, with the evidence.
 *
 * Candidates are their recognised products and product-type pages. A site
 * that shows no prices or product markup (a shop run from an app, say) has
 * neither, so its most-linked ordinary pages are offered instead, marked as
 * "linked-page" — pages that may be products — never as products.
 */
export function rankPushedProducts(input: {
  catalog: CatalogRow[];
  pages: CrawledPage[];
  links: LinkRow[];
  limit?: number;
}): RivalPush[] {
  const limit = input.limit ?? PUSHED_PER_RIVAL;
  const pageByUrl = new Map(input.pages.map((p) => [p.url, p]));
  const catalogByUrl = new Map(input.catalog.map((c) => [c.url, c]));

  // Distinct linking pages, homepage links, article links and link words, per target.
  const inbound = new Map<string, { from: Set<string>; home: boolean; articles: Map<string, string>; words: Map<string, number> }>();
  for (const link of input.links) {
    if (link.sourceUrl === link.targetUrl) continue;
    let entry = inbound.get(link.targetUrl);
    if (!entry) {
      entry = { from: new Set(), home: false, articles: new Map(), words: new Map() };
      inbound.set(link.targetUrl, entry);
    }
    entry.from.add(link.sourceUrl);
    if (link.sourceType === 'HOME') entry.home = true;
    if (link.sourceType === 'BLOG') entry.articles.set(link.sourceUrl, cleanText(link.sourceTitle) || pathName(link.sourceUrl));
    const word = cleanText(link.anchorText);
    if (word && word.length <= 60 && !/^(click here|read more|view|shop now|buy now|add to cart|more|here|learn more|order now)$/i.test(word)) {
      entry.words.set(word, (entry.words.get(word) ?? 0) + 1);
    }
  }

  const candidates = new Map<string, RivalPush['source']>();
  for (const c of input.catalog) candidates.set(c.url, 'catalog');
  for (const p of input.pages) if (p.pageType === 'PRODUCT' && !candidates.has(p.url)) candidates.set(p.url, 'product-page');
  if (candidates.size < 3) {
    const linked = input.pages
      .filter((p) => !NOT_A_PRODUCT.has(p.pageType) && !candidates.has(p.url) && cleanText(p.title))
      .map((p) => ({ url: p.url, links: inbound.get(p.url)?.from.size ?? 0 }))
      .filter((p) => p.links > 0)
      .sort((a, b) => b.links - a.links)
      .slice(0, limit);
    for (const p of linked) candidates.set(p.url, 'linked-page');
  }

  const ranked: Array<RivalPush & { score: number }> = [];
  for (const [url, source] of candidates) {
    const page = pageByUrl.get(url);
    const product = catalogByUrl.get(url);
    const entry = inbound.get(url);
    const linkedFrom = entry?.from.size ?? 0;
    const onHomepage = entry?.home ?? false;
    const fromArticles = [...(entry?.articles ?? new Map<string, string>()).entries()].slice(0, 3).map(([u, title]) => ({ url: u, title }));
    const linkWords = [...(entry?.words ?? new Map<string, number>()).entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([w]) => w);
    const headline = cleanText(page?.h1?.[0]) || null;
    ranked.push({
      url,
      name: cleanText(product?.name) || cleanText(page?.title) || headline || pathName(url),
      source,
      price: product?.priceStatus === 'FOUND' ? formatPrice(product.priceMinorUnits, product.currency) : null,
      linkedFrom,
      onHomepage,
      fromArticles,
      linkWords,
      headline,
      score: linkedFrom + (onHomepage ? 5 : 0) + 3 * (entry?.articles.size ?? 0),
    });
  }

  return ranked
    .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url))
    .slice(0, limit)
    .map(({ score: _score, ...push }) => push);
}

function band(rows: CatalogRow[]): PriceBand | null {
  const priced = rows.filter((r) => r.priceStatus === 'FOUND' && r.priceMinorUnits != null && r.currency);
  if (priced.length === 0) return null;
  // One currency per band: the most common one. A price in another currency
  // is not comparable without a rate, so it is left out rather than mixed in.
  const counts = new Map<string, number>();
  for (const r of priced) counts.set(r.currency!, (counts.get(r.currency!) ?? 0) + 1);
  const currency = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const values = priced.filter((r) => r.currency === currency).map((r) => r.priceMinorUnits!);
  return { min: Math.min(...values), max: Math.max(...values), count: values.length, currency };
}

/** Price ranges per category, yours beside each competitor's, where anyone publishes prices. */
export function buildPriceRows(mine: CatalogRow[], competitors: Array<{ name: string; products: CatalogRow[] }>): PriceRow[] {
  const categories = new Set<string>();
  for (const r of mine) if (r.category) categories.add(r.category);
  for (const c of competitors) for (const r of c.products) if (r.category) categories.add(r.category);

  const rows: PriceRow[] = [];
  for (const category of categories) {
    const you = band(mine.filter((r) => r.category === category));
    const them = competitors
      .map((c) => ({ competitor: c.name, band: band(c.products.filter((r) => r.category === category)) }))
      .filter((t): t is { competitor: string; band: PriceBand } => t.band !== null);
    // A category only they price is kept: "they show prices, you don't" is itself the finding.
    if (them.length === 0) continue;
    rows.push({ category, you, them });
  }
  return rows.sort((a, b) => b.them.length - a.them.length || a.category.localeCompare(b.category)).slice(0, 12);
}

// ---------------------------------------------------------------- prompt

const bandText = (b: PriceBand) =>
  b.min === b.max ? `${formatPrice(b.min, b.currency)} (${b.count})` : `${formatPrice(b.min, b.currency)}–${formatPrice(b.max, b.currency)} (${b.count})`;

function positioningText(p: Positioning | null): string {
  if (!p) return '  (not read)';
  return [
    p.valueProps.length ? `  Says: ${p.valueProps.join(' | ')}` : '',
    p.promos.length ? `  Offers: ${p.promos.join(' | ')}` : '',
    p.tone ? `  Tone: ${p.tone}` : '',
  ]
    .filter(Boolean)
    .join('\n') || '  (nothing stated)';
}

export function buildStrategyPrompt(facts: StrategyFacts): string {
  const yourProducts = facts.you.products
    .map((p) => `  - ${p.name}${p.price ? ` — ${p.price}` : ' — no price shown'}${p.category ? ` [${p.category}]` : ''}`)
    .join('\n');

  const rivals = facts.competitors
    .map((c) => {
      const pushed = c.pushed
        .map((p) => {
          const evidence = [
            `linked from ${p.linkedFrom} of their pages`,
            p.onHomepage ? 'linked from their homepage' : '',
            p.fromArticles.length ? `articles pointing to it: ${p.fromArticles.map((a) => `"${a.title}"`).join(', ')}` : '',
            p.linkWords.length ? `link words: ${p.linkWords.map((w) => `"${w}"`).join(', ')}` : '',
          ]
            .filter(Boolean)
            .join('; ');
          const kind = p.source === 'linked-page' ? ' (a much-linked page; may be a product)' : '';
          return `    - ${p.url}\n      "${p.name}"${p.price ? ` — ${p.price}` : ''}${kind}\n      ${evidence}`;
        })
        .join('\n');
      const products = c.products
        .slice(0, 12)
        .map((p) => `    - ${p.name}${p.price ? ` — ${p.price}` : ''}`)
        .join('\n');
      return `COMPETITOR: ${c.name} (${c.domain}) — ${c.pagesRead} pages read, ${c.productCount} products found, ${c.pricedCount} with a price
  Positioning:
${positioningText(c.positioning)}
  Products they push hardest (by how their own site links to them):
${pushed || '    (none found)'}
  Other products:
${products || '    (none found)'}`;
    })
    .join('\n\n');

  const prices = facts.prices
    .map((r) => `  - ${r.category}: you ${r.you ? bandText(r.you) : 'no price'}; ${r.them.map((t) => `${t.competitor} ${bandText(t.band)}`).join('; ')}`)
    .join('\n');

  return `You are writing a marketing strategy for a small business owner who knows nothing about SEO or marketing jargon.

BUSINESS: ${facts.business.name ?? ''} (${facts.business.domain ?? 'unknown'})
Their positioning:
${positioningText(facts.you.positioning)}
Their products (${facts.you.productCount} found, ${facts.you.pricedCount} with a price):
${yourProducts || '  (none found on their website)'}

${rivals || 'No competitors have been read yet.'}

PRICES BY CATEGORY (lowest–highest, number of priced products)
${prices || '  (no category where both sides show prices)'}
${facts.search ? `\n${demandPromptLines(facts.search, pathOnly)}\n` : ''}
Return JSON exactly in this shape:
{
  "summary": "2-3 plain sentences: where this business stands against its competitors on products, prices and marketing",
  "rivalProducts": [
    { "url": "an address copied exactly from a 'push hardest' list above", "whyItWorks": "1-2 plain sentences on why this product is likely doing well for them, based only on the evidence listed", "keywords": ["search phrases their page and links use for it"], "counter": ["2-4 concrete steps this business can take to compete for the same customers"] }
  ],
  "pricing": ["up to ${PRICING_KEPT} plain sentences of pricing advice, using only the prices listed above"],
  "keywords": [ { "phrase": "what a customer types into Google, 2-6 words", "why": "one plain sentence", "forProduct": "one of this business's products by name, or null" } ],
  "blogPosts": [ { "title": "a blog post title", "covers": "1-2 plain sentences", "keyword": "the phrase it targets" } ],
  "positioning": { "yourEdge": "what this business can honestly say it does better", "theirAngle": "what the competitors lead with", "message": "one headline this business should use" },
  "actions": [ { "title": "a short task", "why": "one plain sentence", "steps": ["2-4 simple steps"], "priority": "high|medium|low" } ]
}

Rules:
- rivalProducts: up to ${RIVAL_PRODUCTS_KEPT}, only addresses from the "push hardest" lists, the strongest first. Pages marked "may be a product" only if their name clearly is a product for sale.
- Nobody can see a competitor's sales. Say "they push" or "they promote", never "best-selling" or "sells the most".
- keywords: ${KEYWORDS_KEPT - 2}-${KEYWORDS_KEPT}. Where one of the real Google searches listed above fits, use that exact search as the phrase, especially the ones it almost wins. blogPosts: ${BLOGS_KEPT - 1}-${BLOGS_KEPT}, each countering something a competitor does. actions: 3-${ACTIONS_KEPT}, most important first.
- Only quote prices listed above. Do not invent sales figures, search volumes, rankings, percentages or products.
- Plain everyday words, no jargon.`;
}

export const STRATEGY_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    rivalProducts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          whyItWorks: { type: 'string' },
          keywords: { type: 'array', items: { type: 'string' } },
          counter: { type: 'array', items: { type: 'string' } },
        },
        required: ['url', 'whyItWorks', 'keywords', 'counter'],
      },
    },
    pricing: { type: 'array', items: { type: 'string' } },
    keywords: {
      type: 'array',
      items: {
        type: 'object',
        properties: { phrase: { type: 'string' }, why: { type: 'string' }, forProduct: { type: 'string' } },
        required: ['phrase', 'why'],
      },
    },
    blogPosts: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, covers: { type: 'string' }, keyword: { type: 'string' } },
        required: ['title', 'covers', 'keyword'],
      },
    },
    positioning: {
      type: 'object',
      properties: { yourEdge: { type: 'string' }, theirAngle: { type: 'string' }, message: { type: 'string' } },
    },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          why: { type: 'string' },
          steps: { type: 'array', items: { type: 'string' } },
          priority: { type: 'string' },
        },
        required: ['title', 'why', 'steps'],
      },
    },
  },
  required: ['summary', 'rivalProducts', 'keywords', 'blogPosts', 'actions'],
};

// ---------------------------------------------------------------- checking the answer

const str = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').replace(/^["'“”]+|["'“”]+$/g, '').trim().slice(0, max) : '';

const strList = (v: unknown, max: number, each = 200): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of Array.isArray(v) ? v : []) {
    const s = str(item, each);
    if (!s || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
};

/** "Best-selling" is a claim about sales nobody here measured. */
const SALES_CLAIM = /\b(best[- ]?sell(?:ing|er)s?|top[- ]?sell(?:ing|er)s?|sells? the most|most sold|highest[- ]selling)\b/gi;
const withoutSalesClaims = (s: string) => s.replace(SALES_CLAIM, 'most promoted');

/**
 * The model's answer, held to the facts: a rival product must be one of the
 * pushed products listed for that competitor, every list is capped, and a
 * sales claim is reworded to what was actually observed.
 */
export function normaliseStrategy(raw: Record<string, unknown>, facts: StrategyFacts): MarketingStrategy {
  const owner = new Map<string, string>();
  for (const c of facts.competitors) for (const p of c.pushed) owner.set(p.url, c.name);

  const rivalProducts: RivalProductPlay[] = [];
  const seenUrls = new Set<string>();
  for (const item of Array.isArray(raw.rivalProducts) ? raw.rivalProducts : []) {
    const url = str((item as any)?.url, 500);
    const competitor = owner.get(url);
    if (!competitor || seenUrls.has(url)) continue;
    seenUrls.add(url);
    rivalProducts.push({
      competitor,
      url,
      whyItWorks: withoutSalesClaims(str((item as any)?.whyItWorks, 400)),
      keywords: strList((item as any)?.keywords, 5, 80),
      counter: strList((item as any)?.counter, 4, 240).map(withoutSalesClaims),
    });
    if (rivalProducts.length >= RIVAL_PRODUCTS_KEPT) break;
  }

  const productNames = new Set(facts.you.products.map((p) => p.name.toLowerCase()));
  const searches = facts.search?.status === 'OK' ? indexSearches([...facts.search.topSearches, ...facts.search.almostWinning]) : null;
  const keywords: StrategyKeyword[] = [];
  const seenPhrases = new Set<string>();
  for (const item of Array.isArray(raw.keywords) ? raw.keywords : []) {
    const phrase = str((item as any)?.phrase, 80);
    if (!phrase || seenPhrases.has(phrase.toLowerCase())) continue;
    seenPhrases.add(phrase.toLowerCase());
    const forProduct = str((item as any)?.forProduct, 160);
    keywords.push({
      phrase,
      why: str((item as any)?.why, 300),
      forProduct: productNames.has(forProduct.toLowerCase()) ? forProduct : null,
      // Numbers come from Search Console, matched by the same words, never from the model.
      measured: searches ? measure(phrase, searches, facts.search!.days) : null,
    });
    if (keywords.length >= KEYWORDS_KEPT) break;
  }

  const blogPosts: StrategyBlogPost[] = [];
  const seenTitles = new Set<string>();
  for (const item of Array.isArray(raw.blogPosts) ? raw.blogPosts : []) {
    const title = str((item as any)?.title, 160);
    if (!title || seenTitles.has(title.toLowerCase())) continue;
    seenTitles.add(title.toLowerCase());
    blogPosts.push({ title, covers: str((item as any)?.covers, 400), keyword: str((item as any)?.keyword, 80) });
    if (blogPosts.length >= BLOGS_KEPT) break;
  }

  const actions: StrategyAction[] = [];
  for (const item of Array.isArray(raw.actions) ? raw.actions : []) {
    const title = str((item as any)?.title, 140);
    const steps = strList((item as any)?.steps, 5, 240);
    if (!title || steps.length === 0) continue;
    const priority = str((item as any)?.priority, 10).toLowerCase();
    actions.push({
      title: withoutSalesClaims(title),
      why: withoutSalesClaims(str((item as any)?.why, 300)),
      steps: steps.map(withoutSalesClaims),
      priority: priority === 'high' || priority === 'low' ? priority : 'medium',
    });
    if (actions.length >= ACTIONS_KEPT) break;
  }

  const pos = raw.positioning as Record<string, unknown> | undefined;
  const positioning =
    pos && (str(pos.yourEdge, 10) || str(pos.message, 10))
      ? { yourEdge: str(pos.yourEdge, 300), theirAngle: str(pos.theirAngle, 300), message: str(pos.message, 200) }
      : null;

  return {
    summary: withoutSalesClaims(str(raw.summary, 700)),
    rivalProducts,
    pricing: strList(raw.pricing, PRICING_KEPT, 300).map(withoutSalesClaims),
    keywords,
    blogPosts,
    positioning,
    actions,
  };
}

function pathOnly(url: string): string {
  try {
    return new URL(url).pathname || '/';
  } catch {
    return url;
  }
}
