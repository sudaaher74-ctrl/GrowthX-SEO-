/**
 * Reading a Google results page: what kind of page each result is, what the
 * searcher evidently wants, and which kind of page Google prefers for it.
 *
 * Everything here works from what Google actually showed. Intent is not
 * guessed from the wording of the keyword: Google has already decided what
 * the searcher wants, and the results page is that decision written down.
 */

export type PageFormat =
  | 'PRODUCT'
  | 'CATEGORY'
  | 'MARKETPLACE'
  | 'ARTICLE'
  | 'LISTICLE'
  | 'COMPARISON'
  | 'VIDEO'
  | 'FORUM'
  | 'DIRECTORY'
  | 'HOMEPAGE'
  | 'SERVICE'
  | 'OTHER';

export const FORMAT_LABEL: Record<PageFormat, string> = {
  PRODUCT: 'product pages',
  CATEGORY: 'category or collection pages',
  MARKETPLACE: 'marketplace listings (Amazon, Flipkart and similar)',
  ARTICLE: 'articles and guides',
  LISTICLE: '"best of" and "top 10" lists',
  COMPARISON: 'comparison pages',
  VIDEO: 'videos',
  FORUM: 'forum and Q&A threads',
  DIRECTORY: 'directory and listing sites',
  HOMEPAGE: 'homepages',
  SERVICE: 'service pages',
  OTHER: 'other pages',
};

/** Formats that satisfy the same need, so a near-miss is not called a mismatch. */
const FAMILY: Record<PageFormat, string> = {
  PRODUCT: 'SHOP',
  CATEGORY: 'SHOP',
  MARKETPLACE: 'SHOP',
  ARTICLE: 'READ',
  LISTICLE: 'COMPARE',
  COMPARISON: 'COMPARE',
  VIDEO: 'READ',
  FORUM: 'READ',
  DIRECTORY: 'LOCAL',
  HOMEPAGE: 'BRAND',
  SERVICE: 'SERVICE',
  OTHER: 'OTHER',
};

const MARKETPLACES = /(^|\.)(amazon|flipkart|myntra|meesho|snapdeal|nykaa|ajio|tatacliq|jiomart|bigbasket|blinkit|zepto|swiggy|zomato|ebay|etsy|walmart|aliexpress|alibaba|indiamart|tradeindia|shopclues|pepperfry|urbanladder|1mg|pharmeasy|netmeds|firstcry|lenskart|croma|reliancedigital)\./;
const DIRECTORIES = /(^|\.)(justdial|sulekha|yelp|tripadvisor|yellowpages|practo|magicbricks|99acres|housing|nobroker|urbancompany|clutch|glassdoor|trustpilot|mouthshut|zaubacorp|tofler|crunchbase|g2|capterra)\./;
const VIDEO_SITES = /(^|\.)(youtube|vimeo|dailymotion)\.|^youtu\.be$/;
const FORUMS = /(^|\.)(reddit|quora|stackexchange|stackoverflow)\.|\/(forum|forums|community|discussion|threads?)\//;

/**
 * What kind of page a result is, from its address and title. Deliberately
 * coarse: the question is only whether Google prefers shops, articles, lists
 * or local listings for this search.
 */
