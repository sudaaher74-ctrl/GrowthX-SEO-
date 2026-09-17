/**
 * Query parameters that identify a visitor or a campaign, never the content.
 *
 * Stripping them is what stops one page arriving as forty. Anything not on this
 * list is kept, because a query string very often *is* the page — `?p=12`,
 * `?product=x` — and a crawler that drops those crawls one page of a catalogue.
 */
export const TRACKING_PARAMS: RegExp[] = [
  /^utm_/i,
  /^gclid$/i,
  /^gclsrc$/i,
  /^dclid$/i,
  /^fbclid$/i,
  /^msclkid$/i,
  /^mc_(cid|eid)$/i,
  /^igshid$/i,
  /^ttclid$/i,
  /^twclid$/i,
  /^yclid$/i,
  /^ref$/i,
  /^referrer$/i,
  /^_ga$/i,
  /^_gl$/i,
  /^vero_(id|conv)$/i,
  /^hsa_/i,
  /^s_kwcid$/i,
  /^wickedid$/i,
];

export type TrailingSlashPolicy = 'preserve' | 'strip' | 'add';

export interface NormalizeOptions {
  /**
   * Learned from the site's own 301s rather than assumed. A site that redirects
   * `/about/` to `/about` has told us which spelling is the page; guessing the
   * other way turns every internal link into a redirect hop.
   */
  trailingSlash?: TrailingSlashPolicy;
  /** Extra per-project parameters to drop. */
  extraTrackingParams?: string[];
  /** Base URL for resolving a relative href. */
  base?: string;
}

function isTracking(name: string, extra: string[]): boolean {
  if (extra.some((e) => e.toLowerCase() === name.toLowerCase())) return true;
  return TRACKING_PARAMS.some((re) => re.test(name));
}

/**
 * The canonical spelling of a URL, used as the frontier's dedup key.
 *
 * Lowercases the host but never the path: plenty of servers serve `/About` and
 * `/about` as different resources, and folding them loses a real page. Drops
 * the fragment, the default port, and tracking parameters; sorts what remains
 * so `?a=1&b=2` and `?b=2&a=1` are one key.
 *
 * Returns an empty string for anything that is not an http(s) URL — `mailto:`,
 * `tel:`, `javascript:` — so callers get one unambiguous "not a page to fetch".
 */
export function normalizeUrl(rawUrl: string, options: NormalizeOptions = {}): string {
  const raw = (rawUrl || '').trim();
  if (!raw) return '';

  // A scheme that is not http(s) is settled here, before any guessing. Bolting
  // `https://` onto `mailto:hi@example.com` produces a URL that parses, and
  // treating that as a page is how a contact address becomes a crawl target.
  const explicitScheme = /^([a-z][a-z0-9+.-]*):/i.exec(raw);
  if (explicitScheme && !/^https?$/i.test(explicitScheme[1]) && !raw.startsWith('//')) return '';
  if (raw.startsWith('#')) return '';

  let parsed: URL;
  try {
    if (options.base) {
      parsed = new URL(raw, options.base);
    } else {
      parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/\//, '')}`);
    }
  } catch {
    return '';
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';

  parsed.hash = '';
  parsed.hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  parsed.username = '';
  parsed.password = '';

  if ((parsed.protocol === 'https:' && parsed.port === '443') || (parsed.protocol === 'http:' && parsed.port === '80')) {
    parsed.port = '';
  }

  const extra = options.extraTrackingParams || [];
  const kept: Array<[string, string]> = [];
  parsed.searchParams.forEach((value, name) => {
    if (!isTracking(name, extra)) kept.push([name, value]);
  });
  kept.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  parsed.search = '';
  for (const [name, value] of kept) parsed.searchParams.append(name, value);

  // `new URL` has already resolved ./ and ../ for us; this only collapses the
  // duplicate separators that hand-written hrefs produce.
  let pathname = parsed.pathname.replace(/\/{2,}/g, '/') || '/';
  const policy = options.trailingSlash || 'strip';
  if (pathname !== '/') {
    const looksLikeFile = /\.[a-z0-9]{1,8}$/i.test(pathname.split('/').pop() || '');
    if (policy === 'strip') {
      pathname = pathname.replace(/\/+$/, '') || '/';
    } else if (policy === 'add' && !looksLikeFile && !pathname.endsWith('/')) {
      pathname = `${pathname}/`;
    }
  }
  parsed.pathname = pathname;

  return parsed.toString();
}

/**
 * Infers the site's trailing-slash spelling from redirects it actually issued.
 *
 * Only a redirect that changes nothing *but* the trailing slash counts as
 * evidence; a redirect that also changes host or path is about something else,
 * and reading a slash policy out of it would be reading tea leaves.
 */
export function inferTrailingSlashPolicy(
  hops: Array<{ url: string; location?: string; status?: number }>,
): TrailingSlashPolicy | undefined {
  for (const hop of hops) {
    if (!hop.location || !hop.status || hop.status < 300 || hop.status >= 400) continue;
    try {
      const from = new URL(hop.url);
      const to = new URL(hop.location, hop.url);
      if (from.host !== to.host || from.search !== to.search) continue;
      const fromPath = from.pathname;
      const toPath = to.pathname;
      if (fromPath === toPath) continue;
      if (`${toPath}/` === fromPath) return 'strip';
      if (`${fromPath}/` === toPath) return 'add';
    } catch {
      continue;
    }
  }
  return undefined;
}

/**
 * Evaluates whether a candidate URL belongs to the configured target domain
 * or its approved subdomains.
 */
export function isInternalTargetUrl(
  candidateUrl: string,
  targetOriginOrDomain: string,
  approvedSubdomains: string[] = [],
): boolean {
  try {
    let candidateHost = new URL(candidateUrl).hostname.toLowerCase().replace(/\.$/, '');
    let targetHost: string;
    if (targetOriginOrDomain.includes('://')) {
      targetHost = new URL(targetOriginOrDomain).hostname.toLowerCase().replace(/\.$/, '');
    } else {
      targetHost = targetOriginOrDomain.toLowerCase().replace(/\.$/, '').split('/')[0].split(':')[0];
    }

    if (candidateHost === targetHost) return true;

    // Standardize www / apex
    const baseTarget = targetHost.replace(/^www\./, '');
    const baseCandidate = candidateHost.replace(/^www\./, '');

    if (baseCandidate === baseTarget) return true;

    // Check approved subdomains
    for (const sub of approvedSubdomains) {
      const cleanSub = sub.toLowerCase().replace(/^\./, '').replace(/^www\./, '');
      if (candidateHost === cleanSub || candidateHost.endsWith(`.${cleanSub}`)) {
        return true;
      }
    }

    // Check if candidateHost is a subdomain of baseTarget
    if (candidateHost.endsWith(`.${baseTarget}`)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

