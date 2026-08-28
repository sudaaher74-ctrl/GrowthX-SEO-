/**
 * Whether two pages are about the same thing, judged from their URL and title.
 *
 * "They have 18 more service pages than you" is a number. The useful form is
 * which 18, and that needs a way to tell that their /services/mango-pulp-export
 * and your /what-we-do/exporting-mango-pulp are the same page, so it is not
 * reported as a gap you already filled.
 *
 * Deliberately not an LLM call. This runs across every page of two sites on
 * every view, the answer has to be identical between two runs or the list
 * reshuffles under the reader, and the judgement — do these two page titles
 * describe the same topic — is one that word overlap gets right often enough
 * to be worth showing, provided the output never overstates it. Which is why
 * nothing here returns "you are missing this page": it returns the closest
 * thing found on your site and how close it was, and lets the reader decide.
 */

/**
 * Words carrying no topic. Split into two groups because they are excluded for
 * different reasons: the first are English filler, the second are words that
 * appear on the equivalent page of every site and so cannot distinguish one
 * topic from another.
 */
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'how', 'in', 'is', 'it', 'of',
  'on', 'or', 'our', 'that', 'the', 'to', 'we', 'what', 'with', 'you', 'your',
  // Present on the same page of every site: matching on these would make a
  // company's home page look like a match for their service page.
  'home', 'page', 'welcome', 'index', 'ltd', 'inc', 'llp', 'pvt', 'limited', 'company', 'official',
  'website', 'site', 'best', 'top', 'leading', 'quality', 'services', 'service', 'products',
  'product', 'solutions', 'solution',
]);

/**
 * How much of their topic has to appear on one of your pages before it counts
 * as covered.
 *
 * Set by what each kind of error costs. Too low and a real gap is hidden as
 * "you have this", which is the expensive mistake — the customer never writes
 * the page. Too high and a page they already have is listed as an opportunity,
 * which wastes a few minutes when they click it and see. So this errs towards
 * showing the opportunity, and the closest match is always shown alongside it
 * so an already-covered topic is obvious at a glance.
 */
export const MATCH_THRESHOLD = 0.6;

/**
 * The topic words in a page's URL and title.
 *
 * The last path segment carries the topic on nearly every site
 * (/services/mango-pulp-export), and the title carries it in words a URL slug
 * abbreviates away. Both are used, because either alone misses cases: a URL of
 * /p/1423 has nothing, and a title of "AIVA Enterprises" has nothing either.
 */
export function topicTokens(url: string, title?: string | null): Set<string> {
  let slug = '';
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean);
    slug = segments[segments.length - 1] ?? '';
  } catch {
    slug = url;
  }

  // A trailing file extension is not part of the topic.
  slug = slug.replace(/\.(html?|php|aspx?|jsp)$/i, '');

  const words = `${slug} ${title ?? ''}`
    .toLowerCase()
    // Anything that is not a letter or digit separates words: hyphens and
    // underscores in slugs, punctuation and pipes in titles.
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word) && !/^\d+$/.test(word));

  return new Set(words);
}

/**
 * How much of `theirs` is covered by `ours`, from 0 to 1.
 *
 * Asymmetric on purpose. The question is whether their topic appears on our
 * page, not whether the two pages are equivalent: our page about mango and
 * banana pulp export does cover their page about mango pulp, and a symmetric
 * measure would score that pairing low precisely because our page says more.
 */
export function topicOverlap(theirs: Set<string>, ours: Set<string>): number {
  if (theirs.size === 0) return 0;
  let shared = 0;
  for (const word of theirs) if (ours.has(word)) shared += 1;
  return shared / theirs.size;
}

export interface MatchablePage {
  url: string;
  title?: string | null;
  pageType?: string;
}

/**
 * A token has to appear on more than this share of a site's pages before it is
 * treated as that site's boilerplate. A real topic word appears on a handful
 * of pages; a brand name in the title template appears on all of them.
 */
const BOILERPLATE_SHARE = 0.5;
/**
 * Below this many pages the share is meaningless — on a four-page site a
 * genuine topic word can easily appear on half of them, and dropping it would
 * leave those pages with no topic at all.
 */
const MIN_PAGES_FOR_BOILERPLATE = 5;

/**
 * The words this particular site puts on nearly every page.
 *
 * Almost every site appends its own name to every title — "Tomato Paste | AIVA
 * Enterprises". Those words are not the topic, and leaving them in breaks
 * matching between two sites in the expensive direction. Measured on the real
 * crawl: their /products/tomato-paste reads [tomato, paste, acme, foods] and
 * ours reads [tomato, paste, aiva, enterprises], so two of each four tokens
 * are brand, the overlap is 0.50, and a page the customer already has is
 * reported as a gap they should go and write.
 *
 * Derived from the site's own pages rather than a list of known brands,
 * because the boilerplate is different for every site and nobody can maintain
 * that list. A site's tagline gets caught the same way its name does.
 */
export function siteBoilerplate(pages: MatchablePage[]): Set<string> {
  if (pages.length < MIN_PAGES_FOR_BOILERPLATE) return new Set();

  const frequency = new Map<string, number>();
  for (const page of pages) {
    for (const token of topicTokens(page.url, page.title)) {
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }

  const boilerplate = new Set<string>();
  for (const [token, count] of frequency) {
    if (count / pages.length > BOILERPLATE_SHARE) boilerplate.add(token);
  }
  return boilerplate;
}

function withoutBoilerplate(tokens: Set<string>, boilerplate: Set<string>): Set<string> {
  if (boilerplate.size === 0) return tokens;
  const kept = new Set<string>();
  for (const token of tokens) if (!boilerplate.has(token)) kept.add(token);
  // A page whose every word is boilerplate — a bare home page — keeps its
  // tokens rather than becoming empty. Empty means "no topic", which would
  // silently exclude it from matching in both directions.
  return kept.size > 0 ? kept : tokens;
}

export interface ClosestMatch {
  page: MatchablePage;
  score: number;
}

/**
 * The page of ours that comes closest to covering theirs, or null when none
 * shares a single topic word.
 *
 * Searched across all our pages rather than only those of the same kind: a
 * topic they cover with a service page may well be covered by our blog post,
 * and reporting it as missing because the page kinds differ would be wrong.
 */
export function closestMatch(
  theirPage: MatchablePage,
  ourPages: MatchablePage[],
  /**
   * Each site's own boilerplate, so brand names are not compared against each
   * other. Omitted, matching still works but scores are diluted by however
   * much of each title is the site's name — see siteBoilerplate.
   */
  boilerplate: { theirs?: Set<string>; ours?: Set<string> } = {},
): ClosestMatch | null {
  const empty = new Set<string>();
  const theirTokens = withoutBoilerplate(
    topicTokens(theirPage.url, theirPage.title),
    boilerplate.theirs ?? empty,
  );
  if (theirTokens.size === 0) return null;

  let best: ClosestMatch | null = null;
  for (const ourPage of ourPages) {
    const ourTokens = withoutBoilerplate(
      topicTokens(ourPage.url, ourPage.title),
      boilerplate.ours ?? empty,
    );
    const score = topicOverlap(theirTokens, ourTokens);
    if (score > 0 && (!best || score > best.score)) best = { page: ourPage, score };
  }
  return best;
}
