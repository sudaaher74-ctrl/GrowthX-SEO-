/**
 * Stable identity for a finding across crawls.
 *
 * `dedupKey` already deduplicates within a single crawl. It cannot do more than
 * that: it is scoped to the crawl job, so the same defect found again next week
 * is a different row with a different id and no link back. That is why the
 * product cannot say how long something has been open, whether a fix held, or
 * whether a problem came back — every crawl starts the history over.
 *
 * A fingerprint is the same finding's name in every crawl. Two crawls of an
 * unchanged site must produce the same set of fingerprints, or continuity is
 * lost and every re-crawl reports the whole site as new.
 */

/**
 * URL normalisation matters more than it looks: the same page reached as
 * http/https, with or without www, with a trailing slash, or carrying a utm_*
 * query string must produce ONE fingerprint, or every crawl reports the same
 * problem as new.
 */
export function normaliseUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.protocol = 'https:';
    u.hostname = u.hostname.replace(/^www\./, '').toLowerCase();
    u.hash = '';
    // Drop tracking params; keep everything else, because ?page=2 is a
    // different page and ?utm_source=x is not.
    const drop = [/^utm_/i, /^fbclid$/i, /^gclid$/i, /^msclkid$/i, /^ref$/i];
    [...u.searchParams.keys()].forEach((k) => {
      if (drop.some((re) => re.test(k))) u.searchParams.delete(k);
    });
    u.searchParams.sort();
    let path = u.pathname.replace(/\/+$/, '');
    if (path === '') path = '/';
    u.pathname = path;
    return u.toString();
  } catch {
    // A finding on an unparseable URL still needs a stable name. Trimming and
    // lowercasing is enough for that: the same malformed string yields the same
    // fingerprint, which is all continuity requires.
    return raw.trim().toLowerCase();
  }
}

/**
 * The scope a fingerprint is unique within.
 *
 * Normally the project. Competitor sites are crawled with `Website.projectId`
 * left null on purpose — that null is what keeps a rival's pages out of the
 * customer's analysis — so their findings have no project to be scoped by.
 * Scoping those to the website keeps the fingerprint non-null and still unique
 * per site, without inventing a project that does not exist.
 */
export function fingerprintScope(
  projectId: string | null | undefined,
  websiteId: string,
): string {
  return projectId ?? `website:${websiteId}`;
}

export function issueFingerprint(
  projectId: string,
  issueType: string,
  affectedUrl: string,
): string {
  return `${projectId}::${issueType}::${normaliseUrl(affectedUrl)}`;
}

/** Site-wide findings (robots.txt, sitemap) are not per-URL. */
export function siteFingerprint(projectId: string, issueType: string): string {
  return `${projectId}::${issueType}::__site__`;
}

/**
 * The unit the queue is displayed in: one row per problem, not per affected
 * page.
 *
 * The live dashboard's priority queue shows five rows, all of them the same
 * schema defect on five product URLs, while 150 findings of other kinds go
 * unmentioned. Grouping by type within a site is what turns that into
 * "Product schema missing offers — 29 pages" and leaves room for the rest.
 *
 * Shares a scope with the fingerprint, so a competitor crawl's groups stay
 * separate from the customer's without needing a project.
 */
export function issueGroupKey(scope: string, issueType: string): string {
  return `${scope}::${issueType}`;
}

/**
 * Findings about the site as a whole rather than about any one page. Their
 * affectedUrl is whichever URL happened to be fetched first, which is not
 * stable between crawls, so keying them by URL would report the same site-wide
 * defect as new every time the entry point changed.
 */
export const SITE_WIDE_ISSUE_TYPES: ReadonlySet<string> = new Set([
  'INCORRECT_ROBOTS',
  'HTTPS_ISSUE',
]);

/**
 * The one entry point the write path should use, so the site-wide exception is
 * applied in a single place rather than remembered at each call site.
 */
export function fingerprintFor(
  scope: string,
  issueType: string,
  affectedUrl: string,
): string {
  return SITE_WIDE_ISSUE_TYPES.has(issueType)
    ? siteFingerprint(scope, issueType)
    : issueFingerprint(scope, issueType, affectedUrl);
}
