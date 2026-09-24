/**
 * The words that carry a buyer question's meaning.
 *
 * "best organic spice exporter in india" is about organic, spice, exporter
 * and india; "best", "in" and the question framing say nothing about which
 * page should answer it. Matching a question to a page, and checking whether
 * a page covers it, both run on these terms.
 */

const STOPWORDS = new Set(
  (
    'a an and are as at be best by can do does for from get good how i in into is it its me my near us we ' +
    'nearby of on or our should that the their them there these they this to top vs versus was what ' +
    'when where which who why will with you your most cheap cheapest affordable recommended reliable ' +
    'trusted leading great list options option compare comparison review reviews company companies ' +
    'provider providers service services buy online shop store'
  ).split(' '),
);

/** Folds simple plurals so "spices" matches "spice". Deliberately crude. */
function stem(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith('es') && /(ches|shes|sses|xes)$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

export function words(text: string | null | undefined): string[] {
  return (text ?? '')
    .toLowerCase()
    .replace(/&amp;/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** The distinct meaning-carrying terms of a question, stemmed. */
export function questionTerms(question: string): string[] {
  const out: string[] = [];
  for (const word of words(question)) {
    if (word.length < 2 || STOPWORDS.has(word)) continue;
    const s = stem(word);
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

/** The stemmed vocabulary of a body of text, for coverage checks. */
export function vocabulary(text: string | null | undefined): Set<string> {
  return new Set(words(text).map(stem));
}

/** Share of `terms` present in `vocab`, 0..1. No terms counts as no coverage. */
export function coverage(terms: string[], vocab: Set<string>): number {
  if (terms.length === 0) return 0;
  return terms.filter((t) => vocab.has(t)).length / terms.length;
}
