import { normalizeUrl } from './url/url-normalizer';
import { sameRegistrableDomain } from './url/registrable-domain';

export type Indexability = 'INDEXABLE' | 'NOT_INDEXABLE' | 'UNKNOWN';

export type IndexabilityReasonCode =
  | 'STATUS_NOT_2XX'
  | 'ROBOTS_TXT_DISALLOW'
  | 'META_ROBOTS_NOINDEX'
  | 'X_ROBOTS_TAG_NOINDEX'
  | 'CANONICAL_POINTS_ELSEWHERE'
  | 'FETCH_FAILED'
  | 'NOT_FETCHED';

export interface IndexabilityReason {
  code: IndexabilityReasonCode;
  /** The literal value observed, so a user can verify it themselves. */
  evidence: string;
}

export interface IndexabilitySignals {
  /** The status the ORIGIN answered with. Undefined when we never got one. */
  statusCode?: number;
  /** Whether robots.txt allows this URL for our token. Undefined = unknown. */
  robotsTxtAllows?: boolean;
  robotsTxtEvidence?: string;
  /** Raw `<meta name="robots">` content. Undefined = the tag is absent. */
  metaRobots?: string;
  /** Raw `X-Robots-Tag` response header. Undefined = the header is absent. */
  xRobotsTag?: string;
  /** Raw `<link rel="canonical">` href, already absolutised. */
  canonicalUrl?: string;
  /** The URL this page was fetched at, to test a canonical for self-reference. */
  pageUrl: string;
  /** True when no origin response was obtained at all. */
  fetchFailed?: boolean;
}

export interface IndexabilityResult {
  indexability: Indexability;
  reasons: IndexabilityReason[];
}

/** `noindex` is not a substring match: `index` must not match inside it. */
function hasNoindexDirective(value: string): boolean {
  return value
    .toLowerCase()
    .split(/[,;]/)
    .map((part) => part.trim())
    .some((part) => part === 'noindex' || part === 'none' || /^[a-z0-9_-]+\s*:\s*(noindex|none)$/.test(part));
}

/**
 * Whether a page can appear in search results.
 *
 *     indexable = status is 2xx
 *              && robots.txt allows the URL for our token
 *              && meta robots has no 'noindex'
 *              && X-Robots-Tag has no 'noindex'
 *              && canonical is absent OR self-referential
 *
 * Nothing else. In particular, a status code is never evidence of a robots
 * directive: the previous implementation had no indexability field at all and
 * the UI derived it from `statusCode >= 400`, so a page carrying no meta
 * robots, no X-Robots-Tag and no canonical was labelled "Noindex" purely
 * because a phantom 403 had been recorded against it.
 *
 * A signal we could not determine yields UNKNOWN, not NOT_INDEXABLE. The two
 * are different claims and only one of them should ever turn a row red.
 */
export function computeIndexability(signals: IndexabilitySignals): IndexabilityResult {
  const reasons: IndexabilityReason[] = [];

  if (signals.fetchFailed) {
    return {
      indexability: 'UNKNOWN',
      reasons: [{ code: 'FETCH_FAILED', evidence: 'No response was obtained from the origin, so no indexability signal could be read.' }],
    };
  }

  if (signals.statusCode === undefined) {
    return {
      indexability: 'UNKNOWN',
      reasons: [{ code: 'NOT_FETCHED', evidence: 'This URL has not been fetched.' }],
    };
  }

  if (signals.statusCode < 200 || signals.statusCode >= 300) {
    reasons.push({ code: 'STATUS_NOT_2XX', evidence: `HTTP ${signals.statusCode}` });
  }

  if (signals.robotsTxtAllows === false) {
    reasons.push({
      code: 'ROBOTS_TXT_DISALLOW',
      evidence: signals.robotsTxtEvidence || 'robots.txt disallows this path for our user-agent token.',
    });
  }

  if (signals.metaRobots && hasNoindexDirective(signals.metaRobots)) {
    reasons.push({ code: 'META_ROBOTS_NOINDEX', evidence: `<meta name="robots" content="${signals.metaRobots}">` });
  }

  if (signals.xRobotsTag && hasNoindexDirective(signals.xRobotsTag)) {
    reasons.push({ code: 'X_ROBOTS_TAG_NOINDEX', evidence: `X-Robots-Tag: ${signals.xRobotsTag}` });
  }

  if (signals.canonicalUrl) {
    const canonical = normalizeUrl(signals.canonicalUrl);
    const self = normalizeUrl(signals.pageUrl);
    // An unparseable canonical is a signal we could not read, not one that
    // said no; it is reported as its own issue instead.
    if (canonical && self && canonical !== self) {
      reasons.push({
        code: 'CANONICAL_POINTS_ELSEWHERE',
        evidence:
          `<link rel="canonical" href="${signals.canonicalUrl}"> on ${signals.pageUrl}` +
          (sameRegistrableDomain(canonical, self) ? '' : ' (a different domain)'),
      });
    }
  }

  // robots.txt we could not read at all leaves the answer genuinely open.
  const robotsUnknown = signals.robotsTxtAllows === undefined;
  if (reasons.length > 0) return { indexability: 'NOT_INDEXABLE', reasons };
  if (robotsUnknown) {
    return {
      indexability: 'UNKNOWN',
      reasons: [{ code: 'NOT_FETCHED', evidence: 'robots.txt could not be read, so its rules for this URL are unknown.' }],
    };
  }
  return { indexability: 'INDEXABLE', reasons: [] };
}
