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
 */
const PATH_RULES: { type: PageType; pattern: RegExp }[] = [
  { type: 'LEGAL', pattern: /\/(privacy|terms|cookie|disclaimer|refund|shipping-policy|gdpr)(\/|-|$)/ },
  { type: 'CONTACT', pattern: /\/(contact|get-in-touch|enquiry|enquire|request-a-quote|book)(\/|-|$)/ },
  { type: 'ABOUT', pattern: /\/(about|our-story|who-we-are|team|leadership|careers)(\/|-|$)/ },
  { type: 'FAQ', pattern: /\/(faq|faqs|frequently-asked|help|support)(\/|-|$)/ },
  { type: 'CASE_STUDY', pattern: /\/(case-stud|portfolio|our-work|projects|success-stor|testimonial)/ },
  { type: 'BLOG', pattern: /\/(blog|news|article|insights|resources|guides|press|updates|category|tag|author)(\/|-|$)/ },
  { type: 'PRODUCT', pattern: /\/(product|products|shop|store|catalog|catalogue|collection|item)(\/|-|$)/ },
  { type: 'SERVICE', pattern: /\/(service|services|solutions|what-we-do|capabilities|expertise)(\/|-|$)/ },
  { type: 'LOCATION', pattern: /\/(location|locations|branch|branches|store-locator|areas-we-serve|near-me)(\/|-|$)/ },
];

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

  for (const { type, pattern } of PATH_RULES) {
    if (pattern.test(`${normalised}/`)) return type;
  }

  const headingText = [title ?? '', ...(h1 ?? [])].join(' ');
  for (const { type, pattern } of HEADING_RULES) {
    if (pattern.test(headingText)) return type;
  }

  return 'OTHER';
}
