/**
 * What kind of page this is, from its URL and its own headings.
 *
 * Every gap comparison in the product needs this on both sides: "they have 24
 * service pages you don't" is only answerable once a service page can be told
 * from a blog post. Without it, a competitor's 200 URLs and yours are two
 * numbers that cannot be compared.
 *
 * Rules rather than a model. The signal lives in the URL path on almost every
 * site, the answer must be identical on two runs for a diff to mean anything,
 * and classifying a few hundred pages per crawl through an LLM would cost more
 * than the rest of the crawl put together.
 */
export type PageType =
  | 'HOME'
  | 'SERVICE'
  | 'PRODUCT'
  | 'LOCATION'
  | 'BLOG'
  | 'CASE_STUDY'
  | 'FAQ'
  | 'ABOUT'
  | 'CONTACT'
  | 'LEGAL'
  | 'OTHER';

/**
 * Ordered: the first match wins, so the more specific patterns come first.
 * `/services/kitchens-in-mumbai` is a service page that happens to name a
 * place, not a location page — putting LOCATION last keeps it that way.
 *
 * The keyword may sit anywhere in a path segment, not only at its start. These
 * rules originally anchored on a leading slash, which missed the prefixed
 * segments a great many sites use: the real competitor crawled here publishes
 * `/our-products/` and `/our-team/`, and both typed as OTHER. That is not a
 * cosmetic miss — their catalogue read as zero product pages against a
 * customer whose own URLs happen to be `/products/...`, so the comparison
 * announced a 32-page lead that does not exist.
 */
const PATH_RULES: { type: PageType; keywords: string[] }[] = [
  { type: 'LEGAL', keywords: ['privacy', 'terms', 'cookie', 'cookies', 'disclaimer', 'refund', 'shipping-policy', 'gdpr', 'privacy-policy', 'terms-and-conditions'] },
  { type: 'CONTACT', keywords: ['contact', 'contacts', 'get-in-touch', 'enquiry', 'enquire', 'request-a-quote'] },
  { type: 'ABOUT', keywords: ['about', 'our-story', 'who-we-are', 'team', 'leadership', 'careers', 'clients', 'infrastructure', 'certifications'] },
  { type: 'FAQ', keywords: ['faq', 'faqs', 'frequently-asked', 'help', 'support'] },
  { type: 'CASE_STUDY', keywords: ['case-study', 'case-studies', 'portfolio', 'our-work', 'projects', 'success-stories', 'testimonial', 'testimonials'] },
  { type: 'BLOG', keywords: ['blog', 'news', 'article', 'articles', 'insights', 'resources', 'guides', 'press', 'updates', 'category', 'tag', 'author'] },
  { type: 'PRODUCT', keywords: ['product', 'products', 'shop', 'store', 'catalog', 'catalogue', 'collection', 'collections'] },
  { type: 'SERVICE', keywords: ['service', 'services', 'solutions', 'what-we-do', 'capabilities', 'expertise'] },
  { type: 'LOCATION', keywords: ['location', 'locations', 'branch', 'branches', 'store-locator', 'areas-we-serve', 'near-me'] },
];

/**
 * Whether a keyword appears as a whole word inside one of the path's segments.
 *
 * Whole word, not substring. Substring matching looked tempting for the
 * prefixed segments this exists to catch, but it types `/restore-data` as a
 * product page on "store" and `/newsletter` as a blog on "news". A wrong type
 * lands silently in a gap count, so the looser rule costs more than the pages
 * it recovers.
 *
 * Multi-word keywords carry their own hyphens and match the same way, so
 * `what-we-do` is found in `/our-what-we-do` and not in `/what-we-did`.
 */
function segmentHasKeyword(segments: string[], keyword: string): boolean {
  return segments.some((segment) => {
    if (segment === keyword) return true;
    // Boundaries are the separators a URL slug actually uses, so the keyword
    // has to start and end where a word does.
    return new RegExp(`(^|[-_])${keyword}([-_]|$)`).test(segment);
  });
}

/** Heading wording, used only when the path says nothing. */
const HEADING_RULES: { type: PageType; pattern: RegExp }[] = [
  { type: 'CONTACT', pattern: /\b(contact us|get in touch|request a quote)\b/i },
  { type: 'ABOUT', pattern: /\b(about us|our story|who we are)\b/i },
  { type: 'FAQ', pattern: /\b(frequently asked|faqs?)\b/i },
  { type: 'CASE_STUDY', pattern: /\b(case study|our work|portfolio)\b/i },
];

export interface PageTypeInput {
  url: string;
  title?: string | null;
  h1?: string[] | null;
}

export function classifyPageType({ url, title, h1 }: PageTypeInput): PageType {
  let path: string;
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    // A relative or malformed URL still has a usable path.
    path = url.toLowerCase().split('?')[0].split('#')[0];
  }

  // Trailing slash normalised so `/about/` and `/about` cannot classify
  // differently — otherwise the same page changes type between crawls
  // depending on how it was linked, and every diff reports a phantom change.
  const normalised = path.replace(/\/+$/, '') || '/';

  if (normalised === '/' || normalised === '/index.html' || normalised === '/home') return 'HOME';

  const segments = normalised.split('/').filter(Boolean);
  for (const { type, keywords } of PATH_RULES) {
    if (keywords.some((keyword) => segmentHasKeyword(segments, keyword))) return type;
  }

  const headingText = [title ?? '', ...(h1 ?? [])].join(' ');
  for (const { type, pattern } of HEADING_RULES) {
    if (pattern.test(headingText)) return type;
  }

  return 'OTHER';
}
