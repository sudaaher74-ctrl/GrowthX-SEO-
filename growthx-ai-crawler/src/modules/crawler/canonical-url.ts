/**
 * The identity of a page, independent of how a link happened to spell it.
 *
 * A site links itself both ways — the footer uses example.com/about, the nav
 * uses www.example.com/about — and treating those as two pages inflated every
 * page count in the product: the first site crawled recorded 44 rows for 35
 * pages. Anywhere two sets of URLs are compared or counted, this is what makes
 * them comparable.
 *
 * Kept in one module because it is now the answer to "is this the same page?"
 * in three places — deduplicating a crawl, counting coverage, and diffing one
 * crawl against the next. Three copies of a rule like this drift, and the
 * symptom of drift is a page counted twice on one screen and once on another.
 *
 * Deliberately conservative. Only the parts of a URL that never change which
 * page is served are dropped: the scheme, a leading `www.`, host casing, and a
 * trailing slash. A subdomain is a different site, and a query string is
 * frequently the whole page — collapsing those would merge pages that differ,
 * which is a worse error than missing a duplicate because it silently deletes
 * a page from every count.
 */
export function canonicalUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const path = parsed.pathname.replace(/\/+$/, '');
    return `${host}${path}${parsed.search}`;
  } catch {
    // A malformed URL is its own identity. Returning it unchanged keeps it
    // distinct from every other URL rather than collapsing several bad ones
    // into one page.
    return rawUrl;
  }
}
