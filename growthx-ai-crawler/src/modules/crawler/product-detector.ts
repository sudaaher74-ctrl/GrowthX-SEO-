/**
 * Whether a crawled page is a product page, and what it says about the
 * product — for the Business module's Catalog (You) / Catalog (Them) tabs.
 *
 * Runs inside the crawl job Website Audit already starts; it is not a second
 * crawler. Three independent signals, cheapest and most reliable first:
 *
 * 1. schema.org `Product` JSON-LD — authoritative on its own when present.
 * 2. A price-pattern match in the page's visible text (currency symbol/code
 *    next to a number).
 * 3. A commerce or lead-gen call to action ("add to cart", "buy now",
 *    "enquire", "request a quote").
 *
 * Price and stock are two states each on the page, plus what a page never
 * is on its own — "not yet crawled" — so this module only ever returns FOUND
 * or NOT_PUBLISHED. NOT_YET_CRAWLED is a fact about a catalog with no
 * completed crawl, decided by the Business module's API, never by this file.
 */

export type CatalogFieldStatus = 'FOUND' | 'NOT_PUBLISHED';

export type CatalogCtaType = 'ADD_TO_CART' | 'BUY_NOW' | 'ENQUIRE' | 'REQUEST_QUOTE';

export interface ProductSignal {
  isProductPage: boolean;
  name: string | null;
  priceStatus: CatalogFieldStatus;
  /** Set only when priceStatus is FOUND. Minor currency units (paise/cents). */
  priceMinorUnits: number | null;
  currency: string | null;
  stockStatus: CatalogFieldStatus;
  /** Set only when stockStatus is FOUND. */
  stockValue: 'IN_STOCK' | 'OUT_OF_STOCK' | 'PREORDER' | null;
  category: string | null;
  ctaType: CatalogCtaType | null;
  hasProductSchema: boolean;
}

export interface ProductDetectorInput {
  url: string;
  /** Raw JSON-LD blocks as parsed by HtmlExtractorService — not yet @graph-flattened. */
  jsonLd: unknown[];
  /** The page's visible text, for the price-regex and CTA-keyword fallbacks. */
  bodyText: string;
  /** classifyPageType's own answer — a URL-path vote, folded in below MATCH_THRESHOLD strength. */
  pageTypeIsProduct: boolean;
}

/** Recursively expands arrays and `@graph` wrappers, same shape as SchemaValidatorService's. */
function flattenJsonLd(nodes: unknown[]): Record<string, any>[] {
  const out: Record<string, any>[] = [];
  for (const raw of nodes) {
    if (!raw) continue;
    let item: any = raw;
    if (typeof raw === 'string') {
      try {
        item = JSON.parse(raw);
      } catch {
        continue;
      }
    }
    if (Array.isArray(item)) {
      out.push(...flattenJsonLd(item));
      continue;
    }
    if (typeof item !== 'object' || item === null) continue;
    if (Array.isArray(item['@graph'])) {
      out.push(...flattenJsonLd(item['@graph']));
      continue;
    }
    out.push(item);
  }
  return out;
}

function findProductNode(jsonLd: unknown[]): Record<string, any> | null {
  for (const node of flattenJsonLd(jsonLd)) {
    const type = node['@type'];
    const types = Array.isArray(type) ? type : [type];
    if (types.some((t) => typeof t === 'string' && t.toLowerCase() === 'product')) return node;
  }
  return null;
}

const AVAILABILITY_MAP: Record<string, ProductSignal['stockValue']> = {
  instock: 'IN_STOCK',
  limitedavailability: 'IN_STOCK',
  onlineonly: 'IN_STOCK',
  instoreonly: 'IN_STOCK',
  preorder: 'PREORDER',
  presale: 'PREORDER',
  backorder: 'PREORDER',
  outofstock: 'OUT_OF_STOCK',
  soldout: 'OUT_OF_STOCK',
  discontinued: 'OUT_OF_STOCK',
}; // Maps a schema.org Offer.availability URL/token to a stock value, e.g. "https://schema.org/InStock" -> "instock".