export function classifyPage(url: string, title: string | null | undefined, pageType?: string | null): PageFormat {
  let host = '';
  let path = '/';
  try {
    const parsed = new URL(url);
    host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    path = parsed.pathname.toLowerCase();
  } catch {
    // Unparseable: fall through to the title.
  }
  const t = (title ?? '').toLowerCase();

  if (VIDEO_SITES.test(host)) return 'VIDEO';
  if (FORUMS.test(host) || FORUMS.test(path)) return 'FORUM';
  if (MARKETPLACES.test(host)) return 'MARKETPLACE';
  if (DIRECTORIES.test(host)) return 'DIRECTORY';

  // Our own crawl already typed the customer's pages; trust it where it is specific.
  const crawled = pageType?.toUpperCase();
  if (crawled === 'PRODUCT') return 'PRODUCT';
  if (crawled === 'CATEGORY') return 'CATEGORY';
  if (crawled === 'HOME') return 'HOMEPAGE';
  if (crawled === 'BLOG') {
    if (/\bvs\.?\b|versus/.test(t)) return 'COMPARISON';
    if (/^(the\s+)?(\d+\s+)?(best|top)\b|\b(top|best)\s+\d+\b|^\d+\s+/.test(t)) return 'LISTICLE';
    return 'ARTICLE';
  }

  if (/\bvs\.?\b|\bversus\b/.test(t) || /-vs-/.test(path)) return 'COMPARISON';
  if (/^(the\s+)?(\d+\s+)?(best|top)\b|\b(top|best)\s+\d+\b|^\d+\s+(best|top|ways|tips|things|ideas|reasons)\b/.test(t)) return 'LISTICLE';
  if (/\/(product|products|p|dp|item|items|buy)\/|\/[^/]*-p-\d+|\bbuy\b.*\bonline\b/.test(`${path} ${t}`)) return 'PRODUCT';
  if (/\/(collections?|category|categories|shop|c|catalog|store)\/?/.test(path)) return 'CATEGORY';
  if (/\/(blog|blogs|news|article|articles|guide|guides|learn|resources|insights|how-to|wiki)\/|\/\d{4}\/\d{2}\//.test(path)) return 'ARTICLE';
  if (/^(how|what|why|when|where|who|which|can|is|are|does|do)\b|\bguide\b|\bexplained\b|\btips\b/.test(t)) return 'ARTICLE';
  if (/\/(services?|solutions?)\//.test(path)) return 'SERVICE';
  if (path === '/' || path === '') return 'HOMEPAGE';
  return 'OTHER';
}

export function sameFamily(a: PageFormat, b: PageFormat): boolean {
  return a === b || FAMILY[a] === FAMILY[b];
}

export interface DominantFormat {
  format: PageFormat;
  label: string;
  count: number;
  of: number;
  counts: Array<{ format: PageFormat; label: string; count: number }>;
}

/** The kind of page that fills most of the results read. */
export function dominantFormat(results: Array<{ format: PageFormat }>): DominantFormat | null {
  if (results.length === 0) return null;
  const counts = new Map<PageFormat, number>();
  for (const r of results) counts.set(r.format, (counts.get(r.format) ?? 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [format, count] = sorted[0];
  return {
    format,
    label: FORMAT_LABEL[format],
    count,
    of: results.length,
    counts: sorted.map(([f, c]) => ({ format: f, label: FORMAT_LABEL[f], count: c })),
  };
}

/** Google's result types in plain words. Unknown types keep their own name. */
const FEATURE_LABEL: Record<string, string> = {
  featured_snippet: 'a highlighted answer box at the top',
  answer_box: 'a direct answer box',
  people_also_ask: '"People also ask" questions',
  local_pack: 'a map with local businesses',
  map: 'a map',
  local_services: 'local service ads',
  shopping: 'shopping results with prices',
  popular_products: 'popular products with prices',
  commercial_units: 'product listings',
  refine_products: 'product filters',
  paid: 'ads',
  video: 'videos',
  short_videos: 'short videos',
  images: 'images',
  top_stories: 'news stories',
  knowledge_graph: 'an information panel',
  ai_overview: 'an AI overview',
  discussions_and_forums: 'forum discussions',
  perspectives: 'personal perspectives',
  related_searches: 'related searches',
  google_reviews: 'Google reviews',
  third_party_reviews: 'review site ratings',
  recipes: 'recipes',
  jobs: 'job listings',
  hotels_pack: 'hotel listings',
  top_sights: 'places to visit',
  events: 'events',
  questions_and_answers: 'questions and answers',
  explore_brands: 'brands to explore',
  find_results_on: '"find results on" links to other sites',
  carousel: 'a carousel',
  twitter: 'posts from X (Twitter)',
  scholarly_articles: 'research papers',
};

export function featureLabel(type: string): string {
  return FEATURE_LABEL[type] ?? type.replace(/_/g, ' ');
}

export type SearchIntent = 'TRANSACTIONAL' | 'COMMERCIAL' | 'INFORMATIONAL' | 'LOCAL' | 'NAVIGATIONAL';

export const INTENT_LABEL: Record<SearchIntent, string> = {
  TRANSACTIONAL: 'wants to buy',
  COMMERCIAL: 'is comparing options before buying',
  INFORMATIONAL: 'wants to learn or get an answer',
  LOCAL: 'wants a business nearby',
  NAVIGATIONAL: 'is looking for one particular brand or site',
};

export interface IntentReading {
  primary: SearchIntent;
  primaryLabel: string;
  /** A close second, when the results are mixed. */
  secondary: SearchIntent | null;
  /** What on the results page points to it, in plain words. */
  evidence: string[];
}

const LOCAL_FEATURES = ['local_pack', 'map', 'local_services', 'hotels_pack'];
const SHOP_FEATURES = ['shopping', 'popular_products', 'commercial_units', 'refine_products'];
const LEARN_FEATURES = ['featured_snippet', 'answer_box', 'people_also_ask', 'knowledge_graph', 'top_stories', 'video', 'short_videos', 'scholarly_articles', 'ai_overview'];

/**
 * What the searcher wants, read from what Google chose to show them: result
 * types on the page and the kinds of page in the top results.
 */
export function intentFromResults(
  features: string[],
  top: Array<{ format: PageFormat; domain: string }>,
): IntentReading {
  const score: Record<SearchIntent, number> = { TRANSACTIONAL: 0, COMMERCIAL: 0, INFORMATIONAL: 0, LOCAL: 0, NAVIGATIONAL: 0 };
  const evidence: string[] = [];
  const has = (list: string[]) => list.filter((f) => features.includes(f));

  const local = has(LOCAL_FEATURES);
  if (local.length) {
    score.LOCAL += 4;
    evidence.push(`Google shows ${local.map(featureLabel).join(' and ')}.`);
  }
  const shop = has(SHOP_FEATURES);
  if (shop.length) {
    score.TRANSACTIONAL += 3;
    evidence.push(`Google shows ${shop.map(featureLabel).join(' and ')}.`);
  }
  const learn = has(LEARN_FEATURES);
  if (learn.length) {
    score.INFORMATIONAL += Math.min(3, learn.length);
    evidence.push(`Google shows ${learn.map(featureLabel).join(', ')}.`);
  }

  const n = top.length;
  if (n > 0) {
    const count = (formats: PageFormat[]) => top.filter((r) => formats.includes(r.format)).length;
    const shopPages = count(['PRODUCT', 'CATEGORY', 'MARKETPLACE']);
    const readPages = count(['ARTICLE', 'VIDEO', 'FORUM']);
    const comparePages = count(['LISTICLE', 'COMPARISON']);
    const localPages = count(['DIRECTORY']);
    score.TRANSACTIONAL += (shopPages / n) * 6;
    score.INFORMATIONAL += (readPages / n) * 6;
    score.COMMERCIAL += (comparePages / n) * 6;
    score.LOCAL += (localPages / n) * 4;
    if (shopPages) evidence.push(`${shopPages} of the top ${n} results are shops or product pages.`);
    if (readPages) evidence.push(`${readPages} of the top ${n} results are articles, videos or forum threads.`);
    if (comparePages) evidence.push(`${comparePages} of the top ${n} results are "best of" lists or comparisons.`);
    if (localPages) evidence.push(`${localPages} of the top ${n} results are business directories.`);

    // One domain holding several of the top results, led by its homepage, is
    // someone looking for that brand.
    const byDomain = new Map<string, number>();
    for (const r of top.slice(0, 5)) byDomain.set(r.domain, (byDomain.get(r.domain) ?? 0) + 1);
    const [leadDomain, leadCount] = [...byDomain.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
    if (leadCount >= 3 && top[0]?.domain === leadDomain) {
      score.NAVIGATIONAL += 6;
      evidence.push(`${leadCount} of the top 5 results are from ${leadDomain}, so searchers are looking for that brand.`);
    }
  }

  const ranked = (Object.keys(score) as SearchIntent[]).sort((a, b) => score[b] - score[a]);
  const primary = score[ranked[0]] > 0 ? ranked[0] : 'INFORMATIONAL';
  const second = ranked[1];
  const secondary = score[second] > 0 && score[second] >= score[primary] * 0.6 ? second : null;
  return { primary, primaryLabel: INTENT_LABEL[primary], secondary, evidence };
}

const STOPWORDS = new Set(['a', 'an', 'the', 'of', 'for', 'in', 'on', 'to', 'and', 'or', 'with', 'at', 'by', 'from', 'is', 'are', 'my', 'me', 'near']);

/** The words of a keyword that carry its meaning, lightly stemmed. */
export function keywordTerms(keyword: string): string[] {
  return keyword
    .toLowerCase()
    .normalize('NFKC')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w && !STOPWORDS.has(w))
    .map(stem);
}

function stem(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/** Whether every meaningful word of the keyword appears in the text. */
export function containsKeyword(text: string | null | undefined, keyword: string): boolean {
  if (!text) return false;
  const terms = keywordTerms(keyword);
  if (terms.length === 0) return false;
  const words = new Set(keywordTerms(text));
  return terms.every((t) => words.has(t));
}

export function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2);
}
