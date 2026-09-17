/**
 * Page classification rules shared with crawler backend.
 */
export type PageType =
  | 'HOME'
  | 'SERVICE'
  | 'PRODUCT'
  | 'CATEGORY'
  | 'LOCATION'
  | 'BLOG'
  | 'CASE_STUDY'
  | 'FAQ'
  | 'ABOUT'
  | 'CONTACT'
  | 'LEGAL'
  | 'STATIC'
  | 'LANDING'
  | 'OTHER';

const PATH_RULES: { type: PageType; keywords: string[] }[] = [
  { type: 'LEGAL', keywords: ['privacy', 'terms', 'cookie', 'cookies', 'disclaimer', 'refund', 'shipping-policy', 'gdpr', 'privacy-policy', 'terms-and-conditions'] },
  { type: 'STATIC', keywords: ['privacy', 'terms', 'cookie', 'cookies', 'disclaimer', 'refund', 'shipping-policy', 'gdpr', 'privacy-policy', 'terms-and-conditions', 'static', 'policy', 'policies'] },
  { type: 'CONTACT', keywords: ['contact', 'contacts', 'get-in-touch', 'enquiry', 'enquire', 'request-a-quote'] },
  { type: 'ABOUT', keywords: ['about', 'our-story', 'who-we-are', 'team', 'leadership', 'careers', 'clients', 'infrastructure', 'certifications'] },
  { type: 'FAQ', keywords: ['faq', 'faqs', 'frequently-asked', 'help', 'support'] },
  { type: 'CASE_STUDY', keywords: ['case-study', 'case-studies', 'portfolio', 'our-work', 'projects', 'success-stories', 'testimonial', 'testimonials'] },
  { type: 'BLOG', keywords: ['blog', 'news', 'article', 'articles', 'insights', 'resources', 'guides', 'press', 'updates', 'tag', 'author'] },
  { type: 'LANDING', keywords: ['lp', 'landing-page', 'promo', 'promotion', 'special-offer'] },
  { type: 'CATEGORY', keywords: ['category', 'categories', 'collection', 'collections', 'catalog', 'catalogue', 'aseptic', 'concentrates', 'iqf-fruits', 'iqf-frozen', 'vegetables'] },
  { type: 'PRODUCT', keywords: ['product', 'products', 'shop', 'store', 'item', 'items'] },
  { type: 'SERVICE', keywords: ['service', 'services', 'solutions', 'what-we-do', 'capabilities', 'expertise'] },
  { type: 'LOCATION', keywords: ['location', 'locations', 'branch', 'branches', 'store-locator', 'areas-we-serve', 'near-me'] },
];

function segmentHasKeyword(segments: string[], keyword: string): boolean {
  return segments.some((segment) => {
    if (segment === keyword) return true;
    return new RegExp(`(^|[-_])${keyword}([-_]|$)`).test(segment);
  });
}

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
    path = url.toLowerCase().split('?')[0].split('#')[0];
  }

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

export const DISPLAY_PAGE_TYPES = [
  'Homepage',
  'Product page',
  'Category page',
  'Blog/article',
  'Service page',
  'Landing page',
  'Contact page',
  'About page',
  'Static page',
  'Other',
] as const;

export type DisplayPageType = (typeof DISPLAY_PAGE_TYPES)[number];

export function toDisplayPageType(type: string): DisplayPageType {
  switch (type?.toUpperCase()) {
    case 'HOME':
      return 'Homepage';
    case 'PRODUCT':
      return 'Product page';
    case 'CATEGORY':
      return 'Category page';
    case 'BLOG':
      return 'Blog/article';
    case 'SERVICE':
      return 'Service page';
    case 'LANDING':
      return 'Landing page';
    case 'CONTACT':
      return 'Contact page';
    case 'ABOUT':
      return 'About page';
    case 'STATIC':
    case 'LEGAL':
    case 'FAQ':
      return 'Static page';
    default:
      return 'Other';
  }
}