function readAvailability(raw: unknown): ProductSignal['stockValue'] {
  if (typeof raw !== 'string') return null;
  const token = raw.trim().toLowerCase().replace(/^https?:\/\/schema\.org\//, '');
  return AVAILABILITY_MAP[token] ?? null;
}

/**
 * Currency symbol/code immediately next to a number. Anchored to a small set
 * of real currency markers rather than a bare "\d+(\.\d+)?" — the latter
 * matches a phone number or a word count on every page on the internet.
 */
const PRICE_PATTERN =
  /(?:₹|Rs\.?\s?|INR\s?|\$|USD\s?|€|EUR\s?|£|GBP\s?)\s?(\d{1,3}(?:[,\d]{0,10})(?:\.\d{1,2})?)/i;

const CURRENCY_BY_MARKER: { pattern: RegExp; code: string }[] = [
  { pattern: /₹|Rs\.?\s?|INR/i, code: 'INR' },
  { pattern: /\$|USD/i, code: 'USD' },
  { pattern: /€|EUR/i, code: 'EUR' },
  { pattern: /£|GBP/i, code: 'GBP' },
];

function priceFromText(text: string): { minorUnits: number; currency: string } | null {
  const match = PRICE_PATTERN.exec(text);
  if (!match) return null;
  const numeric = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const currency = CURRENCY_BY_MARKER.find((c) => c.pattern.test(match[0]))?.code ?? null;
  if (!currency) return null;
  return { minorUnits: Math.round(numeric * 100), currency };
}

/** Ordered: a page offering to sell outranks one only offering to be asked about. */
const CTA_RULES: { type: CatalogCtaType; pattern: RegExp }[] = [
  { type: 'ADD_TO_CART', pattern: /\badd to (cart|bag|basket)\b/i },
  { type: 'BUY_NOW', pattern: /\b(buy now|order now|shop now|purchase now)\b/i },
  { type: 'REQUEST_QUOTE', pattern: /\b(request (a )?quote|get (a )?quote|request pricing)\b/i },
  { type: 'ENQUIRE', pattern: /\b(enquire( now)?|enquiry|inquire( now)?|contact for price)\b/i },
];

function ctaFromText(text: string): CatalogCtaType | null {
  for (const rule of CTA_RULES) {
    if (rule.pattern.test(text)) return rule.type;
  }
  return null;
}

/** Segments that describe the URL's own routing, never a real product category. */
const GENERIC_PATH_SEGMENTS = new Set([
  'product',
  'products',
  'shop',
  'store',
  'item',
  'items',
  'category',
  'categories',
  'collection',
  'collections',
  'catalog',
  'catalogue',
  'p',
]);

function categoryFromUrl(url: string): string | null {
  let segments: string[];
  try {
    segments = new URL(url).pathname.toLowerCase().split('/').filter(Boolean);
  } catch {
    return null;
  }
  // The product's own slug is the last segment; walk backward from the one
  // before it for the nearest segment that names an actual category.
  for (let i = segments.length - 2; i >= 0; i--) {
    const segment = segments[i];
    if (GENERIC_PATH_SEGMENTS.has(segment)) continue;
    const words = segment.replace(/[-_]+/g, ' ').trim();
    if (words.length < 2) continue;
    return words.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return null;
}

export function detectProductSignals(input: ProductDetectorInput): ProductSignal {
  const productNode = findProductNode(input.jsonLd);
  const hasProductSchema = productNode !== null;

  const textPrice = priceFromText(input.bodyText);
  const ctaType = ctaFromText(input.bodyText);

  let priceStatus: CatalogFieldStatus = 'NOT_PUBLISHED';
  let priceMinorUnits: number | null = null;
  let currency: string | null = null;
  let stockStatus: CatalogFieldStatus = 'NOT_PUBLISHED';
  let stockValue: ProductSignal['stockValue'] = null;
  let name: string | null = null;
  let category: string | null = null;

  if (productNode) {
    name = typeof productNode.name === 'string' ? productNode.name.trim() || null : null;
    category = typeof productNode.category === 'string' ? productNode.category.trim() || null : null;

    const offers = Array.isArray(productNode.offers) ? productNode.offers[0] : productNode.offers;
    if (offers && typeof offers === 'object') {
      const rawPrice = offers.price ?? offers.priceSpecification?.price;
      const numericPrice = typeof rawPrice === 'string' ? Number(rawPrice) : rawPrice;
      if (typeof numericPrice === 'number' && Number.isFinite(numericPrice) && numericPrice > 0) {
        priceStatus = 'FOUND';
        priceMinorUnits = Math.round(numericPrice * 100);
        currency = offers.priceCurrency ?? offers.priceSpecification?.priceCurrency ?? null;
      }
      const availability = readAvailability(offers.availability);
      if (availability) {
        stockStatus = 'FOUND';
        stockValue = availability;
      }
    }
  }

  // The regex is a fallback, not an override: structured data already told
  // the truth once, and a page's own body text is never more reliable than
  // its own markup.
  if (priceStatus === 'NOT_PUBLISHED' && textPrice) {
    priceStatus = 'FOUND';
    priceMinorUnits = textPrice.minorUnits;
    currency = textPrice.currency;
  }

  if (!category) category = categoryFromUrl(input.url);

  const isProductPage =
    hasProductSchema ||
    (Boolean(textPrice) && ctaType !== null) ||
    (input.pageTypeIsProduct && (Boolean(textPrice) || ctaType !== null));

  return {
    isProductPage,
    name,
    priceStatus,
    priceMinorUnits,
    currency,
    stockStatus,
    stockValue,
    category,
    ctaType,
    hasProductSchema,
  };
}

/**
 * % of {name, price, currency, stock, category} that carry a real value.
 * NOT_PUBLISHED counts as unpopulated — it is a known absence, not a value —
 * so this is literally "share of fields populated", never a proxy for
 * "share of fields we bothered to check".
 */
export function completenessScore(signal: Pick<ProductSignal, 'name' | 'priceStatus' | 'currency' | 'stockStatus' | 'category'>): number {
  const checks = [
    Boolean(signal.name),
    signal.priceStatus === 'FOUND',
    Boolean(signal.currency),
    signal.stockStatus === 'FOUND',
    Boolean(signal.category),
  ];
  return checks.filter(Boolean).length / checks.length;
}

/**
 * 0-1, how confident the detector is that a competitor's page really is the
 * product it looks like — never computed for the project's own site, where
 * there is nothing to be uncertain about beyond what the page itself says.
 *
 * schema.org markup is a direct claim by the site, so it is trusted almost
 * outright. The regex/CTA path is inference over someone else's HTML, so it
 * is scored lower even when it clears the bar `isProductPage` sets.
 */
export function matchConfidence(signal: Pick<ProductSignal, 'hasProductSchema' | 'priceStatus' | 'ctaType'>): number {
  if (signal.hasProductSchema) return 0.95;
  if (signal.priceStatus === 'FOUND' && signal.ctaType) return 0.65;
  return 0.4;
}
