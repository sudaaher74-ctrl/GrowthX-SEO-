import { CandidatePage, matchScore } from './page-signals';
import { questionGroup } from './question-group';
import { questionTerms, words } from './question-terms';

export type SuggestionSource = 'OWN_PAGE' | 'RIVAL_PAGE' | 'CONTENT_GAP';

export interface QuestionSuggestion {
  text: string;
  source: SuggestionSource;
  /** The page or gap the question was drawn from, so it can be checked. */
  evidenceUrl: string | null;
  evidence: string;
  competitorDomain: string | null;
}

/** Page types that describe something a buyer shops for. */
export const COMMERCIAL_PAGE_TYPES = new Set(['SERVICE', 'PRODUCT', 'CATEGORY', 'LOCATION', 'LANDING']);

/** Titles that name a section of a site, not a thing anyone searches for. */
const GENERIC_TOPICS = new Set([
  'home', 'homepage', 'about', 'about us', 'contact', 'contact us', 'get in touch', 'services', 'our services',
  'products', 'our products', 'all products', 'shop', 'store', 'blog', 'news', 'careers', 'faq', 'faqs',
  'privacy policy', 'terms and conditions', 'terms of service', 'gallery', 'portfolio', 'login', 'cart',
  'checkout', 'welcome', 'page not found', 'categories', 'category', 'our team', 'why choose us',
]);

/**
 * The topic a page is about, from its H1 or title, with the brand and site
 * name stripped ("Organic Turmeric Powder | Aiva Enterprises" -> "organic
 * turmeric powder"). Null when what remains is generic or too short to be a
 * search.
 */
export function pageTopic(page: CandidatePage, brand: string[]): string | null {
  const raw = page.h1.find((h) => h.trim()) ?? page.title ?? '';
  // Titles usually end in " | Brand" or " - Brand".
  const head = raw.split(/\s[|–—-]\s|\s·\s/)[0] ?? raw;
  let topic = words(head).join(' ');
  for (const term of brand) {
    for (const w of words(term)) topic = topic.replace(new RegExp(`\\b${w}\\b`, 'g'), ' ');
  }
  topic = topic.replace(/\s+/g, ' ').trim();
  if (!topic || GENERIC_TOPICS.has(topic)) return null;
  if (questionTerms(topic).length < 2 || topic.split(' ').length > 8) return null;
  return topic;
}

/** How a buyer would ask for this topic. `city` narrows it to a market when known. */
export function buyerQuestion(topic: string, city: string | null): string {
  const inCity = city && !topic.includes(city.toLowerCase()) ? ` in ${city}` : '';
  return `best ${topic}${inCity}`;
}

/**
 * Buyer questions grounded in pages that exist: the customer's own commercial
 * pages, and rivals' commercial pages on topics the customer has no page for.
 *
 * Nothing is invented — each suggestion carries the URL it came from — and a
 * question that names the brand is never suggested, because it would measure
 * reputation, not visibility.
 */
export function suggestQuestions(input: {
  ownPages: CandidatePage[];
  rivalPages: Array<CandidatePage & { competitorDomain: string }>;
  contentGaps: Array<{ title: string; relatedKeywords: string[] }>;
  brand: string[];
  city: string | null;
  alreadyTracked: string[];
  limit?: number;
}): QuestionSuggestion[] {
  const limit = input.limit ?? 12;
  const seen = new Set(input.alreadyTracked.map((t) => t.trim().toLowerCase()));
  const out: QuestionSuggestion[] = [];
  // Per-source caps keep one source from crowding out the others: a rival
  // with fifty product pages should not leave no room for the customer's own.
  const caps: Record<SuggestionSource, number> = { RIVAL_PAGE: 6, CONTENT_GAP: 3, OWN_PAGE: limit };
  const used: Record<SuggestionSource, number> = { RIVAL_PAGE: 0, CONTENT_GAP: 0, OWN_PAGE: 0 };
  const push = (suggestion: QuestionSuggestion) => {
    const key = suggestion.text.toLowerCase();
    if (used[suggestion.source] >= caps[suggestion.source]) return;
    if (seen.has(key) || questionGroup(suggestion.text, input.brand) === 'REPUTATION') return;
    seen.add(key);
    used[suggestion.source] += 1;
    out.push(suggestion);
  };

  const ownCommercial = input.ownPages.filter((p) => COMMERCIAL_PAGE_TYPES.has(p.pageType));

  // Rival topics first: those are where the customer is most likely invisible.
  for (const page of input.rivalPages) {
    if (!COMMERCIAL_PAGE_TYPES.has(page.pageType)) continue;
    const topic = pageTopic(page, input.brand);
    if (!topic) continue;
    const terms = questionTerms(topic);
    const covered = input.ownPages.some((own) => matchScore(terms, own) >= 0.5);
    if (covered) continue;
    push({
      text: buyerQuestion(topic, input.city),
      source: 'RIVAL_PAGE',
      evidenceUrl: page.url,
      evidence: `${page.competitorDomain} has a page on this; you have none.`,
      competitorDomain: page.competitorDomain,
    });
  }

  for (const gap of input.contentGaps) {
    const topic = words(gap.title).join(' ');
    if (!topic || questionTerms(topic).length < 2 || topic.split(' ').length > 8) continue;
    push({
      text: buyerQuestion(topic, input.city),
      source: 'CONTENT_GAP',
      evidenceUrl: null,
      evidence: `Open content gap: ${gap.title}`,
      competitorDomain: null,
    });
  }

  for (const page of ownCommercial) {
    const topic = pageTopic(page, input.brand);
    if (!topic) continue;
    push({
      text: buyerQuestion(topic, input.city),
      source: 'OWN_PAGE',
      evidenceUrl: page.url,
      evidence: 'One of your own pages covers this topic.',
      competitorDomain: null,
    });
  }

  return out.slice(0, limit);
}
